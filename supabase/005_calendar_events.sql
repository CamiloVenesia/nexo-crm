
-- =========================================================
-- NEXO CRM | BLOQUE 5
-- CALENDARIO COMERCIAL COMPARTIDO
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  title text NOT NULL
    CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),

  description text NOT NULL DEFAULT '',

  event_date date NOT NULL,

  start_time time WITHOUT TIME ZONE,
  end_time time WITHOUT TIME ZONE,

  all_day boolean NOT NULL DEFAULT false,

  event_type text NOT NULL DEFAULT 'meeting'
    CHECK (
      event_type IN (
        'meeting',
        'call',
        'reminder',
        'other'
      )
    ),

  location text NOT NULL DEFAULT '',

  created_by uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_events_time_check CHECK (
    (
      all_day = true
      AND start_time IS NULL
      AND end_time IS NULL
    )
    OR
    (
      all_day = false
      AND start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND end_time > start_time
    )
  )
);

-- ÍNDICES

CREATE INDEX IF NOT EXISTS crm_events_org_date_idx
ON public.crm_events (
  organization_id,
  event_date,
  start_time
);

CREATE INDEX IF NOT EXISTS crm_events_creator_idx
ON public.crm_events (
  organization_id,
  created_by
);

-- SEGURIDAD

ALTER TABLE public.crm_events
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_events
FROM anon, authenticated;

GRANT SELECT, DELETE
ON public.crm_events
TO authenticated;

GRANT INSERT (
  organization_id,
  created_by,
  title,
  description,
  event_date,
  start_time,
  end_time,
  all_day,
  event_type,
  location,
  created_at,
  updated_at
)
ON public.crm_events
TO authenticated;

GRANT UPDATE (
  title,
  description,
  event_date,
  start_time,
  end_time,
  all_day,
  event_type,
  location,
  updated_at
)
ON public.crm_events
TO authenticated;

-- CONSULTAR EVENTOS DE LA ORGANIZACIÓN

DROP POLICY IF EXISTS crm_events_select
ON public.crm_events;

CREATE POLICY crm_events_select
ON public.crm_events
FOR SELECT
TO authenticated
USING (
  private.is_org_member(organization_id)
);

-- CREAR EVENTOS

DROP POLICY IF EXISTS crm_events_insert
ON public.crm_events;

CREATE POLICY crm_events_insert
ON public.crm_events
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_org_member(organization_id)
  AND created_by = (SELECT auth.uid())
);

-- EDITAR EVENTOS PROPIOS O CUALQUIERA COMO ADMIN

DROP POLICY IF EXISTS crm_events_update
ON public.crm_events;

CREATE POLICY crm_events_update
ON public.crm_events
FOR UPDATE
TO authenticated
USING (
  private.is_org_member(organization_id)
  AND (
    created_by = (SELECT auth.uid())
    OR private.is_org_admin(organization_id)
  )
)
WITH CHECK (
  private.is_org_member(organization_id)
  AND (
    created_by = (SELECT auth.uid())
    OR private.is_org_admin(organization_id)
  )
);

-- ELIMINAR EVENTOS PROPIOS O CUALQUIERA COMO ADMIN

DROP POLICY IF EXISTS crm_events_delete
ON public.crm_events;

CREATE POLICY crm_events_delete
ON public.crm_events
FOR DELETE
TO authenticated
USING (
  private.is_org_member(organization_id)
  AND (
    created_by = (SELECT auth.uid())
    OR private.is_org_admin(organization_id)
  )
);

-- SINCRONIZACIÓN EN TIEMPO REAL

ALTER TABLE public.crm_events
REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
      AND puballtables = false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'crm_events'
  ) THEN

    EXECUTE
      'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_events';

  END IF;
END;
$$;

COMMIT;
