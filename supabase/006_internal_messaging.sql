
-- =========================================================
-- NEXO CRM | BLOQUE 6
-- MENSAJERÍA INTERNA
-- =========================================================

BEGIN;

-- 1. CONVERSACIONES

CREATE TABLE IF NOT EXISTS public.crm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id text,
  company_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_conversations_id_org_unique
    UNIQUE (id, organization_id),

  CONSTRAINT crm_conversations_contact_fk
    FOREIGN KEY (organization_id, contact_id)
    REFERENCES public.crm_contacts(organization_id, id)
    ON DELETE SET NULL (contact_id),

  CONSTRAINT crm_conversations_company_fk
    FOREIGN KEY (organization_id, company_id)
    REFERENCES public.crm_companies(organization_id, id)
    ON DELETE SET NULL (company_id)
);

CREATE INDEX IF NOT EXISTS crm_conversations_org_last_message_idx
ON public.crm_conversations (organization_id, last_message_at DESC);

-- 2. PARTICIPANTES

CREATE TABLE IF NOT EXISTS public.crm_conversation_members (
  conversation_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (conversation_id, user_id),

  CONSTRAINT crm_conversation_members_conversation_fk
    FOREIGN KEY (conversation_id, organization_id)
    REFERENCES public.crm_conversations(id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS crm_conversation_members_user_idx
ON public.crm_conversation_members (organization_id, user_id);

-- 3. MENSAJES

CREATE TABLE IF NOT EXISTS public.crm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 5000
  ),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_messages_conversation_fk
    FOREIGN KEY (conversation_id, organization_id)
    REFERENCES public.crm_conversations(id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS crm_messages_conversation_created_idx
ON public.crm_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS crm_messages_org_created_idx
ON public.crm_messages (organization_id, created_at DESC);

-- 4. COMPROBAR PARTICIPACIÓN

CREATE OR REPLACE FUNCTION private.is_conversation_member(
  p_conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.crm_conversation_members cm
    JOIN public.crm_conversations c
      ON c.id = cm.conversation_id
     AND c.organization_id = cm.organization_id
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = (SELECT auth.uid())
      AND private.is_org_member(c.organization_id)
  );
$$;

REVOKE ALL ON FUNCTION private.is_conversation_member(uuid)
FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.is_conversation_member(uuid)
TO authenticated;

-- 5. SEGURIDAD RLS

ALTER TABLE public.crm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_conversations FROM anon, authenticated;
REVOKE ALL ON public.crm_conversation_members FROM anon, authenticated;
REVOKE ALL ON public.crm_messages FROM anon, authenticated;

GRANT SELECT ON public.crm_conversations TO authenticated;
GRANT SELECT ON public.crm_conversation_members TO authenticated;
GRANT SELECT ON public.crm_messages TO authenticated;

DROP POLICY IF EXISTS crm_conversations_select
ON public.crm_conversations;

CREATE POLICY crm_conversations_select
ON public.crm_conversations
FOR SELECT TO authenticated
USING (
  private.is_org_member(organization_id)
  AND private.is_conversation_member(id)
);

DROP POLICY IF EXISTS crm_conversation_members_select
ON public.crm_conversation_members;

CREATE POLICY crm_conversation_members_select
ON public.crm_conversation_members
FOR SELECT TO authenticated
USING (
  private.is_org_member(organization_id)
  AND private.is_conversation_member(conversation_id)
);

DROP POLICY IF EXISTS crm_messages_select
ON public.crm_messages;

CREATE POLICY crm_messages_select
ON public.crm_messages
FOR SELECT TO authenticated
USING (
  private.is_org_member(organization_id)
  AND private.is_conversation_member(conversation_id)
);

-- Las escrituras se realizan exclusivamente mediante RPC seguros.

-- 6. LISTAR INTEGRANTES DEL EQUIPO

CREATE OR REPLACE FUNCTION private.nexo_list_chat_members(
  p_organization_id uuid
)
RETURNS TABLE (
  member_user_id uuid,
  member_email text,
  member_role text,
  member_joined_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT private.is_org_member(p_organization_id)
  THEN
    RAISE EXCEPTION 'No tenés acceso a este equipo';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(u.email::text, ''),
    m.role::text,
    m.joined_at
  FROM public.organization_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = p_organization_id
  ORDER BY m.joined_at ASC;
END;
$$;

-- 7. CREAR O RECUPERAR CONVERSACIÓN DIRECTA

CREATE OR REPLACE FUNCTION private.nexo_start_direct_conversation(
  p_organization_id uuid,
  p_other_user_id uuid,
  p_contact_id text DEFAULT NULL,
  p_company_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_conversation_id uuid;
  v_company_id text := p_company_id;
  v_contact_company_id text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Tenés que iniciar sesión';
  END IF;

  IF NOT private.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No pertenecés a esta organización';
  END IF;

  IF p_other_user_id IS NULL
     OR p_other_user_id = v_user_id
  THEN
    RAISE EXCEPTION 'Seleccioná otro integrante del equipo';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = p_other_user_id
  ) THEN
    RAISE EXCEPTION 'El destinatario no pertenece a este equipo';
  END IF;

  IF p_contact_id IS NOT NULL THEN
    SELECT c.company_id
    INTO v_contact_company_id
    FROM public.crm_contacts c
    WHERE c.id = p_contact_id
      AND c.organization_id = p_organization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El contacto no pertenece a esta organización';
    END IF;

    IF v_company_id IS NULL THEN
      v_company_id := v_contact_company_id;
    ELSIF v_contact_company_id IS NOT NULL
       AND v_contact_company_id <> v_company_id
    THEN
      RAISE EXCEPTION 'El contacto no pertenece a la empresa seleccionada';
    END IF;
  END IF;

  IF v_company_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.crm_companies c
       WHERE c.id = v_company_id
         AND c.organization_id = p_organization_id
     )
  THEN
    RAISE EXCEPTION 'La empresa no pertenece a esta organización';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' ||
      LEAST(v_user_id::text, p_other_user_id::text) || ':' ||
      GREATEST(v_user_id::text, p_other_user_id::text),
      0
    )
  );

  SELECT c.id
  INTO v_conversation_id
  FROM public.crm_conversations c
  WHERE c.organization_id = p_organization_id
    AND EXISTS (
      SELECT 1
      FROM public.crm_conversation_members mine
      WHERE mine.conversation_id = c.id
        AND mine.user_id = v_user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.crm_conversation_members other_member
      WHERE other_member.conversation_id = c.id
        AND other_member.user_id = p_other_user_id
    )
    AND (
      SELECT COUNT(*)
      FROM public.crm_conversation_members participant
      WHERE participant.conversation_id = c.id
    ) = 2
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    UPDATE public.crm_conversations c
    SET
      contact_id = COALESCE(c.contact_id, p_contact_id),
      company_id = COALESCE(c.company_id, v_company_id)
    WHERE c.id = v_conversation_id;

    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.crm_conversations (
    organization_id,
    created_by,
    contact_id,
    company_id
  )
  VALUES (
    p_organization_id,
    v_user_id,
    p_contact_id,
    v_company_id
  )
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.crm_conversation_members (
    conversation_id,
    organization_id,
    user_id,
    last_read_at
  )
  VALUES
    (v_conversation_id, p_organization_id, v_user_id, now()),
    (v_conversation_id, p_organization_id, p_other_user_id, now());

  RETURN v_conversation_id;
