-- WhatsApp Cloud API: profile link fields + one-time link tokens (service role only)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_linked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.whatsapp_phone IS 'E.164 with leading + when linked via WhatsApp.';
COMMENT ON COLUMN public.profiles.whatsapp_linked IS 'True after successful LINK: token flow from WhatsApp.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_phone_unique_when_linked
  ON public.profiles (whatsapp_phone)
  WHERE whatsapp_linked = TRUE AND whatsapp_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_link_tokens IS 'One-time tokens for wa.me account linking; use service role only.';

ALTER TABLE public.whatsapp_link_tokens ENABLE ROW LEVEL SECURITY;

-- No GRANT to anon/authenticated: only service_role (bypasses RLS) or direct Postgres for migrations.
