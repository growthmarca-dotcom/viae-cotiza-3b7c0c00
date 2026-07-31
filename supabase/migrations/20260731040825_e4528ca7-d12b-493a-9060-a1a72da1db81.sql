ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS other_charges numeric;

CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role app_role := CASE WHEN TG_OP = 'DELETE' THEN OLD.role ELSE OLD.role END;
BEGIN
  IF v_role = 'admin' THEN
    IF OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'No puedes quitarte a ti mismo el rol de Administrador. Pídeselo a otro administrador.';
    END IF;
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'No se puede quitar el rol de Administrador: es el último administrador del sistema.';
    END IF;
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_update ON public.user_roles;
CREATE TRIGGER trg_prevent_last_admin_update
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
WHEN (OLD.role = 'admin' AND NEW.role IS DISTINCT FROM OLD.role)
EXECUTE FUNCTION public.prevent_last_admin_removal();

CREATE OR REPLACE FUNCTION public.claim_admin_if_none()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para recuperar el acceso de administrador.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Ya existe al menos un administrador en el sistema.';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles SET status = 'approved' WHERE id = v_uid AND status <> 'approved';

  INSERT INTO public.permission_audit_log (actor_id, target_user_id, action, role, details)
  VALUES (v_uid, v_uid, 'admin_recovered', 'admin', jsonb_build_object('reason', 'sistema sin administradores'));

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_admin_if_none() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_none() TO authenticated;

CREATE OR REPLACE FUNCTION public.admins_exist()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
$function$;

REVOKE ALL ON FUNCTION public.admins_exist() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admins_exist() TO authenticated;