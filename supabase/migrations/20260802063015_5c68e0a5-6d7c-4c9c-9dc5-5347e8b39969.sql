-- v1.9.3 Fase A · Migración 2: normalización económica (estructura, sin cálculo)

CREATE TYPE public.rate_source AS ENUM ('manual', 'snapshot', 'api', 'inherited');

-- Campos económicos opcionales en bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS sale_amount numeric,
  ADD COLUMN IF NOT EXISTS sale_currency text,
  ADD COLUMN IF NOT EXISTS cost_amount numeric,
  ADD COLUMN IF NOT EXISTS cost_currency text,
  ADD COLUMN IF NOT EXISTS taxes_amount numeric,
  ADD COLUMN IF NOT EXISTS extras_amount numeric,
  ADD COLUMN IF NOT EXISTS applied_exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS applied_rate_date date,
  ADD COLUMN IF NOT EXISTS applied_rate_source public.rate_source;

-- Campos económicos opcionales en booking_services
ALTER TABLE public.booking_services
  ADD COLUMN IF NOT EXISTS sale_amount numeric,
  ADD COLUMN IF NOT EXISTS sale_currency text,
  ADD COLUMN IF NOT EXISTS cost_amount numeric,
  ADD COLUMN IF NOT EXISTS cost_currency text,
  ADD COLUMN IF NOT EXISTS applied_exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS applied_rate_date date,
  ADD COLUMN IF NOT EXISTS applied_rate_source public.rate_source;

-- Desglose económico por servicio de reserva
CREATE TABLE public.booking_service_economics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_service_id uuid NOT NULL UNIQUE REFERENCES public.booking_services(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  provider_id uuid REFERENCES public.providers(id),
  gross_sale_amount numeric,
  taxes_amount numeric NOT NULL DEFAULT 0,
  extras_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  sale_currency text NOT NULL DEFAULT 'ARS',
  cost_amount numeric,
  cost_currency text NOT NULL DEFAULT 'ARS',
  exchange_rate numeric,
  exchange_rate_date date,
  exchange_rate_source public.rate_source NOT NULL DEFAULT 'manual',
  net_sale_amount numeric GENERATED ALWAYS AS (
    COALESCE(gross_sale_amount, 0) - COALESCE(taxes_amount, 0)
      - COALESCE(extras_amount, 0) - COALESCE(discount_amount, 0)
  ) STORED,
  margin_amount numeric GENERATED ALWAYS AS (
    COALESCE(gross_sale_amount, 0) - COALESCE(taxes_amount, 0)
      - COALESCE(extras_amount, 0) - COALESCE(discount_amount, 0) - COALESCE(cost_amount, 0)
  ) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.booking_service_economics TO authenticated;
GRANT ALL ON public.booking_service_economics TO service_role;
ALTER TABLE public.booking_service_economics ENABLE ROW LEVEL SECURITY;

-- Costos y márgenes: sólo Administración y Operaciones
CREATE POLICY "bse_select_admin_ops" ON public.booking_service_economics
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "bse_insert_admin_ops" ON public.booking_service_economics
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "bse_update_admin_ops" ON public.booking_service_economics
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_operations(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_operations(auth.uid()));

CREATE INDEX idx_bse_booking ON public.booking_service_economics(booking_id);
CREATE INDEX idx_bse_org ON public.booking_service_economics(organization_id);

CREATE TRIGGER set_bse_updated_at
  BEFORE UPDATE ON public.booking_service_economics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();