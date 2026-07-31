DROP POLICY IF EXISTS "public share read" ON public.quotations;
REVOKE SELECT ON public.quotations FROM anon;