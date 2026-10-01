ALTER TABLE public.quotations ADD COLUMN promotions jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.quotations
  SET promotions = jsonb_build_array(jsonb_build_object('promotion_id', promotion_id, 'title', promotion_title, 'text', promotion_text))
  WHERE promotion_title IS NOT NULL OR promotion_text IS NOT NULL;
COMMENT ON COLUMN public.quotations.promotions IS 'Copia de las promociones incorporadas: [{promotion_id|null, title, text}]';
COMMENT ON COLUMN public.quotations.promotion_id IS 'DEPRECATED: replaced by promotions';
COMMENT ON COLUMN public.quotations.promotion_title IS 'DEPRECATED: replaced by promotions';
COMMENT ON COLUMN public.quotations.promotion_text IS 'DEPRECATED: replaced by promotions';