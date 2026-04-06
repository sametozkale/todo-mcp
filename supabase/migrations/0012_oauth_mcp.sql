-- OAuth 2.1 (authorization code + PKCE) for MCP HTTP / Claude Web custom connectors.

CREATE TABLE IF NOT EXISTS public.oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Claude Web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS oauth_clients_public_id_key ON public.oauth_clients (public_id);
CREATE INDEX IF NOT EXISTS oauth_clients_user_id_idx ON public.oauth_clients (user_id);

CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  client_internal_id UUID NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_auth_codes_client_idx ON public.oauth_authorization_codes (client_internal_id);
CREATE INDEX IF NOT EXISTS oauth_auth_codes_expires_idx ON public.oauth_authorization_codes (expires_at);

CREATE TABLE IF NOT EXISTS public.oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_internal_id UUID NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_access_tokens_user_idx ON public.oauth_access_tokens (user_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_expires_idx ON public.oauth_access_tokens (expires_at);

ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oauth_clients_select_own" ON public.oauth_clients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "oauth_clients_insert_own" ON public.oauth_clients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "oauth_clients_update_own" ON public.oauth_clients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "oauth_clients_delete_own" ON public.oauth_clients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "oauth_auth_codes_insert_own" ON public.oauth_authorization_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.oauth_clients c
      WHERE c.id = client_internal_id AND c.user_id = auth.uid() AND c.revoked_at IS NULL
    )
  );

-- Authorization codes and access tokens: service_role only (no SELECT/INSERT for anon/authenticated).
