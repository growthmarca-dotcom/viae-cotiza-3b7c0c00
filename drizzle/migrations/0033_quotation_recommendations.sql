ALTER TABLE public.quotations
  ADD COLUMN recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN recommendation_interests jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.quotations.recommendations IS 'Sugerencias de venta cruzada (no suman al total): [{product_id, title, description, destination}]';
COMMENT ON COLUMN public.quotations.recommendation_interests IS 'Registro de "Me interesa" del cliente: [{product_id, title, at}]';