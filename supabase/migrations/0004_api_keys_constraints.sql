-- API keys: uniqueness + last_used_at default for consistent auditing

ALTER TABLE public.api_keys
  ALTER COLUMN last_used_at SET DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_unique ON public.api_keys (key_hash);

