-- Intervención 3: una cotización genera como máximo una reserva.
-- Aditivo: no altera columnas ni datos; hoy no existen duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_quotation_id_unique
  ON public.bookings (quotation_id)
  WHERE quotation_id IS NOT NULL;