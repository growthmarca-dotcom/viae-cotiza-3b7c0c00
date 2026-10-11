ALTER TABLE public.pricing_rules ADD CONSTRAINT pricing_rules_value_nonneg CHECK (value >= 0);
ALTER TABLE public.pricing_rules ADD CONSTRAINT pricing_rules_min_qty_pos CHECK (min_quantity IS NULL OR min_quantity >= 1);

DROP POLICY IF EXISTS pricing_profiles_staff_read ON public.product_pricing_profiles;
CREATE POLICY pricing_profiles_staff_read ON public.product_pricing_profiles FOR SELECT TO authenticated
  USING ((public.is_operations(auth.uid()) OR public.has_role(auth.uid(),'agent'::app_role)) AND public.can_read_product(product_id));
DROP POLICY IF EXISTS pricing_rules_staff_read ON public.pricing_rules;
CREATE POLICY pricing_rules_staff_read ON public.pricing_rules FOR SELECT TO authenticated
  USING ((public.is_operations(auth.uid()) OR public.has_role(auth.uid(),'agent'::app_role))
    AND EXISTS (SELECT 1 FROM public.product_pricing_profiles p WHERE p.id = pricing_profile_id AND public.can_read_product(p.product_id)));

-- Cálculo noche por noche (entrada incluida, salida excluida). SECURITY INVOKER: respeta RLS.
CREATE OR REPLACE FUNCTION public.accommodation_rate_quote(_product_id uuid, _unit_id uuid, _from date, _to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  d date; nights jsonb := '[]'::jsonb; missing jsonb := '[]'::jsonb; conflicts jsonb := '[]'::jsonb;
  total numeric := 0; currencies text[] := '{}'; min_req int := 0; n int;
  cands record; cnt int; lvl text; chosen text;
BEGIN
  IF _from IS NULL OR _to IS NULL OR _to <= _from THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_dates');
  END IF;
  n := _to - _from;
  IF NOT EXISTS (SELECT 1 FROM product_pricing_profiles p JOIN pricing_rules r ON r.pricing_profile_id=p.id
                 WHERE p.product_id=_product_id AND p.status='active' AND r.active AND r.rule_type='fixed') THEN
    RETURN jsonb_build_object('ok', false, 'has_rates', false, 'nights_count', n);
  END IF;
  d := _from;
  WHILE d < _to LOOP
    cnt := 0; chosen := NULL;
    FOREACH lvl IN ARRAY (CASE WHEN _unit_id IS NULL THEN ARRAY['general'] ELSE ARRAY['unit','general'] END) LOOP
      SELECT count(*) INTO cnt FROM product_pricing_profiles p JOIN pricing_rules r ON r.pricing_profile_id=p.id
       WHERE p.product_id=_product_id AND p.status='active' AND r.active AND r.rule_type='fixed'
         AND (p.valid_from IS NULL OR p.valid_from <= d) AND (p.valid_until IS NULL OR p.valid_until >= d)
         AND CASE WHEN lvl='unit' THEN p.product_variant_id=_unit_id ELSE p.product_variant_id IS NULL END;
      IF cnt > 0 THEN chosen := lvl; EXIT; END IF;
    END LOOP;
    IF cnt = 0 THEN
      missing := missing || to_jsonb(d);
    ELSIF cnt > 1 THEN
      conflicts := conflicts || to_jsonb(d);
    ELSE
      SELECT p.id, p.name, p.currency, r.value, coalesce(r.min_quantity,1) AS mq INTO cands
        FROM product_pricing_profiles p JOIN pricing_rules r ON r.pricing_profile_id=p.id
       WHERE p.product_id=_product_id AND p.status='active' AND r.active AND r.rule_type='fixed'
         AND (p.valid_from IS NULL OR p.valid_from <= d) AND (p.valid_until IS NULL OR p.valid_until >= d)
         AND CASE WHEN chosen='unit' THEN p.product_variant_id=_unit_id ELSE p.product_variant_id IS NULL END;
      nights := nights || jsonb_build_object('date', d, 'price', cands.value, 'currency', cands.currency,
        'period_id', cands.id, 'period_name', cands.name, 'level', chosen);
      total := total + cands.value;
      IF NOT (cands.currency = ANY(currencies)) THEN currencies := currencies || cands.currency; END IF;
      min_req := greatest(min_req, cands.mq);
    END IF;
    d := d + 1;
  END LOOP;
  RETURN jsonb_build_object(
    'has_rates', true, 'nights_count', n, 'nights', nights, 'missing', missing, 'conflicts', conflicts,
    'total', total, 'currency', CASE WHEN array_length(currencies,1)=1 THEN currencies[1] END,
    'mixed_currency', coalesce(array_length(currencies,1),0) > 1,
    'min_stay', min_req, 'min_stay_ok', n >= min_req,
    'ok', jsonb_array_length(missing)=0 AND jsonb_array_length(conflicts)=0
          AND coalesce(array_length(currencies,1),0) = 1 AND n >= min_req);
END $$;
REVOKE EXECUTE ON FUNCTION public.accommodation_rate_quote(uuid,uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accommodation_rate_quote(uuid,uuid,date,date) TO authenticated;