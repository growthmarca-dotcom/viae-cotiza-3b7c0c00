ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS person_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS person_id uuid;
ALTER TABLE public.booking_passengers ADD COLUMN IF NOT EXISTS person_id uuid;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS person_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_person_id_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_person_id_fkey') THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_passengers_person_id_fkey') THEN
    ALTER TABLE public.booking_passengers ADD CONSTRAINT booking_passengers_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_person_id_fkey') THEN
    ALTER TABLE public.agents ADD CONSTRAINT agents_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_person_id ON public.clients(person_id);
CREATE INDEX IF NOT EXISTS idx_leads_person_id ON public.leads(person_id);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_person_id ON public.booking_passengers(person_id);
CREATE INDEX IF NOT EXISTS idx_agents_person_id ON public.agents(person_id);