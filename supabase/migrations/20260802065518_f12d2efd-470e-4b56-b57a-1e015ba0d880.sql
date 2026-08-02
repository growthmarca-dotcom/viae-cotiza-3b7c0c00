-- 1. enum estado de comisión
DO $$ BEGIN
  CREATE TYPE public.commission_status AS ENUM ('simulated','accrued','approved','settled','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. tabla commissions (vacía; sin devengo automático)
CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'simulated',
  -- contraparte
  party_type public.agreement_party,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  -- origen económico
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  booking_service_id uuid REFERENCES public.booking_services(id) ON DELETE SET NULL,
  transport_service_id uuid REFERENCES public.transport_services(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  -- snapshot del acuerdo / regla
  agreement_id uuid REFERENCES public.commercial_agreements(id) ON DELETE SET NULL,
  agreement_version integer,
  rule_id uuid REFERENCES public.agreement_rules(id) ON DELETE SET NULL,
  agreement_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- cálculo
  base public.agreement_base NOT NULL,
  calc_type public.commission_type NOT NULL,
  calc_value numeric NOT NULL,
  base_amount numeric,
  commission_amount numeric,
  currency text NOT NULL DEFAULT 'ARS',
  exchange_rate numeric,
  exchange_rate_date date,
  exchange_rate_source public.rate_source NOT NULL DEFAULT 'manual',
  -- auditoría
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid,
  notes text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- anti-duplicados: una comisión efectiva por acuerdo/entidad (no aplica a simulaciones)
CREATE UNIQUE INDEX IF NOT EXISTS commissions_unique_effective
  ON public.commissions (entity, entity_id, agreement_id, COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status <> 'cancelled' AND status <> 'simulated';
CREATE INDEX IF NOT EXISTS commissions_owner_idx ON public.commissions (user_id, status);
CREATE INDEX IF NOT EXISTS commissions_agent_idx ON public.commissions (agent_id);
CREATE INDEX IF NOT EXISTS commissions_org_idx ON public.commissions (organization_id);

GRANT SELECT ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions_admin_all" ON public.commissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "commissions_operations_select" ON public.commissions
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()));

CREATE POLICY "commissions_agent_select_own" ON public.commissions
  FOR SELECT TO authenticated
  USING (agent_id IS NOT NULL AND agent_id = public.current_agent_id());

CREATE TRIGGER commissions_set_updated_at BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- inmutabilidad de comisiones liquidadas
CREATE OR REPLACE FUNCTION public.tg_commission_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'settled' THEN
    RAISE EXCEPTION 'Una comisión liquidada no puede modificarse ni eliminarse.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;

CREATE TRIGGER commissions_immutable BEFORE UPDATE OR DELETE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_commission_immutable();

-- 3. historial de comisiones independiente (preparado, sin uso todavía)
CREATE TABLE IF NOT EXISTS public.commission_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid REFERENCES public.commissions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  from_status public.commission_status,
  to_status public.commission_status,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.commission_history TO authenticated;
GRANT ALL ON public.commission_history TO service_role;
ALTER TABLE public.commission_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_history_admin_select" ON public.commission_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_operations(auth.uid()));

-- 4. resolve_agreement: elige acuerdo + regla más específica y vigente
CREATE OR REPLACE FUNCTION public.resolve_agreement(
  _owner uuid,
  _organization_id uuid DEFAULT NULL,
  _agent_id uuid DEFAULT NULL,
  _scope public.agreement_scope DEFAULT 'booking_service',
  _service_kind public.booking_service_kind DEFAULT NULL,
  _transport_type public.transport_service_type DEFAULT NULL,
  _country text DEFAULT NULL,
  _state text DEFAULT NULL,
  _city text DEFAULT NULL,
  _date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  agreement_id uuid,
  agreement_version integer,
  rule_id uuid,
  base public.agreement_base,
  calc_type public.commission_type,
  calc_value numeric,
  currency text,
  excludes_taxes boolean,
  excludes_extras boolean,
  min_amount numeric,
  max_amount numeric,
  score integer,
  agreement_snapshot jsonb,
  rule_snapshot jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    a.id,
    a.version,
    r.id,
    COALESCE(r.base, a.default_base),
    COALESCE(r.calc_type, a.commission_type, 'percentage')::public.commission_type,
    COALESCE(r.value, a.commission_value, 0),
    COALESCE(r.currency, a.currency, 'ARS'),
    COALESCE(r.excludes_taxes, a.excludes_taxes),
    COALESCE(r.excludes_extras, a.excludes_extras),
    r.min_amount,
    r.max_amount,
    (
      CASE WHEN r.id IS NULL THEN 0 ELSE 100 END
      + CASE WHEN r.service_kind IS NOT NULL AND r.service_kind = _service_kind THEN 40 ELSE 0 END
      + CASE WHEN r.transport_service_type IS NOT NULL AND r.transport_service_type = _transport_type THEN 40 ELSE 0 END
      + CASE WHEN r.city IS NOT NULL AND lower(r.city) = lower(_city) THEN 30 ELSE 0 END
      + CASE WHEN r.state IS NOT NULL AND lower(r.state) = lower(_state) THEN 20 ELSE 0 END
      + CASE WHEN r.country IS NOT NULL AND lower(r.country) = lower(_country) THEN 10 ELSE 0 END
      + CASE WHEN _agent_id IS NOT NULL AND a.agent_id = _agent_id THEN 15 ELSE 0 END
      + CASE WHEN _organization_id IS NOT NULL AND a.organization_id = _organization_id THEN 15 ELSE 0 END
      + COALESCE(r.priority, 0) + COALESCE(a.priority, 0)
    )::int AS score,
    to_jsonb(a) AS agreement_snapshot,
    COALESCE(to_jsonb(r), '{}'::jsonb) AS rule_snapshot
  FROM public.commercial_agreements a
  LEFT JOIN public.agreement_rules r
    ON r.agreement_id = a.id
   AND r.status = 'active'
   AND (r.valid_from IS NULL OR r.valid_from <= _date)
   AND (r.valid_until IS NULL OR r.valid_until >= _date)
   AND (r.scope = 'all' OR r.scope = _scope)
   AND (r.service_kind IS NULL OR r.service_kind = _service_kind)
   AND (r.transport_service_type IS NULL OR r.transport_service_type = _transport_type)
   AND (r.country IS NULL OR lower(r.country) = lower(COALESCE(_country, r.country)))
   AND (r.state IS NULL OR lower(r.state) = lower(COALESCE(_state, r.state)))
   AND (r.city IS NULL OR lower(r.city) = lower(COALESCE(_city, r.city)))
  WHERE a.user_id = _owner
    AND a.status = 'active'
    AND (a.valid_from IS NULL OR a.valid_from <= _date)
    AND (a.valid_until IS NULL OR a.valid_until >= _date)
    AND (
      (_organization_id IS NOT NULL AND a.organization_id = _organization_id)
      OR (_agent_id IS NOT NULL AND a.agent_id = _agent_id)
    )
  ORDER BY score DESC, a.version DESC, a.created_at DESC
  LIMIT 1;
$$;

-- 5. compute_commission: cálculo puro
CREATE OR REPLACE FUNCTION public.compute_commission(
  _gross numeric,
  _taxes numeric,
  _extras numeric,
  _discount numeric,
  _cost numeric,
  _base public.agreement_base,
  _calc_type public.commission_type,
  _value numeric,
  _min_amount numeric DEFAULT NULL,
  _max_amount numeric DEFAULT NULL,
  _excludes_taxes boolean DEFAULT true,
  _excludes_extras boolean DEFAULT false
)
RETURNS TABLE(base_amount numeric, commission_amount numeric, warnings jsonb)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  g numeric := COALESCE(_gross, 0);
  t numeric := COALESCE(_taxes, 0);
  x numeric := COALESCE(_extras, 0);
  d numeric := COALESCE(_discount, 0);
  c numeric := COALESCE(_cost, 0);
  net numeric;
  b numeric;
  amt numeric;
  w jsonb := '[]'::jsonb;
BEGIN
  net := g - d - (CASE WHEN _excludes_taxes THEN t ELSE 0 END)
              - (CASE WHEN _excludes_extras THEN x ELSE 0 END);

  b := CASE _base
         WHEN 'gross'  THEN g
         WHEN 'net'    THEN net
         WHEN 'cost'   THEN c
         WHEN 'margin' THEN net - c
       END;

  IF _gross IS NULL AND _base IN ('gross','net','margin') THEN
    w := w || jsonb_build_array('Falta el importe de venta para calcular la base.');
  END IF;
  IF _cost IS NULL AND _base IN ('cost','margin') THEN
    w := w || jsonb_build_array('Falta el costo del proveedor para calcular la base.');
  END IF;
  IF b IS NOT NULL AND b < 0 THEN
    w := w || jsonb_build_array('La base de cálculo resultó negativa.');
  END IF;

  amt := CASE
    WHEN b IS NULL OR _value IS NULL THEN NULL
    WHEN _calc_type = 'percentage' THEN round(b * _value / 100.0, 2)
    ELSE round(_value, 2)
  END;

  IF amt IS NOT NULL AND _min_amount IS NOT NULL AND amt < _min_amount THEN
    amt := _min_amount;
    w := w || jsonb_build_array('Se aplicó el mínimo definido en la regla.');
  END IF;
  IF amt IS NOT NULL AND _max_amount IS NOT NULL AND amt > _max_amount THEN
    amt := _max_amount;
    w := w || jsonb_build_array('Se aplicó el máximo definido en la regla.');
  END IF;

  RETURN QUERY SELECT round(b, 2), amt, w;
END; $$;

-- 6. simulate_commission: sólo lectura, no escribe en commissions
CREATE OR REPLACE FUNCTION public.simulate_commission(_booking_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_ops boolean;
  v_agent_id uuid;
  s RECORD;
  e RECORD;
  b RECORD;
  ra RECORD;
  cc RECORD;
  v_gross numeric; v_taxes numeric; v_extras numeric; v_discount numeric; v_cost numeric;
  v_currency text;
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
  IF public.has_role(v_uid, 'provider') AND NOT public.is_operations(v_uid) THEN
    RAISE EXCEPTION 'Sin acceso a la simulación de comisiones.';
  END IF;
  v_admin := public.has_role(v_uid, 'admin');
  v_ops := public.is_operations(v_uid);
  v_agent_id := public.current_agent_id();

  SELECT * INTO s FROM public.booking_services WHERE id = _booking_service_id;
  IF s.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO b FROM public.bookings WHERE id = s.booking_id;
  SELECT * INTO e FROM public.booking_service_economics WHERE booking_service_id = s.id;

  IF NOT (v_admin OR v_ops OR (v_agent_id IS NOT NULL AND b.assigned_agent_id = v_agent_id) OR s.user_id = v_uid) THEN
    RAISE EXCEPTION 'Sin acceso a la simulación de esta reserva.';
  END IF;

  v_gross := COALESCE(e.gross_sale_amount, s.sale_amount);
  v_taxes := COALESCE(e.taxes_amount, b.taxes_amount, 0);
  v_extras := COALESCE(e.extras_amount, b.extras_amount, 0);
  v_discount := COALESCE(e.discount_amount, 0);
  v_cost := COALESCE(e.cost_amount, s.cost_amount);
  v_currency := COALESCE(e.sale_currency, s.sale_currency, b.currency, 'ARS');

  SELECT * INTO ra FROM public.resolve_agreement(
    s.user_id,
    COALESCE(s.organization_id, b.organization_id),
    b.assigned_agent_id,
    'booking_service'::public.agreement_scope,
    s.kind,
    NULL,
    b.destination, NULL, NULL,
    COALESCE(s.service_date, b.travel_start, CURRENT_DATE)
  );

  IF ra.agreement_id IS NULL THEN
    RETURN jsonb_build_object(
      'found', true, 'has_agreement', false,
      'booking_service_id', s.id, 'booking_id', s.booking_id,
      'currency', v_currency,
      'warnings', jsonb_build_array('No hay un acuerdo comercial vigente que aplique a este servicio.')
    );
  END IF;

  SELECT * INTO cc FROM public.compute_commission(
    v_gross, v_taxes, v_extras, v_discount, v_cost,
    ra.base, ra.calc_type, ra.calc_value, ra.min_amount, ra.max_amount,
    ra.excludes_taxes, ra.excludes_extras
  );

  v_out := jsonb_build_object(
    'found', true,
    'has_agreement', true,
    'simulation', true,
    'booking_service_id', s.id,
    'booking_id', s.booking_id,
    'service_kind', s.kind,
    'agreement_id', ra.agreement_id,
    'agreement_version', ra.agreement_version,
    'agreement_title', ra.agreement_snapshot ->> 'title',
    'rule_id', ra.rule_id,
    'rule_label', ra.rule_snapshot ->> 'label',
    'base', ra.base,
    'calc_type', ra.calc_type,
    'calc_value', ra.calc_value,
    'excludes_taxes', ra.excludes_taxes,
    'excludes_extras', ra.excludes_extras,
    'currency', COALESCE(ra.currency, v_currency),
    'sale_currency', v_currency,
    'commission_amount', cc.commission_amount,
    'warnings', cc.warnings,
    'score', ra.score
  );

  -- agente: resumen sin costos ni márgenes ni base detallada
  IF v_admin THEN
    v_out := v_out || jsonb_build_object(
      'gross_sale_amount', v_gross,
      'taxes_amount', v_taxes,
      'extras_amount', v_extras,
      'discount_amount', v_discount,
      'cost_amount', v_cost,
      'base_amount', cc.base_amount
    );
  ELSIF v_ops THEN
    v_out := v_out || jsonb_build_object(
      'gross_sale_amount', v_gross,
      'taxes_amount', v_taxes,
      'extras_amount', v_extras,
      'discount_amount', v_discount,
      'base_amount', CASE WHEN ra.base IN ('cost','margin') THEN NULL ELSE cc.base_amount END,
      'restricted', true
    );
  ELSE
    v_out := v_out || jsonb_build_object('restricted', true, 'summary_only', true);
  END IF;

  RETURN v_out;
END; $$;

-- 7. simulate_commission_transport: preparado, sólo lectura (no altera transporte)
CREATE OR REPLACE FUNCTION public.simulate_commission_transport(_transport_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_ops boolean;
  ts RECORD;
  ra RECORD;
  cc RECORD;
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
  v_admin := public.has_role(v_uid, 'admin');
  v_ops := public.is_operations(v_uid);
  IF NOT (v_admin OR v_ops) THEN
    RAISE EXCEPTION 'Sin acceso a la simulación de comisiones de transporte.';
  END IF;

  SELECT * INTO ts FROM public.transport_services WHERE id = _transport_service_id;
  IF ts.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;

  SELECT * INTO ra FROM public.resolve_agreement(
    ts.user_id, ts.organization_id, NULL,
    'transport_service'::public.agreement_scope,
    NULL, ts.service_type,
    ts.country, ts.state, ts.city,
    COALESCE(ts.service_date, CURRENT_DATE)
  );

  IF ra.agreement_id IS NULL THEN
    RETURN jsonb_build_object('found', true, 'has_agreement', false, 'simulation', true,
      'transport_service_id', ts.id, 'currency', COALESCE(ts.sale_currency, 'ARS'),
      'warnings', jsonb_build_array('No hay un acuerdo comercial vigente que aplique a este servicio.'));
  END IF;

  SELECT * INTO cc FROM public.compute_commission(
    ts.sale_amount, 0, 0, 0, ts.cost_amount,
    ra.base, ra.calc_type, ra.calc_value, ra.min_amount, ra.max_amount,
    ra.excludes_taxes, ra.excludes_extras
  );

  v_out := jsonb_build_object(
    'found', true, 'has_agreement', true, 'simulation', true,
    'transport_service_id', ts.id,
    'agreement_id', ra.agreement_id,
    'agreement_version', ra.agreement_version,
    'agreement_title', ra.agreement_snapshot ->> 'title',
    'rule_id', ra.rule_id,
    'rule_label', ra.rule_snapshot ->> 'label',
    'base', ra.base, 'calc_type', ra.calc_type, 'calc_value', ra.calc_value,
    'currency', COALESCE(ra.currency, ts.sale_currency, 'ARS'),
    'sale_currency', COALESCE(ts.sale_currency, 'ARS'),
    'commission_amount', cc.commission_amount,
    'warnings', cc.warnings
  );

  IF v_admin THEN
    v_out := v_out || jsonb_build_object(
      'gross_sale_amount', ts.sale_amount, 'cost_amount', ts.cost_amount, 'base_amount', cc.base_amount);
  ELSE
    v_out := v_out || jsonb_build_object(
      'gross_sale_amount', ts.sale_amount, 'restricted', true,
      'base_amount', CASE WHEN ra.base IN ('cost','margin') THEN NULL ELSE cc.base_amount END);
  END IF;

  RETURN v_out;
END; $$;

REVOKE ALL ON FUNCTION public.resolve_agreement(uuid,uuid,uuid,public.agreement_scope,public.booking_service_kind,public.transport_service_type,text,text,text,date) FROM anon;
REVOKE ALL ON FUNCTION public.simulate_commission(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.simulate_commission_transport(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.simulate_commission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_commission_transport(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_commission(numeric,numeric,numeric,numeric,numeric,public.agreement_base,public.commission_type,numeric,numeric,numeric,boolean,boolean) TO authenticated;