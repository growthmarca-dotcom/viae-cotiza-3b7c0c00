DO $$ BEGIN
  CREATE TYPE public.trip_type AS ENUM ('vacation','family','adventure','honeymoon','corporate','getaway','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS trip_type public.trip_type,
  ADD COLUMN IF NOT EXISTS services_interest text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nights_count integer,
  ADD COLUMN IF NOT EXISTS days_count integer,
  ADD COLUMN IF NOT EXISTS adults_count integer,
  ADD COLUMN IF NOT EXISTS children_count integer,
  ADD COLUMN IF NOT EXISTS children_ages text,
  ADD COLUMN IF NOT EXISTS commercial_notes text;