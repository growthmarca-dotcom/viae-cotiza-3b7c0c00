ALTER TABLE public.smart_quote_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.smart_quote_items
   SET title = coalesce(nullif(btrim(title), ''), item_type::text)
 WHERE title IS NULL OR btrim(title) = '';

ALTER TABLE public.smart_quote_items
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.smart_quote_items
  ADD CONSTRAINT smart_quote_items_title_not_blank CHECK (btrim(title) <> '');