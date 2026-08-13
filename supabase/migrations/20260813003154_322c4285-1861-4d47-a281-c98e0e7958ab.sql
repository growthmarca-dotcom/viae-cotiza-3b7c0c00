DO $$ BEGIN
  CREATE TYPE public.quotation_item_category AS ENUM ('accommodation','excursion','vehicle_rental','transfer','insurance','flight','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS quotations_lead_id_idx ON public.quotations(lead_id);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  category public.quotation_item_category NOT NULL,
  title text NOT NULL,
  description text,
  provider_name text,
  service_date date,
  end_date date,
  time_label text,
  origin text,
  destination text,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  pax_count integer,
  unit_amount numeric NOT NULL DEFAULT 0 CHECK (unit_amount >= 0),
  taxes numeric NOT NULL DEFAULT 0 CHECK (taxes >= 0),
  notes text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotation_items_quotation_idx ON public.quotation_items(quotation_id, category, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_items TO authenticated;
GRANT ALL ON public.quotation_items TO service_role;

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own quotation items all" ON public.quotation_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_items.quotation_id AND q.user_id = auth.uid() AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(),'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_items.quotation_id AND q.user_id = auth.uid() AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "admins manage quotation items" ON public.quotation_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "assigned agent reads quotation items" ON public.quotation_items FOR SELECT TO authenticated
USING (public.current_agent_id() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.opportunities o WHERE o.quotation_id = quotation_items.quotation_id AND o.assigned_agent_id = public.current_agent_id()
));

CREATE TRIGGER quotation_items_set_updated_at BEFORE UPDATE ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();