-- Intervención 2: respuesta del cliente desde el enlace público.
-- Aditivo: no altera el ciclo de estados ni los actores internos existentes.
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS client_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_response_note text,
  ADD COLUMN IF NOT EXISTS client_response_channel text;
