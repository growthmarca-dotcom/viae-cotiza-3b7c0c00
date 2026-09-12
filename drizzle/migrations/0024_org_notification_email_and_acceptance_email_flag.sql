-- v1.15 — Notificación por email al aceptar una propuesta pública.
-- Aditivo: no reemplaza organizations.email (contacto comercial).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS notification_email TEXT;

COMMENT ON COLUMN public.organizations.notification_email IS
  'Casilla interna de la organización para alertas del sistema. Distinta de email (contacto comercial).';

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_notification_email_format
  CHECK (
    notification_email IS NULL
    OR notification_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
  );

-- Marca de idempotencia del aviso de aceptación (una sola vez por propuesta).
ALTER TABLE public.smart_quotes
  ADD COLUMN IF NOT EXISTS acceptance_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.smart_quotes.acceptance_email_sent_at IS
  'Momento en que se envió el aviso interno de aceptación. NULL = no enviado.';
