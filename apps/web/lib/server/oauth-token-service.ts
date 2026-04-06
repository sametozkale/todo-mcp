import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateAccessToken,
  hashOAuthAccessToken,
  hashOAuthAuthCode,
  verifyOAuthClientSecret,
  verifyPkceS256,
} from "@/lib/server/oauth-internal";

export type TokenExchangeSuccess = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
};

export type TokenExchangeError = { error: string; error_description?: string; status: number };

const ACCESS_TOKEN_TTL_SEC = 3600;

export async function exchangeAuthorizationCode(
  supabase: SupabaseClient,
  input: {
    code: string;
    redirect_uri: string;
    client_id: string;
    client_secret: string | null;
    code_verifier: string;
  },
): Promise<TokenExchangeSuccess | TokenExchangeError> {
  const { code, redirect_uri, client_id, client_secret, code_verifier } = input;

  if (!code_verifier || code_verifier.length < 43 || code_verifier.length > 128) {
    return {
      error: "invalid_request",
      error_description: "code_verifier must be between 43 and 128 characters.",
      status: 400,
    };
  }

  const { data: clientRow, error: clientErr } = await supabase
    .from("oauth_clients")
    .select("id, user_id, public_id, secret_hash, revoked_at")
    .eq("public_id", client_id)
    .maybeSingle();

  if (clientErr || !clientRow || clientRow.revoked_at) {
    return { error: "invalid_client", error_description: "Unknown or revoked client.", status: 401 };
  }

  if (!client_secret) {
    return { error: "invalid_client", error_description: "client_secret is required.", status: 401 };
  }

  if (!verifyOAuthClientSecret(client_secret, clientRow.secret_hash as string)) {
    return { error: "invalid_client", error_description: "Invalid client credentials.", status: 401 };
  }

  const codeHash = hashOAuthAuthCode(code);
  const { data: codeRow, error: codeErr } = await supabase
    .from("oauth_authorization_codes")
    .select("id, client_internal_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at, used_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (codeErr || !codeRow) {
    return { error: "invalid_grant", error_description: "Invalid or expired authorization code.", status: 400 };
  }

  if (codeRow.used_at) {
    return { error: "invalid_grant", error_description: "Authorization code already used.", status: 400 };
  }

  if (new Date(codeRow.expires_at as string).getTime() <= Date.now()) {
    return { error: "invalid_grant", error_description: "Authorization code expired.", status: 400 };
  }

  if (codeRow.client_internal_id !== clientRow.id) {
    return { error: "invalid_grant", error_description: "Code does not match client.", status: 400 };
  }

  if (codeRow.redirect_uri !== redirect_uri) {
    return { error: "invalid_grant", error_description: "redirect_uri mismatch.", status: 400 };
  }

  const method = String(codeRow.code_challenge_method ?? "").toUpperCase();
  if (method !== "S256") {
    return { error: "invalid_grant", error_description: "Unsupported code_challenge_method.", status: 400 };
  }

  if (!verifyPkceS256(code_verifier, codeRow.code_challenge as string)) {
    return { error: "invalid_grant", error_description: "PKCE verification failed.", status: 400 };
  }

  const plainToken = generateAccessToken();
  const tokenHash = hashOAuthAccessToken(plainToken);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SEC * 1000).toISOString();

  const { error: insertErr } = await supabase.from("oauth_access_tokens").insert({
    token_hash: tokenHash,
    user_id: codeRow.user_id,
    client_internal_id: codeRow.client_internal_id,
    scope: null,
    expires_at: expiresAt,
  });

  if (insertErr) {
    return { error: "server_error", error_description: "Could not issue token.", status: 500 };
  }

  await supabase.from("oauth_authorization_codes").update({ used_at: new Date().toISOString() }).eq("id", codeRow.id);

  return {
    access_token: plainToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SEC,
  };
}

export async function authUserIdFromOAuthAccessToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ userId: string | null; tokenRowId: string | null }> {
  const hash = hashOAuthAccessToken(token);
  const { data, error } = await supabase
    .from("oauth_access_tokens")
    .select("id, user_id, expires_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (error || !data) return { userId: null, tokenRowId: null };
  if (data.revoked_at) return { userId: null, tokenRowId: null };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) {
    return { userId: null, tokenRowId: null };
  }
  return { userId: data.user_id as string, tokenRowId: data.id as string };
}
