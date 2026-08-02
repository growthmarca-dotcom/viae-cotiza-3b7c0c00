-- v1.9.3 Fase A · Migración 1: reglas e historial de acuerdos + extensión de commercial_agreements

CREATE TYPE public.agreement_base AS ENUM ('gross', 'net', 'cost', 'margin');
CREATE TYPE public.agreement_party AS ENUM ('organization', 'agent', 'viae');
CREATE TYPE public.agreement_scope AS ENUM ('all', 'booking', 'booking_service', 'transport_service', 'quotation');

-- Extensión de commercial_agreements (todo nullable / con default, sin romper datos actuales)
ALTER TABLE public.commercial_agreements
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS party_type public.agreement_party,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS default_base public.agreement_base NOT NULL DEFAULT 'gross',
  ADD COLUMN IF NOT EXISTS excludes_taxes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS excludes_extras boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

UPDATE public.commercial_agreements
SET party_type = CASE WHEN agent_id IS NOT NULL THEN 'agent'::public.agreement_party
                      WHEN organization_id IS NOT NULL THEN 'organization'::public.agreement_party
                      ELSE 'viae'::public.agreement_party END
WHERE party_type IS NULL;

-- Reglas del acuerdo
CREATE TABLE public.agreement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.commercial_agreements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text,
  scope public.agreement_scope NOT NULL DEFAULT 'all',
  service_kind public.booking_service_kind,
  transport_service_type public.transport_service_type,
  provider_type public.provider_type,
  country text,
  state text,
  city text,
  base public.agreement_base NOT NULL DEFAULT 'gross',
  calc_type public.commission_type NOT NULL DEFAULT 'percentage',
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ARS',
  min_amount numeric,
  max_amount numeric,
  excludes_taxes boolean NOT NULL DEFAULT true,
  excludes_extras boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_until date,
  priority integer NOT NULL DEFAULT 100,
  status public.record_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreement_rules TO authenticated;
GRANT ALL ON public.agreement_rules TO service_role;
ALTER TABLE public.agreement_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agreement_rules_select" ON public.agreement_rules
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_operations(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "agreement_rules_insert" ON public.agreement_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());
CREATE POLICY "agreement_rules_update" ON public.agreement_rules
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agreement_rules_delete" ON public.agreement_rules
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_agreement_rules_agreement ON public.agreement_rules(agreement_id);
CREATE INDEX idx_agreement_rules_scope ON public.agreement_rules(scope, status);

CREATE TRIGGER set_agreement_rules_updated_at
  BEFORE UPDATE ON public.agreement_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Historial de acuerdos (append-only)
CREATE TABLE public.agreement_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.commercial_agreements(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.agreement_rules(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  from_status public.agreement_status,
  to_status public.agreement_status,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agreement_history TO authenticated;
GRANT ALL ON public.agreement_history TO service_role;
ALTER TABLE public.agreement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agreement_history_select" ON public.agreement_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_operations(auth.uid()) OR owner_id = auth.uid());

CREATE INDEX idx_agreement_history_agreement ON public.agreement_history(agreement_id, created_at DESC);

-- Registro automático de cambios de acuerdos y reglas
CREATE OR REPLACE FUNCTION public.tg_agreement_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'commercial_agreements' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.agreement_history(agreement_id, owner_id, actor_id, action, to_status, changes)
      VALUES (NEW.id, NEW.user_id, auth.uid(), 'agreement_created', NEW.status, to_jsonb(NEW));
    ELSE
      INSERT INTO public.agreement_history(agreement_id, owner_id, actor_id, action, from_status, to_status, changes)
      VALUES (NEW.id, NEW.user_id, auth.uid(),
              CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'agreement_status_changed' ELSE 'agreement_updated' END,
              OLD.status, NEW.status,
              jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.agreement_history(agreement_id, rule_id, owner_id, actor_id, action, changes)
    VALUES (OLD.agreement_id, NULL, OLD.user_id, auth.uid(), 'rule_deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;

  INSERT INTO public.agreement_history(agreement_id, rule_id, owner_id, actor_id, action, changes)
  VALUES (NEW.agreement_id, NEW.id, NEW.user_id, auth.uid(),
          CASE WHEN TG_OP = 'INSERT' THEN 'rule_created' ELSE 'rule_updated' END,
          to_jsonb(NEW));
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_agreement_history_agreements
  AFTER INSERT OR UPDATE ON public.commercial_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_agreement_history();

CREATE TRIGGER tg_agreement_history_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.agreement_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_agreement_history();