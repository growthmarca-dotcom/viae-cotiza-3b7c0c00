-- 1. Estados de registro (archivado en lugar de borrado)
DO $$ BEGIN
  CREATE TYPE public.record_status AS ENUM ('active','archived','inactive','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS record_status public.record_status NOT NULL DEFAULT 'active';

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS record_status public.record_status NOT NULL DEFAULT 'active';

-- 2. Invitación / vinculación de usuarios a agentes
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS invitation_status public.invitation_status,
  ADD COLUMN IF NOT EXISTS invitation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS agents_user_id_unique
  ON public.agents (user_id) WHERE user_id IS NOT NULL;

-- 3. Moneda base del sistema
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS analysis_currency text NOT NULL DEFAULT 'USD';

DO $$ BEGIN
  ALTER TABLE public.company_settings
    ADD CONSTRAINT company_settings_analysis_currency_check
    CHECK (analysis_currency IN ('ARS','USD'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Sin borrado definitivo de clientes, agentes ni oportunidades
REVOKE DELETE ON public.clients FROM authenticated;
REVOKE DELETE ON public.agents FROM authenticated;
REVOKE DELETE ON public.opportunities FROM authenticated;

-- 5. Auditoría
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read audit log" ON public.audit_log;
CREATE POLICY "admins read audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity, entity_id);

CREATE OR REPLACE FUNCTION public.tg_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action text;
  v_id uuid;
  v_changes jsonb := '{}'::jsonb;
  k text;
  oldj jsonb;
  newj jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_id := NEW.id;
    oldj := to_jsonb(OLD);
    newj := to_jsonb(NEW);
    FOR k IN SELECT jsonb_object_keys(newj) LOOP
      IF k = 'updated_at' THEN CONTINUE; END IF;
      IF newj -> k IS DISTINCT FROM oldj -> k THEN
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', oldj -> k, 'to', newj -> k));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;
    IF (newj ? 'record_status') AND (newj -> 'record_status' IS DISTINCT FROM oldj -> 'record_status') THEN
      v_action := 'status_changed';
    ELSIF (newj ? 'status') AND (newj -> 'status' IS DISTINCT FROM oldj -> 'status') THEN
      v_action := 'status_changed';
    ELSIF (newj ? 'archived') AND (newj -> 'archived' IS DISTINCT FROM oldj -> 'archived') THEN
      v_action := CASE WHEN (newj ->> 'archived') = 'true' THEN 'archived' ELSE 'unarchived' END;
    ELSIF (newj ? 'assigned_agent_id') AND (newj -> 'assigned_agent_id' IS DISTINCT FROM oldj -> 'assigned_agent_id') THEN
      v_action := 'agent_assigned';
    END IF;
  ELSE
    v_action := 'deleted';
    v_id := OLD.id;
  END IF;

  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_id, v_changes);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_clients ON public.clients;
CREATE TRIGGER trg_audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

DROP TRIGGER IF EXISTS trg_audit_quotations ON public.quotations;
CREATE TRIGGER trg_audit_quotations AFTER INSERT OR UPDATE OR DELETE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

DROP TRIGGER IF EXISTS trg_audit_agents ON public.agents;
CREATE TRIGGER trg_audit_agents AFTER INSERT OR UPDATE OR DELETE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

DROP TRIGGER IF EXISTS trg_audit_opportunities ON public.opportunities;
CREATE TRIGGER trg_audit_opportunities AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

DROP TRIGGER IF EXISTS trg_audit_company_settings ON public.company_settings;
CREATE TRIGGER trg_audit_company_settings AFTER INSERT OR UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- 6. Integridad referencial: nunca perder historial al archivar
DO $$ BEGIN
  ALTER TABLE public.opportunities
    ADD CONSTRAINT opportunities_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.opportunities
    ADD CONSTRAINT opportunities_quotation_id_fkey
    FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.opportunities
    ADD CONSTRAINT opportunities_assigned_agent_id_fkey
    FOREIGN KEY (assigned_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.quotations
    ADD CONSTRAINT quotations_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Los triggers de asignación deben registrar también quién vincula el usuario
CREATE OR REPLACE FUNCTION public.tg_agent_link_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL THEN
      NEW.linked_at := now();
      NEW.linked_by := auth.uid();
      NEW.access_status := 'linked';
    END IF;
  ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.linked_at := CASE WHEN NEW.user_id IS NULL THEN NULL ELSE now() END;
    NEW.linked_by := CASE WHEN NEW.user_id IS NULL THEN NULL ELSE auth.uid() END;
    IF NEW.user_id IS NOT NULL THEN
      NEW.access_status := 'linked';
      NEW.invitation_status := CASE WHEN OLD.invitation_status = 'pending' THEN 'accepted'::invitation_status ELSE NEW.invitation_status END;
    ELSIF NEW.access_status = 'linked' THEN
      NEW.access_status := 'none';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_agent_link_stamp ON public.agents;
CREATE TRIGGER trg_agent_link_stamp BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.tg_agent_link_stamp();

-- Marcar automáticamente las invitaciones vencidas al leerlas
CREATE OR REPLACE FUNCTION public.expire_stale_invitations()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH upd AS (
    UPDATE public.agents
    SET invitation_status = 'expired'
    WHERE invitation_status = 'pending'
      AND invitation_expires_at IS NOT NULL
      AND invitation_expires_at < now()
    RETURNING 1
  )
  SELECT count(*)::int FROM upd;
$function$;