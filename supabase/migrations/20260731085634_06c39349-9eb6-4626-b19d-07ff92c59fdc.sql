CREATE POLICY "operations read profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.is_operations(auth.uid()));

CREATE POLICY "operations read user roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.is_operations(auth.uid()));