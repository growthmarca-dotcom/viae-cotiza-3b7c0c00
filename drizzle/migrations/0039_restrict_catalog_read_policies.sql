ALTER POLICY "currencies_select_authenticated" ON public.currencies USING (public.is_approved(auth.uid()));
ALTER POLICY "product_categories_read" ON public.product_categories USING (public.is_approved(auth.uid()));
ALTER POLICY "cer_select_authenticated" ON public.currency_exchange_rates USING (public.is_approved(auth.uid()));