
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS guest_first_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_last_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS nights INTEGER,
  ADD COLUMN IF NOT EXISTS pax_count INTEGER,
  ADD COLUMN IF NOT EXISTS accommodation_name TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_address TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_description TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_services TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
  ADD COLUMN IF NOT EXISTS price_per_night NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS taxes NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
