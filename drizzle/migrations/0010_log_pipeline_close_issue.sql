-- Intervención 8 — Cierre del ciclo comercial en el Pipeline.
-- Registro auditable (mecanismo existente `audit_log`) cuando la reserva se
-- crea correctamente pero el cierre de la oportunidad como ganada falla.
-- No mueve etapas: eso sigue siendo responsabilidad de `moveOpportunityStage()`.
CREATE OR REPLACE FUNCTION public.log_pipeline_close_issue(
  _opportunity_id uuid,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING HINT = 'not_authenticated';
  END IF;

  SELECT organization_id INTO v_org
  FROM public.opportunities
  WHERE id = _opportunity_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Opportunity not found' USING HINT = 'not_found';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_member_of(auth.uid(), v_org)) THEN
    RAISE EXCEPTION 'Not allowed for this organization' USING HINT = 'not_allowed_for_organization';
  END IF;

  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(),
    'pipeline_close_failed',
    'opportunities',
    _opportunity_id,
    COALESCE(_details, '{}'::jsonb) || jsonb_build_object('organization_id', v_org)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_pipeline_close_issue(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_pipeline_close_issue(uuid, jsonb) TO authenticated;
