
-- =====================================================
-- NEXO CRM | BLOQUE 2
-- SEGURIDAD Y GESTIÓN MULTIUSUARIO
--
-- Requiere los scripts 001 y 002 ya aplicados.
-- No elimina ni modifica datos comerciales existentes.
-- =====================================================

begin;

-- =====================================================
-- 1. INVITACIONES PRIVADAS
-- =====================================================

create table if not exists private.nexo_invitations (
  token uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  email text not null,

  invited_by uuid not null
    references auth.users(id),

  created_at timestamptz not null default now(),

  expires_at timestamptz not null
    default (now() + interval '48 hours'),

  used_at timestamptz,
  revoked_at timestamptz,

  constraint nexo_invite_email_length
    check (char_length(email) between 3 and 320)
);

create index if not exists
  nexo_invitations_org_email_idx
on private.nexo_invitations (
  organization_id,
  email
);

alter table private.nexo_invitations
  enable row level security;

revoke all on private.nexo_invitations
  from public, anon, authenticated;

-- =====================================================
-- 2. CREAR INVITACIÓN
-- Solo administradores
-- =====================================================

create or replace function private.nexo_create_invite(
  p_organization_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_token uuid;
begin
  if (select auth.uid()) is null
     or not private.is_org_admin(p_organization_id)
  then
    raise exception 'No tenés permisos de administrador';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));

  if char_length(v_email) not between 3 and 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'Ingresá un correo electrónico válido';
  end if;

  if exists (
    select 1
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id
      and lower(u.email) = v_email
  ) then
    raise exception 'Este usuario ya pertenece al equipo';
  end if;

  -- Invalidar invitaciones anteriores al mismo correo.
  update private.nexo_invitations
  set revoked_at = now()
  where organization_id = p_organization_id
    and email = v_email
    and used_at is null
    and revoked_at is null;

  insert into private.nexo_invitations (
    organization_id,
    email,
    invited_by
  )
  values (
    p_organization_id,
    v_email,
    (select auth.uid())
  )
  returning token into v_token;

  return v_token;
end;
$$;

-- =====================================================
-- 3. ACEPTAR INVITACIÓN
-- El correo debe estar confirmado en Supabase Auth.
-- Cada usuario pertenece a un solo equipo por ahora.
-- =====================================================

create or replace function private.nexo_accept_invite(
  p_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
  v_confirmed_at timestamptz;
  v_invite private.nexo_invitations%rowtype;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select
    lower(email),
    email_confirmed_at
  into
    v_email,
    v_confirmed_at
  from auth.users
  where id = v_user_id;

  if v_email is null or v_confirmed_at is null then
    raise exception
      'Primero tenés que confirmar tu correo electrónico';
  end if;

  select *
  into v_invite
  from private.nexo_invitations
  where token = p_token
  for update;

  if not found
     or v_invite.used_at is not null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
  then
    raise exception
      'La invitación no existe, expiró o ya fue utilizada';
  end if;

  if v_invite.email <> v_email then
    raise exception
      'Esta invitación corresponde a otro correo electrónico';
  end if;

  if exists (
    select 1
    from public.organization_members
    where user_id = v_user_id
      and organization_id <> v_invite.organization_id
  ) then
    raise exception
      'Ya pertenecés a otra organización';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    v_invite.organization_id,
    v_user_id,
    'member'
  )
  on conflict (organization_id, user_id)
  do nothing;

  update private.nexo_invitations
  set used_at = now()
  where token = p_token;

  return v_invite.organization_id;
end;
$$;

-- =====================================================
-- 4. CONSULTAR USUARIOS DEL EQUIPO
-- Solo administradores
-- =====================================================

