
-- =====================================================
-- NEXO CRM | BLOQUE 4
-- CONFIGURACIÓN MONETARIA COMPARTIDA
--
-- Requiere 001, 002 y 003 aplicados.
-- Conserva amount_base_ars como referencia original.
-- =====================================================

begin;

-- =====================================================
-- 1. COLUMNAS DE CONFIGURACIÓN MONETARIA
-- =====================================================

alter table public.organizations
  add column if not exists currency text,
  add column if not exists exchange_rate numeric(20,8),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_currency_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_currency_check
      check (
        currency is null
        or currency in ('ARS', 'USD')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_exchange_rate_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_exchange_rate_check
      check (
        exchange_rate is null
        or exchange_rate between 0.00000001 and 1000000000
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_exchange_source_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_exchange_source_check
      check (
        exchange_rate_source is null
        or exchange_rate_source in ('manual', 'oficial')
      );
  end if;
end;
$$;

-- =====================================================
-- 2. INICIALIZACIÓN DE PREFERENCIAS EXISTENTES
--
-- Copia las preferencias locales del administrador
-- solamente si la organización todavía no tiene moneda.
-- =====================================================

create or replace function private.nexo_initialize_currency_settings(
  p_organization_id uuid,
  p_currency text,
  p_exchange_rate numeric,
  p_exchange_rate_source text,
  p_exchange_rate_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text;
begin
  if (select auth.uid()) is null
     or not private.is_org_admin(p_organization_id)
  then
    raise exception 'No tenés permisos de administrador';
  end if;

  if p_currency is null
     or p_currency not in ('ARS', 'USD')
  then
    raise exception 'Moneda inválida';
  end if;

  if p_exchange_rate is not null
     and (
       p_exchange_rate <= 0
       or p_exchange_rate > 1000000000
     )
  then
    raise exception 'Cotización inválida';
  end if;

  if p_currency = 'USD'
     and p_exchange_rate is null
  then
    raise exception 'La cotización es obligatoria para utilizar USD';
  end if;

  if p_exchange_rate_source is not null
     and p_exchange_rate_source not in ('manual', 'oficial')
  then
    raise exception 'Origen de cotización inválido';
  end if;

  select currency
  into v_currency
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    raise exception 'La organización no existe';
  end if;

  -- Nunca sobrescribir una configuración ya inicializada.
  if v_currency is not null then
    return false;
  end if;

  -- No inicializar con oportunidades sin referencia ARS.
  if exists (
    select 1
    from public.crm_deals
    where organization_id = p_organization_id
      and amount_base_ars is null
  ) then
    raise exception
      'Existen oportunidades sin importe base ARS';
  end if;

  update public.organizations
  set
    currency = p_currency,
    exchange_rate = p_exchange_rate,
    exchange_rate_source =
      case
        when p_exchange_rate is null then null
        else coalesce(p_exchange_rate_source, 'manual')
      end,
    exchange_rate_updated_at = p_exchange_rate_updated_at
  where id = p_organization_id;

  update public.crm_deals
  set amount =
    case
      when p_currency = 'ARS'
        then round(amount_base_ars, 2)
      else
        round(amount_base_ars / p_exchange_rate, 2)
    end
  where organization_id = p_organization_id;

  return true;
end;
$$;

-- =====================================================
-- 3. APLICAR CAMBIO MONETARIO
--
-- Actualiza organización, oportunidades e historial
-- dentro de una única transacción.
-- =====================================================

create or replace function private.nexo_apply_currency_settings(
  p_organization_id uuid,
  p_currency text,
  p_exchange_rate numeric,
  p_exchange_rate_source text,
  p_exchange_rate_updated_at timestamptz,
  p_activity_id text,
  p_activity_title text,
  p_activity_detail text,
  p_activity_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not private.is_org_admin(p_organization_id)
  then
    raise exception 'No tenés permisos de administrador';
  end if;

  if p_currency is null
     or p_currency not in ('ARS', 'USD')
  then
    raise exception 'Moneda inválida';
  end if;

  if p_exchange_rate is not null
     and (
       p_exchange_rate <= 0
       or p_exchange_rate > 1000000000
     )
  then
    raise exception 'Cotización inválida';
  end if;

  if p_currency = 'USD'
     and p_exchange_rate is null
  then
    raise exception 'La cotización es obligatoria para utilizar USD';
  end if;

  if p_exchange_rate_source is not null
     and p_exchange_rate_source not in ('manual', 'oficial')
  then
    raise exception 'Origen de cotización inválido';
  end if;

  perform 1
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    raise exception 'La organización no existe';
  end if;

  if exists (
    select 1
    from public.crm_deals
    where organization_id = p_organization_id
      and amount_base_ars is null
  ) then
    raise exception
      'No se puede convertir: existen oportunidades sin importe base ARS';
  end if;

  -- Guardar preferencias compartidas.
  update public.organizations
  set
    currency = p_currency,
    exchange_rate = p_exchange_rate,
    exchange_rate_source =
      case
        when p_exchange_rate is null then null
        else coalesce(p_exchange_rate_source, 'manual')
      end,
    exchange_rate_updated_at = p_exchange_rate_updated_at
  where id = p_organization_id;

  -- Recalcular siempre desde la referencia original ARS.
  update public.crm_deals
  set amount =
    case
      when p_currency = 'ARS'
        then round(amount_base_ars, 2)
      else
        round(amount_base_ars / p_exchange_rate, 2)
    end
  where organization_id = p_organization_id;

  -- Registrar la conversión en el historial.
  if p_activity_id is not null then

    if p_activity_title is null
       or p_activity_detail is null
       or p_activity_created_at is null
    then
      raise exception 'Los datos de actividad están incompletos';
    end if;

    insert into public.crm_activities (
      organization_id,
      id,
      type,
      title,
      detail,
      actor_user_id,
      created_at
    )
    values (
      p_organization_id,
      p_activity_id,
      'system',
      p_activity_title,
      p_activity_detail,
      (select auth.uid()),
      p_activity_created_at
    )
    on conflict (organization_id, id)
    do nothing;

  end if;
end;
$$;

-- =====================================================
-- 4. FUNCIONES RPC PÚBLICAS
-- =====================================================

create or replace function public.nexo_initialize_currency_settings(
  p_organization_id uuid,
  p_currency text,
  p_exchange_rate numeric,
  p_exchange_rate_source text,
  p_exchange_rate_updated_at timestamptz
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.nexo_initialize_currency_settings(
    p_organization_id,
    p_currency,
    p_exchange_rate,
    p_exchange_rate_source,
    p_exchange_rate_updated_at
  );
$$;

create or replace function public.nexo_apply_currency_settings(
  p_organization_id uuid,
  p_currency text,
  p_exchange_rate numeric,
  p_exchange_rate_source text,
  p_exchange_rate_updated_at timestamptz,
  p_activity_id text,
  p_activity_title text,
  p_activity_detail text,
  p_activity_created_at timestamptz
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.nexo_apply_currency_settings(
    p_organization_id,
    p_currency,
    p_exchange_rate,
    p_exchange_rate_source,
    p_exchange_rate_updated_at,
    p_activity_id,
    p_activity_title,
    p_activity_detail,
    p_activity_created_at
  );
$$;

-- =====================================================
-- 5. PERMISOS
-- =====================================================

grant usage on schema private to authenticated;

revoke all on function
  private.nexo_initialize_currency_settings(
    uuid, text, numeric, text, timestamptz
  ),
  private.nexo_apply_currency_settings(
    uuid, text, numeric, text, timestamptz,
    text, text, text, timestamptz
  )
from public, anon, authenticated;

grant execute on function
  private.nexo_initialize_currency_settings(
    uuid, text, numeric, text, timestamptz
  ),
  private.nexo_apply_currency_settings(
    uuid, text, numeric, text, timestamptz,
    text, text, text, timestamptz
  )
to authenticated;

revoke all on function
  public.nexo_initialize_currency_settings(
    uuid, text, numeric, text, timestamptz
  ),
  public.nexo_apply_currency_settings(
    uuid, text, numeric, text, timestamptz,
    text, text, text, timestamptz
  )
from public, anon, authenticated;

grant execute on function
  public.nexo_initialize_currency_settings(
    uuid, text, numeric, text, timestamptz
  ),
  public.nexo_apply_currency_settings(
    uuid, text, numeric, text, timestamptz,
    text, text, text, timestamptz
  )
to authenticated;

commit;
