-- 1. Estado suspendido
ALTER TYPE public.account_status ADD VALUE IF NOT EXISTS 'suspended';

-- 2. Log de cambios de permisos
CREATE TABLE public.permission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  target_user_id uuid NOT NULL,
  action text NOT NULL,
  role public.app_role,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.permission_audit_log TO authenticated;
GRANT ALL ON public.permission_audit_log TO service_role;
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit log" ON public.permission_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert audit log" ON public.permission_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Proteger al último administrador
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'No se puede quitar el rol de Administrador: es el último administrador del sistema.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_last_admin_removal
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_removal();

-- Registrar automáticamente cambios de roles
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.permission_audit_log (actor_id, target_user_id, action, role)
    VALUES (auth.uid(), NEW.user_id, 'role_granted', NEW.role);
    RETURN NEW;
  ELSE
    INSERT INTO public.permission_audit_log (actor_id, target_user_id, action, role)
    VALUES (auth.uid(), OLD.user_id, 'role_revoked', OLD.role);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_log_role_change
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

-- Registrar cambios de estado de cuenta
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.permission_audit_log (actor_id, target_user_id, action, details)
    VALUES (auth.uid(), NEW.id, 'status_changed',
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- 4. Cotizaciones: archivar + historial
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE TABLE public.quotation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  actor_id uuid,
  owner_id uuid NOT NULL,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quotation_history_quotation ON public.quotation_history(quotation_id, created_at DESC);
GRANT SELECT, INSERT ON public.quotation_history TO authenticated;
GRANT ALL ON public.quotation_history TO service_role;
ALTER TABLE public.quotation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quotation history select" ON public.quotation_history
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_quotation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed jsonb := '{}'::jsonb;
  k text;
  old_j jsonb := to_jsonb(OLD);
  new_j jsonb := to_jsonb(NEW);
  act text := 'updated';
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.quotation_history (quotation_id, actor_id, owner_id, action)
    VALUES (NEW.id, auth.uid(), NEW.user_id, 'created');
    RETURN NEW;
  END IF;

  FOR k IN SELECT jsonb_object_keys(new_j) LOOP
    IF k IN ('updated_at') THEN CONTINUE; END IF;
    IF new_j -> k IS DISTINCT FROM old_j -> k THEN
      changed := changed || jsonb_build_object(k, jsonb_build_object('from', old_j -> k, 'to', new_j -> k));
    END IF;
  END LOOP;

  IF changed = '{}'::jsonb THEN RETURN NEW; END IF;

  IF NEW.archived IS DISTINCT FROM OLD.archived THEN
    act := CASE WHEN NEW.archived THEN 'archived' ELSE 'unarchived' END;
  END IF;

  INSERT INTO public.quotation_history (quotation_id, actor_id, owner_id, action, changes)
  VALUES (NEW.id, auth.uid(), NEW.user_id, act, changed);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_quotation_change
  AFTER INSERT OR UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.log_quotation_change();

-- 5. Configuración de empresa
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  logo_path text,
  company_name text,
  address text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  facebook text,
  tiktok text,
  linkedin text,
  primary_color text NOT NULL DEFAULT '#1F4636',
  accent_color text NOT NULL DEFAULT '#C4A264',
  footer_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company settings" ON public.company_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read company settings" ON public.company_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();