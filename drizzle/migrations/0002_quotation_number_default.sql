GRANT USAGE, SELECT ON SEQUENCE public.quotation_number_seq TO authenticated, service_role;

ALTER TABLE public.quotations
  ALTER COLUMN quotation_number
  SET DEFAULT 'COT-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.quotation_number_seq')::text, 6, '0');