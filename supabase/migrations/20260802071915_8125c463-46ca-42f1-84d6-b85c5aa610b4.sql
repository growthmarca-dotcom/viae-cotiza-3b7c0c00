DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'passenger_type') THEN
    CREATE TYPE public.passenger_type AS ENUM ('adult','child','infant','senior','other');
  END IF;
END $$;

ALTER TABLE public.booking_passengers
  ADD COLUMN IF NOT EXISTS passenger_type public.passenger_type NOT NULL DEFAULT 'adult';

CREATE INDEX IF NOT EXISTS booking_passengers_type_idx
  ON public.booking_passengers (booking_id, passenger_type)
  WHERE record_status = 'active';

CREATE OR REPLACE FUNCTION public.calculate_passenger_age(_birth_date date, _travel_date date DEFAULT current_date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _birth_date IS NULL OR _travel_date IS NULL THEN NULL
    WHEN _travel_date < _birth_date THEN NULL
    ELSE EXTRACT(YEAR FROM age(_travel_date, _birth_date))::int
  END
$$;