END;
$$;

-- 8. LISTAR CONVERSACIONES

CREATE OR REPLACE FUNCTION private.nexo_list_conversations(
  p_organization_id uuid
)
RETURNS TABLE (
  conversation_id uuid,
  other_user_id uuid,
  other_user_email text,
  other_user_role text,
  contact_id text,
  contact_name text,
  company_id text,
  company_name text,
  last_message text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint,
  last_read_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL
     OR NOT private.is_org_member(p_organization_id)
  THEN
    RAISE EXCEPTION 'No tenés acceso a estas conversaciones';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    other_member.user_id,
    COALESCE(u.email::text, ''),
    other_member.role::text,
    c.contact_id,
    contact.name::text,
    c.company_id,
    company.name::text,
    latest.body,
    COALESCE(latest.created_at, c.created_at),
    latest.sender_id,
    (
      SELECT COUNT(*)::bigint
      FROM public.crm_messages unread
      WHERE unread.conversation_id = c.id
        AND unread.sender_id <> v_user_id
        AND unread.created_at > COALESCE(
          mine.last_read_at,
          'epoch'::timestamptz
        )
    ),
    mine.last_read_at
  FROM public.crm_conversations c
  JOIN public.crm_conversation_members mine
    ON mine.conversation_id = c.id
   AND mine.organization_id = c.organization_id
   AND mine.user_id = v_user_id
  JOIN public.crm_conversation_members other_member
    ON other_member.conversation_id = c.id
   AND other_member.organization_id = c.organization_id
   AND other_member.user_id <> v_user_id
  JOIN auth.users u
    ON u.id = other_member.user_id
  LEFT JOIN public.crm_contacts contact
    ON contact.id = c.contact_id
   AND contact.organization_id = c.organization_id
  LEFT JOIN public.crm_companies company
    ON company.id = c.company_id
   AND company.organization_id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT m.body, m.created_at, m.sender_id
    FROM public.crm_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) latest ON true
  WHERE c.organization_id = p_organization_id
    AND private.is_conversation_member(c.id)
  ORDER BY COALESCE(latest.created_at, c.created_at) DESC;
END;
$$;

-- 9. ENVIAR MENSAJES

