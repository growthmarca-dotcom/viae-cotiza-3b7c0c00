ALTER POLICY "providers_select_auth" ON public.providers USING (public.is_approved(auth.uid()));
ALTER POLICY "stage config readable by members" ON public.opportunity_stage_config USING (public.is_approved(auth.uid()));
ALTER POLICY "agency_networks_read" ON public.agency_networks USING (public.is_approved(auth.uid()));