-- Miembros de una agencia leen el detalle de los registros de su agencia
-- (las cabeceras ya eran visibles por is_member_of; los hijos no).
CREATE OR REPLACE FUNCTION public.member_of_booking_org(_booking_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM bookings b WHERE b.id = _booking_id
    AND b.organization_id IS NOT NULL AND is_member_of(auth.uid(), b.organization_id))
$$;
CREATE OR REPLACE FUNCTION public.member_of_quotation_org(_quotation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM quotations q WHERE q.id = _quotation_id
    AND q.organization_id IS NOT NULL AND is_member_of(auth.uid(), q.organization_id))
$$;
CREATE OR REPLACE FUNCTION public.member_of_opportunity_org(_opportunity_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM opportunities o WHERE o.id = _opportunity_id
    AND o.organization_id IS NOT NULL AND is_member_of(auth.uid(), o.organization_id))
$$;
CREATE OR REPLACE FUNCTION public.member_of_lead_org(_lead_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM leads l WHERE l.id = _lead_id
    AND l.organization_id IS NOT NULL AND is_member_of(auth.uid(), l.organization_id))
$$;
REVOKE EXECUTE ON FUNCTION public.member_of_booking_org(uuid), public.member_of_quotation_org(uuid), public.member_of_opportunity_org(uuid), public.member_of_lead_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_of_booking_org(uuid), public.member_of_quotation_org(uuid), public.member_of_opportunity_org(uuid), public.member_of_lead_org(uuid) TO authenticated;

CREATE POLICY quotation_items_org_member_all ON public.quotation_items FOR ALL TO authenticated
  USING (member_of_quotation_org(quotation_id)) WITH CHECK (member_of_quotation_org(quotation_id));
CREATE POLICY quotation_history_org_member_select ON public.quotation_history FOR SELECT TO authenticated
  USING (member_of_quotation_org(quotation_id));
CREATE POLICY opportunity_history_org_member_select ON public.opportunity_history FOR SELECT TO authenticated
  USING (member_of_opportunity_org(opportunity_id));
CREATE POLICY lead_history_org_member_select ON public.lead_history FOR SELECT TO authenticated
  USING (member_of_lead_org(lead_id));
CREATE POLICY booking_services_org_member_select ON public.booking_services FOR SELECT TO authenticated
  USING (member_of_booking_org(booking_id));
CREATE POLICY booking_timeline_org_member_select ON public.booking_timeline FOR SELECT TO authenticated
  USING (member_of_booking_org(booking_id));
CREATE POLICY booking_passengers_org_member_select ON public.booking_passengers FOR SELECT TO authenticated
  USING (member_of_booking_org(booking_id));
CREATE POLICY booking_payments_org_member_select ON public.booking_payments FOR SELECT TO authenticated
  USING (member_of_booking_org(booking_id));
CREATE POLICY booking_documents_org_member_select ON public.booking_documents FOR SELECT TO authenticated
  USING (member_of_booking_org(booking_id));
CREATE POLICY booking_checklist_org_member_select ON public.booking_checklist_items FOR SELECT TO authenticated
  USING (member_of_booking_org(booking_id));
CREATE POLICY booking_incidents_org_member_select ON public.booking_incidents FOR SELECT TO authenticated
  USING (member_of_booking_org(booking_id));