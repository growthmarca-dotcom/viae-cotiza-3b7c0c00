ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS quotation_number text;

CREATE SEQUENCE IF NOT EXISTS public.quotation_number_seq;

-- Backfill respetando created_at ascendente
WITH ordered AS (
  SELECT id, created_at, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.quotations
  WHERE quotation_number IS NULL
)
UPDATE public.quotations q
SET quotation_number = 'COT-' || to_char(o.created_at, 'YY') || '-' || lpad(o.rn::text, 6, '0')
FROM ordered o
WHERE q.id = o.id;

SELECT setval('public.quotation_number_seq', GREATEST((SELECT count(*) FROM public.quotations), 1));

CREATE OR REPLACE FUNCTION public.tg_quotation_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN
    NEW.quotation_number := 'COT-' || to_char(now(), 'YY') || '-' ||
      lpad(nextval('public.quotation_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotations_number ON public.quotations;
CREATE TRIGGER quotations_number BEFORE INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.tg_quotation_number();

ALTER TABLE public.quotations ALTER COLUMN quotation_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quotations_quotation_number_key ON public.quotations (quotation_number);