ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text;

ALTER TYPE public.opportunity_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.opportunity_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.opportunity_status ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS exchange_rate numeric;

DROP TRIGGER IF EXISTS tg_clients_updated_at ON public.clients;
CREATE TRIGGER tg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();