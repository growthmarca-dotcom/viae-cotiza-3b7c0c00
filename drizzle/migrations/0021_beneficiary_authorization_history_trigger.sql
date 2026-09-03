-- ---------------------------------------------------------------------
-- El historial de autorizaciones de beneficiarios debe quedar garantizado
-- a nivel de base de datos y no depender de que la escritura pase por la
-- RPC. Se agrega un trigger que registra alta y cambios de estado, y se
-- quitan los INSERT manuales de historial de las RPCs para no duplicar.
-- No cambia ninguna regla de negocio ni el cálculo de comisiones.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_beneficiary_auth_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commission_beneficiary_authorization_history
      (authorization_id, beneficiary_type, beneficiary_id, action, actor_id, reason, notes)
    VALUES (NEW.id, NEW.beneficiary_type, NEW.beneficiary_id,
            (NEW.status::text)::public.beneficiary_authorization_action,
            COALESCE(auth.uid(), NEW.authorized_by), NEW.reason, NEW.notes);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.commission_beneficiary_authorization_history
      (authorization_id, beneficiary_type, beneficiary_id, action, actor_id, reason, notes)
    VALUES (NEW.id, NEW.beneficiary_type, NEW.beneficiary_id,
            (NEW.status::text)::public.beneficiary_authorization_action,
            COALESCE(auth.uid(), NEW.revoked_by, NEW.authorized_by), NEW.reason, NEW.notes);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS beneficiary_auth_history ON public.commission_beneficiary_authorizations;
CREATE TRIGGER beneficiary_auth_history
  AFTER INSERT OR UPDATE ON public.commission_beneficiary_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_beneficiary_auth_history();

-- RPC autorizar: idéntica, sin el INSERT manual de historial.
CREATE OR REPLACE FUNCTION public.authorize_commission_beneficiary(
  _beneficiary_type public.agreement_party,
  _beneficiary_id uuid,
  _reason text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  org_id uuid;
  auth_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _beneficiary_type NOT IN ('agent', 'organization') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_beneficiary_type');
  END IF;

  IF _beneficiary_type = 'agent' THEN
    IF NOT EXISTS (SELECT 1 FROM public.agents WHERE id = _beneficiary_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'agent_not_found');
    END IF;
    IF EXISTS (SELECT 1 FROM public.agents WHERE id = _beneficiary_id AND user_id = uid) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'self_authorization_forbidden');
    END IF;
    SELECT NULL::uuid INTO org_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _beneficiary_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'organization_not_found');
    END IF;
    IF public.is_member_of(uid, _beneficiary_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'self_authorization_forbidden');
    END IF;
    org_id := _beneficiary_id;
  END IF;

  SELECT id INTO auth_id
    FROM public.commission_beneficiary_authorizations
   WHERE beneficiary_type = _beneficiary_type
     AND beneficiary_id = _beneficiary_id
     AND status = 'authorized';

  IF auth_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'created', false, 'authorization_id', auth_id);
  END IF;

  INSERT INTO public.commission_beneficiary_authorizations
    (organization_id, beneficiary_type, beneficiary_id, status,
     authorized_at, authorized_by, reason, notes)
  VALUES (org_id, _beneficiary_type, _beneficiary_id, 'authorized',
          now(), uid, NULLIF(btrim(COALESCE(_reason, '')), ''), NULLIF(btrim(COALESCE(_notes, '')), ''))
  RETURNING id INTO auth_id;

  RETURN jsonb_build_object('ok', true, 'created', true, 'authorization_id', auth_id);
END;
$$;

-- RPC revocar: idéntica, sin el INSERT manual de historial.
CREATE OR REPLACE FUNCTION public.revoke_commission_beneficiary(
  _beneficiary_type public.agreement_party,
  _beneficiary_id uuid,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  auth_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  SELECT id INTO auth_id
    FROM public.commission_beneficiary_authorizations
   WHERE beneficiary_type = _beneficiary_type
     AND beneficiary_id = _beneficiary_id
     AND status = 'authorized';

  IF auth_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_authorization');
  END IF;

  UPDATE public.commission_beneficiary_authorizations
     SET status = 'revoked',
         revoked_at = now(),
         revoked_by = uid,
         reason = btrim(_reason)
   WHERE id = auth_id;

  RETURN jsonb_build_object('ok', true, 'authorization_id', auth_id);
END;
$$;