CREATE OR REPLACE FUNCTION private.nexo_send_message(
  p_conversation_id uuid,
  p_body text
)
RETURNS TABLE (
  message_id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_organization_id uuid;
  v_body text := btrim(COALESCE(p_body, ''));
  v_message_id uuid;
  v_created_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Tenés que iniciar sesión';
  END IF;

  IF char_length(v_body) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'El mensaje debe tener entre 1 y 5000 caracteres';
  END IF;

  SELECT c.organization_id
  INTO v_organization_id
  FROM public.crm_conversations c
  WHERE c.id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT private.is_conversation_member(p_conversation_id)
     OR NOT private.is_org_member(v_organization_id)
  THEN
    RAISE EXCEPTION 'No tenés acceso a esta conversación';
  END IF;

  INSERT INTO public.crm_messages (
    conversation_id,
    organization_id,
    sender_id,
    body
  )
  VALUES (
    p_conversation_id,
    v_organization_id,
    v_user_id,
    v_body
  )
  RETURNING id, created_at
  INTO v_message_id, v_created_at;

  UPDATE public.crm_conversations
  SET last_message_at = v_created_at
  WHERE id = p_conversation_id;

  UPDATE public.crm_conversation_members
  SET last_read_at = v_created_at
  WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;

  RETURN QUERY
  SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at
  FROM public.crm_messages m
  WHERE m.id = v_message_id;
END;
$$;

-- 10. MARCAR CONVERSACIÓN COMO LEÍDA

CREATE OR REPLACE FUNCTION private.nexo_mark_conversation_read(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT private.is_conversation_member(p_conversation_id)
  THEN
    RAISE EXCEPTION 'No tenés acceso a esta conversación';
  END IF;

  UPDATE public.crm_conversation_members
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id
    AND user_id = (SELECT auth.uid());
END;
$$;

-- 11. FUNCIONES RPC PÚBLICAS

CREATE OR REPLACE FUNCTION public.nexo_list_chat_members(
  p_organization_id uuid
)
RETURNS TABLE (
  member_user_id uuid,
  member_email text,
  member_role text,
  member_joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.nexo_list_chat_members(p_organization_id);
$$;

CREATE OR REPLACE FUNCTION public.nexo_start_direct_conversation(
  p_organization_id uuid,
  p_other_user_id uuid,
  p_contact_id text DEFAULT NULL,
  p_company_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.nexo_start_direct_conversation(
    p_organization_id,
    p_other_user_id,
    p_contact_id,
    p_company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.nexo_list_conversations(
  p_organization_id uuid
)
RETURNS TABLE (
  conversation_id uuid,
  other_user_id uuid,
  other_user_email text,
  other_user_role text,
  contact_id text,
  contact_name text,
  company_id text,
  company_name text,
  last_message text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint,
  last_read_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.nexo_list_conversations(p_organization_id);
$$;

CREATE OR REPLACE FUNCTION public.nexo_send_message(
  p_conversation_id uuid,
  p_body text
)
RETURNS TABLE (
  message_id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.nexo_send_message(
    p_conversation_id,
    p_body
  );
$$;

CREATE OR REPLACE FUNCTION public.nexo_mark_conversation_read(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.nexo_mark_conversation_read(p_conversation_id);
$$;

-- 12. PERMISOS RPC

GRANT USAGE ON SCHEMA private TO authenticated;

REVOKE ALL ON FUNCTION
  private.nexo_list_chat_members(uuid),
  private.nexo_start_direct_conversation(uuid, uuid, text, text),
  private.nexo_list_conversations(uuid),
  private.nexo_send_message(uuid, text),
  private.nexo_mark_conversation_read(uuid)
FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  private.nexo_list_chat_members(uuid),
  private.nexo_start_direct_conversation(uuid, uuid, text, text),
  private.nexo_list_conversations(uuid),
  private.nexo_send_message(uuid, text),
  private.nexo_mark_conversation_read(uuid)
TO authenticated;

REVOKE ALL ON FUNCTION
  public.nexo_list_chat_members(uuid),
  public.nexo_start_direct_conversation(uuid, uuid, text, text),
  public.nexo_list_conversations(uuid),
  public.nexo_send_message(uuid, text),
  public.nexo_mark_conversation_read(uuid)
FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.nexo_list_chat_members(uuid),
  public.nexo_start_direct_conversation(uuid, uuid, text, text),
  public.nexo_list_conversations(uuid),
  public.nexo_send_message(uuid, text),
  public.nexo_mark_conversation_read(uuid)
TO authenticated;

-- 13. REALTIME

ALTER TABLE public.crm_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.crm_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
      AND puballtables = false
  ) THEN

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'crm_conversations'
    ) THEN
      EXECUTE
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversations';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'crm_messages'
    ) THEN
      EXECUTE
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages';
    END IF;

  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
