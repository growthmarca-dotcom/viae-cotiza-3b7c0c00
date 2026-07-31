-- ============ ENUMS ============
CREATE TYPE public.booking_status AS ENUM (
  'pending', 'confirmed', 'in_progress', 'reserved', 'voucher_issued', 'completed', 'cancelled'
);

CREATE TYPE public.booking_document_kind AS ENUM (
  'voucher', 'receipt', 'invoice', 'other'
);

CREATE TYPE public.booking_payment_kind AS ENUM ('deposit', 'balance', 'other');
CREATE TYPE public.booking_payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded', 'cancelled');

-- ============ NUMERACIÓN ============
CREATE SEQUENCE public.booking_number_seq START 1;

-- ============ RESERVAS ============
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  quotation_id uuid REFERENCES public.quotations(id),
  assigned_agent_id uuid REFERENCES public.agents(id),
  status public.booking_status NOT NULL DEFAULT 'pending',
  travel_start date,
  travel_end date,
  destination text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric,
  notes text,
  -- Relación preparada para el futuro módulo de proveedores.
  provider_id uuid,
  provider_name text,
  provider_reference text,
  provider_notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bookings_origin_required CHECK (opportunity_id IS NOT NULL OR quotation_id IS NOT NULL)
);

CREATE INDEX bookings_client_idx ON public.bookings (client_id);
CREATE INDEX bookings_opportunity_idx ON public.bookings (opportunity_id);
CREATE INDEX bookings_quotation_idx ON public.bookings (quotation_id);
CREATE INDEX bookings_agent_idx ON public.bookings (assigned_agent_id);

GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own bookings all" ON public.bookings FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (auth.uid() = user_id AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "admins read all bookings" ON public.bookings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update all bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "assigned agent reads bookings" ON public.bookings FOR SELECT TO authenticated
  USING (assigned_agent_id IS NOT NULL AND assigned_agent_id = public.current_agent_id());

-- Número correlativo automático
CREATE OR REPLACE FUNCTION public.tg_booking_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
    NEW.booking_number := 'RES-' || lpad(nextval('public.booking_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.bookings ALTER COLUMN booking_number DROP NOT NULL;
CREATE TRIGGER bookings_number BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_booking_number();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER bookings_audit AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- ============ LÍNEA DE TIEMPO DE ESTADOS ============
CREATE TABLE public.booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  actor_id uuid,
  from_status public.booking_status,
  to_status public.booking_status NOT NULL,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX booking_status_history_booking_idx ON public.booking_status_history (booking_id);

GRANT SELECT ON public.booking_status_history TO authenticated;
GRANT ALL ON public.booking_status_history TO service_role;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking history select" ON public.booking_status_history FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.assigned_agent_id = public.current_agent_id())
  );

CREATE OR REPLACE FUNCTION public.tg_booking_status_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_status_history (booking_id, owner_id, actor_id, from_status, to_status, comment)
    VALUES (NEW.id, NEW.user_id, auth.uid(), NULL, NEW.status, 'Reserva creada');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_status_history (booking_id, owner_id, actor_id, from_status, to_status)
    VALUES (NEW.id, NEW.user_id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_status_history AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_booking_status_history();

-- ============ DOCUMENTACIÓN (estructura preparada) ============
CREATE TABLE public.booking_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind public.booking_document_kind NOT NULL DEFAULT 'other',
  title text NOT NULL,
  file_path text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX booking_documents_booking_idx ON public.booking_documents (booking_id);

GRANT SELECT, INSERT, UPDATE ON public.booking_documents TO authenticated;
GRANT ALL ON public.booking_documents TO service_role;
ALTER TABLE public.booking_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own booking documents" ON public.booking_documents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read booking documents" ON public.booking_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "assigned agent reads booking documents" ON public.booking_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.assigned_agent_id = public.current_agent_id()));

CREATE TRIGGER booking_documents_updated_at BEFORE UPDATE ON public.booking_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PAGOS (estructura preparada) ============
CREATE TABLE public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind public.booking_payment_kind NOT NULL DEFAULT 'deposit',
  status public.booking_payment_status NOT NULL DEFAULT 'pending',
  method text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric,
  due_date date,
  paid_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX booking_payments_booking_idx ON public.booking_payments (booking_id);

GRANT SELECT, INSERT, UPDATE ON public.booking_payments TO authenticated;
GRANT ALL ON public.booking_payments TO service_role;
ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own booking payments" ON public.booking_payments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read booking payments" ON public.booking_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "assigned agent reads booking payments" ON public.booking_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.assigned_agent_id = public.current_agent_id()));

CREATE TRIGGER booking_payments_updated_at BEFORE UPDATE ON public.booking_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();