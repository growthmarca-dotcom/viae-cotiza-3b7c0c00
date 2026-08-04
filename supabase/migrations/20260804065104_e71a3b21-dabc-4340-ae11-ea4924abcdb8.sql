ALTER TABLE public.smart_quote_items ALTER COLUMN currency DROP NOT NULL;
ALTER TABLE public.smart_quote_items ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE public.smart_quote_pricing ALTER COLUMN currency DROP NOT NULL;
ALTER TABLE public.smart_quote_pricing ALTER COLUMN currency DROP DEFAULT;