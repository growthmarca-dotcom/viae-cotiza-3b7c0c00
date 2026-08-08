-- FASE 1A.2 · 1) Guardia de autenticación/rol en ensure_provider_organization
CREATE OR REPLACE FUNCTION public.ensure_provider_organization(_provider_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p RECORD; v_org uuid; v_uid uuid := auth.uid();
BEGIN
  -- Endurecimiento v1A.2: exige sesión y rol operativo (admin u operations),
  -- alineado con el gating de la ficha de proveedor en la UI.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.is_operations(v_uid) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO p FROM public.providers WHERE id = _provider_id;
  IF p.id IS NULL THEN RETURN NULL; END IF;
  IF p.organization_id IS NOT NULL THEN RETURN p.organization_id; END IF;

  SELECT o.id INTO v_org FROM public.organizations o
  WHERE (p.tax_id IS NOT NULL AND p.tax_id <> '' AND lower(o.tax_id) = lower(p.tax_id))
     OR lower(o.trade_name) = lower(p.trade_name)
  LIMIT 1;

  IF v_org IS NULL THEN
    INSERT INTO public.organizations (user_id, trade_name, legal_name, tax_id, tax_condition,
                                      country, state, city, address, phone, whatsapp, email,
                                      website, contact_name, notes)
    VALUES (p.user_id, p.trade_name, p.legal_name, NULLIF(p.tax_id,''), p.tax_condition,
            p.country, p.state, p.city, p.address, p.phone, p.whatsapp, p.email,
            p.website, p.contact_name, p.notes)
    RETURNING id INTO v_org;
  END IF;

  INSERT INTO public.organization_roles (organization_id, role) VALUES (v_org, 'provider')
  ON CONFLICT DO NOTHING;
  UPDATE public.providers SET organization_id = v_org WHERE id = p.id;
  RETURN v_org;
END; $function$;

-- FASE 1A.2 · 2) REVOKE selectivo de EXECUTE a anon/PUBLIC.
-- Lista explícita, revisada función por función. NO se incluye
-- booking_public_tracking (pública por diseño: /seguimiento/$token).
DO $do$
DECLARE
  names text[] := ARRAY[
    -- helpers de autorización y resolución (requieren sesión para ser útiles)
    'can_create_opportunity_for_organization','can_manage_availability_profile',
    'can_manage_organization_members','can_manage_package','can_manage_package_template',
    'can_manage_pricing_profile','can_manage_search_request','can_manage_search_result',
    'can_manage_smart_quote','can_read_package','can_read_package_template',
    'can_read_search_request','can_read_search_result','can_read_smart_quote',
    'currency_rate_at','current_agent_id','ensure_provider_organization','has_org_role',
    'is_member_of','is_operations','mark_notifications_read','notify_operations_team',
    'provider_in_package_template','resolve_opportunity_organization',
    'resolve_smart_quote_organization','smart_quote_share_revoke','smart_quote_share_token',
    'sync_booking_client_status',
    -- funciones de trigger (solo deben ejecutarse desde triggers)
    'log_quotation_change','log_role_change','log_status_change','prevent_last_admin_removal',
    'tg_agreement_history','tg_audit_branding_change','tg_audit_checklist',
    'tg_audit_communication_event','tg_audit_incident','tg_booking_operations',
    'tg_booking_require_organization','tg_booking_service_events',
    'tg_booking_smart_quote_same_org','tg_booking_status_history','tg_lead_comment_activity',
    'tg_lead_history','tg_lead_notifications','tg_notify_transport_events',
    'tg_opportunity_guard_update','tg_opportunity_history','tg_opportunity_require_organization',
    'tg_quotation_opportunity_same_org','tg_quotation_require_organization',
    'tg_quotation_smart_quote_same_org','tg_resource_availability_log',
    'tg_resource_catalog_audit','tg_seed_booking_checklist','tg_smart_quote_coherence',
    'tg_smart_quote_currency_propagate','tg_smart_quote_guard_update',
    'tg_smart_quote_item_currency','tg_smart_quote_normalize_currency',
    'tg_smart_quote_pricing_currency','tg_smart_quote_recalc_total',
    'tg_smart_quote_require_organization','tg_smart_quote_version_number',
    'tg_sync_booking_client_status','tg_timeline_booking_documents',
    'tg_timeline_booking_payments','tg_timeline_booking_services','tg_timeline_bookings',
    'tg_timeline_checklist','tg_timeline_communication','tg_timeline_incidents',
    'tg_transport_communication_events','tg_transport_economics_audit',
    'tg_transport_service_history','tg_validate_currency_exchange_rate'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', r.sig);
  END LOOP;
END $do$;