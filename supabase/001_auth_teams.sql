
-- NEXO CRM | Bloque 12
-- Organizaciones, usuarios y permisos
-- Ejecutar una vez en Supabase > SQL Editor.

begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(btrim(name)) between 2 and 80),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null
    check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id);

create schema if not exists private;

-- Consultas de membresía sin recursión RLS.
-- Crear estas funciones desde SQL Editor.

create or replace function private.is_org_member(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_org_admin(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

revoke all on function private.is_org_member(uuid)
  from public;

revoke all on function private.is_org_admin(uuid)
  from public;

grant usage on schema private to authenticated;

grant execute on function private.is_org_member(uuid)
  to authenticated;

grant execute on function private.is_org_admin(uuid)
  to authenticated;

-- Protección de las tablas

alter table public.organizations
  enable row level security;

alter table public.organization_members
  enable row level security;

revoke all on public.organizations
  from anon, authenticated;

revoke all on public.organization_members
  from anon, authenticated;

grant select on public.organizations
  to authenticated;

grant update (name) on public.organizations
  to authenticated;

grant select on public.organization_members
  to authenticated;

-- Cada usuario ve únicamente sus organizaciones.

create policy "org_read_member"
on public.organizations
for select
to authenticated
using (private.is_org_member(id));

-- Solo administradores pueden cambiar el nombre.

create policy "org_update_admin"
on public.organizations
for update
to authenticated
using (private.is_org_admin(id))
with check (private.is_org_admin(id));

-- Los miembros pueden consultar su propio equipo.

create policy "membership_read_team"
on public.organization_members
for select
to authenticated
using (private.is_org_member(organization_id));

-- Crear empresa y primer administrador
-- de manera atómica y segura.

create or replace function public.create_nexo_organization(
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
begin
  if v_user is null then
    raise exception
      'Iniciá sesión para crear una organización';
  end if;

  if p_name is null
     or char_length(btrim(p_name)) not between 2 and 80
  then
    raise exception
      'El nombre debe tener entre 2 y 80 caracteres';
  end if;

  if exists (
    select 1
    from public.organization_members
    where user_id = v_user
  ) then
    raise exception
      'Ya pertenecés a una organización';
  end if;

  insert into public.organizations (
    name,
    created_by
  )
  values (
    btrim(p_name),
    v_user
  )
  returning id into v_org;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    v_org,
    v_user,
    'admin'
  );

  return v_org;
end;
$$;

revoke all
on function public.create_nexo_organization(text)
from public, anon;

grant execute
on function public.create_nexo_organization(text)
to authenticated;

commit;
