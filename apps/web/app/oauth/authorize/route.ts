import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateAuthorizationCode,
  hashOAuthAuthCode,
  isAllowedOAuthRedirectUri,
} from "@/lib/server/oauth-internal";

function oauthErrorRedirect(
  redirect_uri: string | null,
  state: string | null,
  error: string,
  error_description?: string,
) {
  if (redirect_uri && isAllowedOAuthRedirectUri(redirect_uri)) {
    const r = new URL(redirect_uri);
    r.searchParams.set("error", error);
    if (error_description) r.searchParams.set("error_description", error_description);
    if (state) r.searchParams.set("state", state);
    return NextResponse.redirect(r);
  }
  return NextResponse.json({ error, error_description }, { status: 400 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response_type = url.searchParams.get("response_type");
  const client_id = url.searchParams.get("client_id");
  const redirect_uri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const code_challenge = url.searchParams.get("code_challenge");
  const code_challenge_method = url.searchParams.get("code_challenge_method")?.toUpperCase() ?? "";

  if (response_type !== "code") {
    return oauthErrorRedirect(redirect_uri, state, "unsupported_response_type", "Only `code` is supported.");
  }
  if (!client_id || !redirect_uri || !code_challenge || code_challenge_method !== "S256") {
    return oauthErrorRedirect(
      redirect_uri,
      state,
      "invalid_request",
      "Missing client_id, redirect_uri, code_challenge, or code_challenge_method=S256.",
    );
  }
  if (!isAllowedOAuthRedirectUri(redirect_uri)) {
    return oauthErrorRedirect(redirect_uri, state, "invalid_request", "redirect_uri is not allowed for this server.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("next", `/oauth/authorize${url.search}`);
    return NextResponse.redirect(login);
  }

  const { data: clientRow } = await supabase
    .from("oauth_clients")
    .select("id, user_id, revoked_at")
    .eq("public_id", client_id)
    .maybeSingle();

  if (!clientRow || clientRow.revoked_at || clientRow.user_id !== user.id) {
    return oauthErrorRedirect(redirect_uri, state, "invalid_client", "Unknown client or wrong signed-in account.");
  }

  const code = generateAuthorizationCode();
  const codeHash = hashOAuthAuthCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insErr } = await supabase.from("oauth_authorization_codes").insert({
    code_hash: codeHash,
    client_internal_id: clientRow.id,
    user_id: user.id,
    redirect_uri,
    code_challenge,
    code_challenge_method: "S256",
    expires_at: expiresAt,
  });

  if (insErr) {
    return oauthErrorRedirect(redirect_uri, state, "server_error", "Could not create authorization code.");
  }

  const r = new URL(redirect_uri);
  r.searchParams.set("code", code);
  if (state) r.searchParams.set("state", state);
  return NextResponse.redirect(r);
}
