
-- =========================================================
-- NEXO CRM | BLOQUE 10
-- OPTIMIZACIÓN DE CONSULTAS COMERCIALES
-- Migración 008
-- =========================================================

BEGIN;

-- EMPRESAS
-- Optimiza el listado por organización y fecha.

CREATE INDEX IF NOT EXISTS crm_companies_org_created_idx
ON public.crm_companies (
    organization_id,
    created_at DESC
);

-- CONTACTOS
-- Optimiza la carga de contactos recientes.

CREATE INDEX IF NOT EXISTS crm_contacts_org_created_idx
ON public.crm_contacts (
    organization_id,
    created_at DESC
);

-- OPORTUNIDADES
-- Optimiza la carga del pipeline.

CREATE INDEX IF NOT EXISTS crm_deals_org_created_idx
ON public.crm_deals (
    organization_id,
    created_at DESC
);

-- TAREAS
-- Optimiza el listado de tareas.

CREATE INDEX IF NOT EXISTS crm_tasks_org_created_idx
ON public.crm_tasks (
    organization_id,
    created_at DESC
);

-- TAREAS PENDIENTES
-- Optimiza consultas de vencimientos.
-- Excluye tareas ya completadas.

CREATE INDEX IF NOT EXISTS crm_tasks_org_pending_due_idx
ON public.crm_tasks (
    organization_id,
    due_date
)
WHERE done = false
  AND due_date IS NOT NULL;

-- CIERRES COMERCIALES
-- Optimiza los recordatorios de oportunidades
-- que todavía no fueron ganadas o perdidas.

CREATE INDEX IF NOT EXISTS crm_deals_org_open_due_idx
ON public.crm_deals (
    organization_id,
    due_date
)
WHERE stage NOT IN ('ganado', 'perdido')
  AND due_date IS NOT NULL;

COMMIT;

-- Actualiza estadísticas para el planificador SQL.

ANALYZE public.crm_companies;
ANALYZE public.crm_contacts;
ANALYZE public.crm_deals;
ANALYZE public.crm_tasks;
