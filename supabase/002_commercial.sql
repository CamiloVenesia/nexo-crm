
-- =========================================================
-- NEXO CRM | BLOQUE 13
-- Datos comerciales por organización
-- Requiere haber ejecutado 001_auth_teams.sql
-- =========================================================

begin;

-- 1. CLIENTES / EMPRESAS

create table if not exists public.crm_companies (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  id text not null,
  name text not null check (length(btrim(name)) > 0),
  industry text not null default '',
  website text not null default '',
  location text not null default '',
  employees text not null default '',
  created_at timestamptz not null default now(),
  primary key (organization_id, id)
);

-- 2. CONTACTOS

create table if not exists public.crm_contacts (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  id text not null,
  name text not null check (length(btrim(name)) > 0),
  email text not null default '',
  phone text not null default '',
  role text not null default '',
  company_id text,
  status text not null default 'nuevo'
    check (status in ('nuevo', 'contactado', 'calificado')),
  source text not null default 'Manual',
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, company_id)
    references public.crm_companies(organization_id, id)
);

-- 3. OPORTUNIDADES / PIPELINE

create table if not exists public.crm_deals (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  id text not null,
  title text not null check (length(btrim(title)) > 0),
  company_id text,
  contact_id text,
  amount numeric(20,2) not null default 0
    check (amount >= 0),
  amount_base_ars numeric(28,10),
  stage text not null default 'prospeccion'
    check (stage in (
      'prospeccion',
      'calificacion',
      'propuesta',
      'negociacion',
      'ganado',
      'perdido'
    )),
  probability numeric(5,2) not null default 15
    check (probability between 0 and 100),
  owner text not null default '',
  due_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, company_id)
    references public.crm_companies(organization_id, id),
  foreign key (organization_id, contact_id)
    references public.crm_contacts(organization_id, id),
  check (amount_base_ars is null or amount_base_ars >= 0)
);

-- 4. TAREAS

create table if not exists public.crm_tasks (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  id text not null,
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  due_date date,
  priority text not null default 'media'
    check (priority in ('alta', 'media', 'baja')),
  done boolean not null default false,
  deal_id text,
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, deal_id)
    references public.crm_deals(organization_id, id)
);

-- 5. HISTORIAL

create table if not exists public.crm_activities (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  id text not null,
  type text not null
    check (type in (
      'deal', 'task', 'contact',
      'company', 'note', 'system'
    )),
  title text not null,
  detail text not null default '',
  actor_user_id uuid not null default auth.uid()
    references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (organization_id, id)
);

-- =========================================================
-- ÍNDICES
-- =========================================================

create index if not exists crm_contacts_company_idx
  on public.crm_contacts(organization_id, company_id);

create index if not exists crm_deals_company_idx
  on public.crm_deals(organization_id, company_id);

create index if not exists crm_deals_contact_idx
  on public.crm_deals(organization_id, contact_id);

create index if not exists crm_tasks_deal_idx
  on public.crm_tasks(organization_id, deal_id);

create index if not exists crm_activities_date_idx
  on public.crm_activities(organization_id, created_at desc);

-- =========================================================
-- SEGURIDAD: ROW LEVEL SECURITY
-- =========================================================

alter table public.crm_companies enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_activities enable row level security;

-- Retirar los permisos automáticos.
-- Solo se conceden los necesarios.

revoke all on
  public.crm_companies,
  public.crm_contacts,
  public.crm_deals,
  public.crm_tasks,
  public.crm_activities
from public, anon, authenticated;

grant select, insert on
  public.crm_companies,
  public.crm_contacts,
  public.crm_deals,
  public.crm_tasks,
  public.crm_activities
to authenticated;

grant update (
  name, industry, website, location, employees
) on public.crm_companies to authenticated;

grant update (
  name, email, phone, role, company_id,
  status, source, notes
) on public.crm_contacts to authenticated;

grant update (
  title, company_id, contact_id, amount,
  amount_base_ars, stage, probability,
  owner, due_date, notes, updated_at
) on public.crm_deals to authenticated;

grant update (
  title, description, due_date, priority,
  done, deal_id
) on public.crm_tasks to authenticated;

grant delete on
  public.crm_companies,
  public.crm_contacts,
  public.crm_deals,
  public.crm_tasks
to authenticated;

-- =========================================================
-- POLÍTICAS
-- Los miembros pueden consultar, crear y editar.
-- Solo los administradores pueden eliminar.
-- =========================================================

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_companies',
    'crm_contacts',
    'crm_deals',
    'crm_tasks',
    'crm_activities'
  ]
  loop
    execute format(
      'create policy %I on public.%I
       for select to authenticated
       using (private.is_org_member(organization_id))',
      table_name || '_select', table_name
    );

    execute format(
      'create policy %I on public.%I
       for insert to authenticated
       with check (private.is_org_member(organization_id))',
      table_name || '_insert', table_name
    );

    if table_name <> 'crm_activities' then
      execute format(
        'create policy %I on public.%I
         for update to authenticated
         using (private.is_org_member(organization_id))
         with check (private.is_org_member(organization_id))',
        table_name || '_update', table_name
      );

      execute format(
        'create policy %I on public.%I
         for delete to authenticated
         using (private.is_org_admin(organization_id))',
        table_name || '_delete', table_name
      );
    end if;
  end loop;
end;
$$;

-- El autor del historial debe coincidir
-- con el usuario autenticado.
alter policy crm_activities_insert
on public.crm_activities
with check (
  private.is_org_member(organization_id)
  and actor_user_id = (select auth.uid())
);

commit;