create or replace function private.nexo_list_team(
  p_organization_id uuid
)
returns table (
  member_user_id uuid,
  member_email text,
  member_role text,
  member_joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not private.is_org_admin(p_organization_id)
  then
    raise exception 'Acceso no autorizado';
  end if;

  return query
  select
    m.user_id,
    u.email::text,
    m.role,
    m.joined_at
  from public.organization_members m
  join auth.users u
    on u.id = m.user_id
  where m.organization_id = p_organization_id
  order by m.joined_at asc;
end;
$$;

-- =====================================================
-- 5. MODIFICAR ROL
-- Protege al último administrador.
-- =====================================================

create or replace function private.nexo_set_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_role text;
  v_admin_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_organization_id::text)
  );

  if (select auth.uid()) is null
     or not private.is_org_admin(p_organization_id)
  then
    raise exception 'No tenés permisos de administrador';
  end if;

  if p_role not in ('admin', 'member')
     or p_role is null
  then
    raise exception 'Rol inválido';
  end if;

  select role
  into v_previous_role
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = p_user_id;

  if not found then
    raise exception 'El usuario no pertenece al equipo';
  end if;

  if v_previous_role = 'admin'
     and p_role = 'member'
  then
    select count(*)
    into v_admin_count
    from public.organization_members
    where organization_id = p_organization_id
      and role = 'admin';

    if v_admin_count <= 1 then
      raise exception
        'No podés quitar al último administrador';
    end if;
  end if;

  update public.organization_members
  set role = p_role
  where organization_id = p_organization_id
    and user_id = p_user_id;
end;
$$;

-- =====================================================
-- 6. ELIMINAR UN MIEMBRO
-- No borra sus actividades comerciales.
-- =====================================================

create or replace function private.nexo_remove_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_admin_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_organization_id::text)
  );

  if (select auth.uid()) is null
     or not private.is_org_admin(p_organization_id)
  then
    raise exception 'No tenés permisos de administrador';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception
      'No podés eliminar tu propia cuenta del equipo';
  end if;

  select role
  into v_role
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = p_user_id;

  if not found then
    raise exception 'El usuario no pertenece al equipo';
  end if;

  if v_role = 'admin' then
    select count(*)
    into v_admin_count
    from public.organization_members
    where organization_id = p_organization_id
      and role = 'admin';

    if v_admin_count <= 1 then
      raise exception
        'No podés eliminar al último administrador';
    end if;
  end if;

  delete from public.organization_members
  where organization_id = p_organization_id
    and user_id = p_user_id;
end;
$$;

-- =====================================================
-- 7. FUNCIONES PÚBLICAS DE ACCESO RPC
-- Solo delegan a funciones del esquema privado.
-- =====================================================

create or replace function public.nexo_create_invite(
  p_organization_id uuid,
  p_email text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.nexo_create_invite(
    p_organization_id,
    p_email
  );
$$;

create or replace function public.nexo_accept_invite(
  p_token uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.nexo_accept_invite(p_token);
$$;

create or replace function public.nexo_list_team(
  p_organization_id uuid
)
returns table (
  member_user_id uuid,
  member_email text,
  member_role text,
  member_joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.nexo_list_team(p_organization_id);
$$;

create or replace function public.nexo_set_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.nexo_set_member_role(
    p_organization_id,
    p_user_id,
    p_role
  );
$$;

create or replace function public.nexo_remove_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.nexo_remove_member(
    p_organization_id,
    p_user_id
  );
$$;

-- =====================================================
-- 8. PERMISOS EXPLÍCITOS
-- =====================================================

grant usage on schema private to authenticated;

revoke all on function
  private.nexo_create_invite(uuid, text),
  private.nexo_accept_invite(uuid),
  private.nexo_list_team(uuid),
  private.nexo_set_member_role(uuid, uuid, text),
  private.nexo_remove_member(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  private.nexo_create_invite(uuid, text),
  private.nexo_accept_invite(uuid),
  private.nexo_list_team(uuid),
  private.nexo_set_member_role(uuid, uuid, text),
  private.nexo_remove_member(uuid, uuid)
to authenticated;

revoke all on function
  public.nexo_create_invite(uuid, text),
  public.nexo_accept_invite(uuid),
  public.nexo_list_team(uuid),
  public.nexo_set_member_role(uuid, uuid, text),
  public.nexo_remove_member(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.nexo_create_invite(uuid, text),
  public.nexo_accept_invite(uuid),
  public.nexo_list_team(uuid),
  public.nexo_set_member_role(uuid, uuid, text),
  public.nexo_remove_member(uuid, uuid)
to authenticated;

commit;
