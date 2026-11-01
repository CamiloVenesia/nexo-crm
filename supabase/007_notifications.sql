
-- =========================================================
-- NEXO CRM | BLOQUE 7
-- CENTRO DE NOTIFICACIONES PERSISTENTES
-- Requiere 001 a 006 ejecutados previamente.
-- =========================================================

BEGIN;

-- 1. TABLA DE NOTIFICACIONES

CREATE TABLE IF NOT EXISTS public.crm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  recipient_user_id uuid NOT NULL,
  actor_user_id uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  notification_type text NOT NULL
    CHECK (
      notification_type IN (
        'message',
        'activity',
        'event',
        'task_due',
        'deal_due',
        'event_due'
      )
    ),

  title text NOT NULL,
  body text NOT NULL DEFAULT '',

  entity_type text
    CHECK (
      entity_type IS NULL
      OR entity_type IN (
        'conversation',
        'deal',
        'task',
        'company',
        'contact',
        'event',
        'activity'
      )
    ),

  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_notifications_recipient_fk
    FOREIGN KEY (organization_id, recipient_user_id)
    REFERENCES public.organization_members(organization_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS crm_notifications_recipient_created_idx
ON public.crm_notifications (
  organization_id,
  recipient_user_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS crm_notifications_unread_idx
ON public.crm_notifications (
  organization_id,
  recipient_user_id,
  created_at DESC
)
WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_notifications_dedupe_idx
ON public.crm_notifications (
  organization_id,
  recipient_user_id,
  dedupe_key
)
WHERE dedupe_key IS NOT NULL;

-- 2. SEGURIDAD Y RLS

ALTER TABLE public.crm_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_notifications
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.crm_notifications
TO authenticated;

GRANT UPDATE (read_at) ON public.crm_notifications
TO authenticated;

DROP POLICY IF EXISTS crm_notifications_select
ON public.crm_notifications;

CREATE POLICY crm_notifications_select
ON public.crm_notifications
FOR SELECT
TO authenticated
USING (
  recipient_user_id = (SELECT auth.uid())
  AND private.is_org_member(organization_id)
);

DROP POLICY IF EXISTS crm_notifications_update
ON public.crm_notifications;

CREATE POLICY crm_notifications_update
ON public.crm_notifications
FOR UPDATE
TO authenticated
USING (
  recipient_user_id = (SELECT auth.uid())
  AND private.is_org_member(organization_id)
)
WITH CHECK (
  recipient_user_id = (SELECT auth.uid())
  AND private.is_org_member(organization_id)
);

-- No se conceden permisos directos de INSERT ni DELETE.
-- Las notificaciones se generan mediante funciones de servidor.

-- 3. AVISAR SOBRE ACTIVIDAD DE OTROS INTEGRANTES

CREATE OR REPLACE FUNCTION private.nexo_notify_activity_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.crm_notifications (
    organization_id,
    recipient_user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    metadata,
    dedupe_key
  )
  SELECT
    NEW.organization_id,
    member.user_id,
    NEW.actor_user_id,
    'activity',
    COALESCE(NULLIF(btrim(NEW.title), ''), 'Nuevo movimiento en NEXO'),
    COALESCE(NEW.detail, ''),
    CASE NEW.type
      WHEN 'deal' THEN 'deal'
      WHEN 'task' THEN 'task'
      WHEN 'company' THEN 'company'
      WHEN 'contact' THEN 'contact'
      ELSE 'activity'
    END,
    NULL,
    jsonb_build_object(
      'activity_id', NEW.id,
      'activity_type', NEW.type
    ),
    'activity:' || NEW.id
  FROM public.organization_members AS member
  WHERE member.organization_id = NEW.organization_id
    AND member.user_id <> NEW.actor_user_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_activities_notify_team
ON public.crm_activities;

CREATE TRIGGER crm_activities_notify_team
AFTER INSERT ON public.crm_activities
FOR EACH ROW
EXECUTE FUNCTION private.nexo_notify_activity_insert();

-- 4. AVISAR SOBRE MENSAJES PRIVADOS NUEVOS

CREATE OR REPLACE FUNCTION private.nexo_notify_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.crm_notifications (
    organization_id,
    recipient_user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    metadata,
    dedupe_key
  )
  SELECT
    NEW.organization_id,
    participant.user_id,
    NEW.sender_id,
    'message',
    'Nuevo mensaje de ' || COALESCE(NULLIF(sender.email::text, ''), 'un integrante'),
    left(NEW.body, 220),
    'conversation',
    NEW.conversation_id::text,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id
    ),
    'message:' || NEW.id::text
  FROM public.crm_conversation_members AS participant
  LEFT JOIN auth.users AS sender
    ON sender.id = NEW.sender_id
  WHERE participant.conversation_id = NEW.conversation_id
    AND participant.organization_id = NEW.organization_id
    AND participant.user_id <> NEW.sender_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_messages_notify_recipient
ON public.crm_messages;

CREATE TRIGGER crm_messages_notify_recipient
AFTER INSERT ON public.crm_messages
FOR EACH ROW
EXECUTE FUNCTION private.nexo_notify_message_insert();

-- 5. AVISAR CUANDO OTRO INTEGRANTE CREA UN EVENTO

CREATE OR REPLACE FUNCTION private.nexo_notify_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.crm_notifications (
    organization_id,
    recipient_user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    metadata,
    dedupe_key
  )
  SELECT
    NEW.organization_id,
    member.user_id,
    NEW.created_by,
    'event',
    'Nuevo evento en el calendario',
    NEW.title || ' · ' || to_char(NEW.event_date, 'DD/MM/YYYY'),
    'event',
    NEW.id::text,
    jsonb_build_object(
      'event_date', NEW.event_date,
      'event_type', NEW.event_type,
      'all_day', NEW.all_day
    ),
    'event-created:' || NEW.id::text
  FROM public.organization_members AS member
  WHERE member.organization_id = NEW.organization_id
    AND member.user_id <> NEW.created_by
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_events_notify_team
ON public.crm_events;

CREATE TRIGGER crm_events_notify_team
AFTER INSERT ON public.crm_events
FOR EACH ROW
EXECUTE FUNCTION private.nexo_notify_event_insert();

-- 6. GENERAR RECORDATORIOS DE TAREAS, CIERRES Y EVENTOS

CREATE OR REPLACE FUNCTION private.nexo_sync_due_notifications(
  p_organization_id uuid,
  p_local_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_inserted integer := 0;
  v_rows integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Tenés que iniciar sesión';
  END IF;

  IF p_organization_id IS NULL
     OR NOT private.is_org_member(p_organization_id)
  THEN
    RAISE EXCEPTION 'No pertenecés a esta organización';
  END IF;

  IF p_local_date IS NULL THEN
    RAISE EXCEPTION 'La fecha local es obligatoria';
  END IF;

  -- Cerrar recordatorios que ya no corresponden.

  UPDATE public.crm_notifications AS notification
  SET read_at = now()
  WHERE notification.organization_id = p_organization_id
    AND notification.read_at IS NULL
    AND (
      (
        notification.notification_type = 'task_due'
        AND NOT EXISTS (
          SELECT 1
          FROM public.crm_tasks AS task
          WHERE task.organization_id = p_organization_id
            AND task.id = notification.entity_id
            AND task.done = false
            AND task.due_date IS NOT NULL
            AND task.due_date <= p_local_date + 1
        )
      )
      OR
      (
        notification.notification_type = 'deal_due'
        AND NOT EXISTS (
          SELECT 1
          FROM public.crm_deals AS deal
          WHERE deal.organization_id = p_organization_id
            AND deal.id = notification.entity_id
            AND deal.stage NOT IN ('ganado', 'perdido')
            AND deal.due_date IS NOT NULL
            AND deal.due_date <= p_local_date + 1
        )
      )
      OR
      (
        notification.notification_type = 'event_due'
        AND NOT EXISTS (
          SELECT 1
          FROM public.crm_events AS event
          WHERE event.organization_id = p_organization_id
            AND event.id::text = notification.entity_id
            AND event.event_date BETWEEN p_local_date AND p_local_date + 1
        )
      )
    );

  -- Tareas vencidas, de hoy o de mañana.

  INSERT INTO public.crm_notifications (
    organization_id,
    recipient_user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    metadata,
    dedupe_key
  )
  SELECT
    task.organization_id,
    member.user_id,
    NULL,
    'task_due',
    CASE
      WHEN task.due_date < p_local_date THEN 'Tarea vencida'
      WHEN task.due_date = p_local_date THEN 'Tarea para hoy'
      ELSE 'Tarea próxima'
    END,
    task.title || ' · Vencimiento: ' || to_char(task.due_date, 'DD/MM/YYYY'),
    'task',
    task.id,
    jsonb_build_object(
      'due_date', task.due_date,
      'priority', task.priority
    ),
    'task-due:' || task.id || ':' || task.due_date::text
  FROM public.crm_tasks AS task
  JOIN public.organization_members AS member
    ON member.organization_id = task.organization_id
  WHERE task.organization_id = p_organization_id
    AND task.done = false
    AND task.due_date IS NOT NULL
    AND task.due_date <= p_local_date + 1
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  -- Cierres comerciales vencidos, de hoy o de mañana.

  INSERT INTO public.crm_notifications (
    organization_id,
    recipient_user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    metadata,
    dedupe_key
  )
  SELECT
    deal.organization_id,
    member.user_id,
    NULL,
    'deal_due',
    CASE
      WHEN deal.due_date < p_local_date THEN 'Cierre comercial vencido'
      WHEN deal.due_date = p_local_date THEN 'Cierre comercial para hoy'
      ELSE 'Cierre comercial próximo'
    END,
    deal.title || ' · Fecha prevista: ' || to_char(deal.due_date, 'DD/MM/YYYY'),
    'deal',
    deal.id,
    jsonb_build_object(
      'due_date', deal.due_date,
      'stage', deal.stage
    ),
    'deal-due:' || deal.id || ':' || deal.due_date::text
  FROM public.crm_deals AS deal
  JOIN public.organization_members AS member
    ON member.organization_id = deal.organization_id
  WHERE deal.organization_id = p_organization_id
    AND deal.stage NOT IN ('ganado', 'perdido')
    AND deal.due_date IS NOT NULL
    AND deal.due_date <= p_local_date + 1
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  -- Eventos de hoy y mañana.

  INSERT INTO public.crm_notifications (
    organization_id,
    recipient_user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    metadata,
    dedupe_key
  )
  SELECT
    event.organization_id,
    member.user_id,
    event.created_by,
    'event_due',
    CASE
      WHEN event.event_date = p_local_date THEN 'Evento de hoy'
      ELSE 'Evento próximo'
    END,
    event.title || ' · ' ||
      CASE
        WHEN event.all_day THEN 'Todo el día'
        WHEN event.start_time IS NOT NULL
          THEN to_char(event.start_time, 'HH24:MI')
        ELSE to_char(event.event_date, 'DD/MM/YYYY')
      END,
    'event',
    event.id::text,
    jsonb_build_object(
      'event_date', event.event_date,
      'start_time', event.start_time,
      'all_day', event.all_day,
      'event_type', event.event_type
    ),
    'event-due:' || event.id::text || ':' || event.event_date::text
  FROM public.crm_events AS event
  JOIN public.organization_members AS member
    ON member.organization_id = event.organization_id
  WHERE event.organization_id = p_organization_id
    AND event.event_date BETWEEN p_local_date AND p_local_date + 1
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  RETURN v_inserted;
END;
$$;

-- 7. FUNCIÓN RPC PÚBLICA

CREATE OR REPLACE FUNCTION public.nexo_sync_due_notifications(
  p_organization_id uuid,
  p_local_date date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.nexo_sync_due_notifications(
    p_organization_id,
    p_local_date
  );
$$;

REVOKE ALL ON FUNCTION private.nexo_notify_activity_insert()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION private.nexo_notify_message_insert()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION private.nexo_notify_event_insert()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION private.nexo_sync_due_notifications(uuid, date)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.nexo_sync_due_notifications(uuid, date)
TO authenticated;

REVOKE ALL ON FUNCTION public.nexo_sync_due_notifications(uuid, date)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.nexo_sync_due_notifications(uuid, date)
TO authenticated;

-- 8. REALTIME

ALTER TABLE public.crm_notifications REPLICA IDENTITY FULL;

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
      AND tablename = 'crm_notifications'
  ) THEN
    EXECUTE
      'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_notifications';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
