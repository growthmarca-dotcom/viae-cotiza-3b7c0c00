ALTER TABLE public.smart_quotes
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS smart_quotes_share_token_key
  ON public.smart_quotes (share_token) WHERE share_token IS NOT NULL;

ALTER TABLE public.smart_quotes
  DROP CONSTRAINT IF EXISTS smart_quotes_share_token_format;
ALTER TABLE public.smart_quotes
  ADD CONSTRAINT smart_quotes_share_token_format
  CHECK (share_token IS NULL OR share_token ~ '^[a-f0-9]{32,64}$');

CREATE OR REPLACE FUNCTION public.smart_quote_share_token(_smart_quote_id uuid, _days integer DEFAULT 30)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
BEGIN
  IF NOT public.can_manage_smart_quote(_smart_quote_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT share_token INTO _token FROM public.smart_quotes WHERE id = _smart_quote_id;

  IF _token IS NULL THEN
    _token := encode(gen_random_bytes(20), 'hex');
  END IF;

  UPDATE public.smart_quotes
     SET share_token = _token,
         shared_at = COALESCE(shared_at, now()),
         share_expires_at = now() + make_interval(days => GREATEST(_days, 1))
   WHERE id = _smart_quote_id;

  RETURN _token;
END;
$$;

REVOKE ALL ON FUNCTION public.smart_quote_share_token(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.smart_quote_share_token(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.smart_quote_share_token(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.smart_quote_share_revoke(_smart_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_smart_quote(_smart_quote_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.smart_quotes
     SET share_token = NULL, shared_at = NULL, share_expires_at = NULL
   WHERE id = _smart_quote_id;
END;
$$;

REVOKE ALL ON FUNCTION public.smart_quote_share_revoke(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.smart_quote_share_revoke(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.smart_quote_share_revoke(uuid) TO service_role;