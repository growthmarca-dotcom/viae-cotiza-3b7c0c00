ALTER TABLE public.smart_quotes ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.smart_quotes
  DROP CONSTRAINT IF EXISTS smart_quotes_date_range_check;

ALTER TABLE public.smart_quotes
  ADD CONSTRAINT smart_quotes_date_range_check
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);