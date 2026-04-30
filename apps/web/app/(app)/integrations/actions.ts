"use server";

import { createClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
import { listApiKeysForCurrentUser } from "@/lib/server/api-keys";
import {
  generateOAuthClientId,
  generateOAuthClientSecret,
  hashOAuthClientSecret,
} from "@/lib/server/oauth-internal";
import type { OAuthClientRow } from "@/lib/server/oauth-clients";
import { listOAuthClientsForCurrentUser } from "@/lib/server/oauth-clients";
import { getPostHogClient } from "@/lib/posthog";

export type { OAuthClientRow } from "@/lib/server/oauth-clients";

export type ApiKeyRow = {
  id: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string | null;
};

function getPepper(): string {
  return process.env.YALP_API_KEY_PEPPER ?? "";
}

function hashApiKey(apiKey: string): string {
  const hasValidPrefix = apiKey.startsWith("yalp_");
  if (!hasValidPrefix || apiKey.length < 20) {
    throw new Error("Invalid API key format.");
  }
  return crypto
    .createHash("sha256")
    .update(`${apiKey}.${getPepper()}`)
    .digest("hex");
}

function generatePlaintextKey(): string {
  const raw = crypto.randomBytes(24).toString("base64url");
  return `yalp_${raw}`;
}

export type CreateApiKeyResult =
  | { ok: true; apiKey: string; row: ApiKeyRow }
  | { ok: false; error: string };

export async function createApiKeyAction(label?: string): Promise<CreateApiKeyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  let apiKey = "";
  let key_hash = "";
  for (let i = 0; i < 3; i += 1) {
    apiKey = generatePlaintextKey();
    key_hash = hashApiKey(apiKey);
    const { data: exists } = await supabase
      .from("api_keys")
      .select("id")
      .eq("key_hash", key_hash)
      .maybeSingle();
    if (!exists) break;
  }
  const trimmedLabel = (label ?? "").trim() || "MCP Key";

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      key_hash,
      label: trimmedLabel,
    })
    .select("id, label, last_used_at, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create API key." };
  }

  getPostHogClient().capture({
    distinctId: user.id,
    event: "api_key_created",
    properties: { label: trimmedLabel },
  });

  return { ok: true, apiKey, row: data as ApiKeyRow };
}

const QUICK_CONNECT_LABEL = "Quick connect";

/**
 * One auto-generated key for MCP setup: replaces any previous rows with the same label so the
 * list does not accumulate duplicates (plaintext is only ever shown once; DB stores hash only).
 * Client also dedupes via sessionStorage + in-flight promise.
 */
export async function ensureInstallKeyForSetupAction(): Promise<CreateApiKeyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error: deleteError } = await supabase
    .from("api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("label", QUICK_CONNECT_LABEL);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  return createApiKeyAction(QUICK_CONNECT_LABEL);
}

export async function listApiKeysAction(): Promise<ApiKeyRow[]> {
  return listApiKeysForCurrentUser();
}

export type RevokeApiKeyResult = { ok: true } | { ok: false; error: string };

export async function revokeApiKeyAction(id: string): Promise<RevokeApiKeyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  getPostHogClient().capture({
    distinctId: user.id,
    event: "api_key_revoked",
  });

  return { ok: true };
}

export type CreateOAuthClientResult =
  | { ok: true; clientId: string; clientSecret: string; row: OAuthClientRow }
  | { ok: false; error: string };

export async function listOAuthClientsAction(): Promise<OAuthClientRow[]> {
  return listOAuthClientsForCurrentUser();
}

/**
 * One-time display of `clientSecret` — same pattern as API keys (store hash only).
 */
export async function createClaudeWebOAuthClientAction(name?: string): Promise<CreateOAuthClientResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const trimmedName = (name ?? "").trim() || "Claude Web";
  const clientId = generateOAuthClientId();
  const clientSecret = generateOAuthClientSecret();
  const secretHash = hashOAuthClientSecret(clientSecret);

  const { data, error } = await supabase
    .from("oauth_clients")
    .insert({
      user_id: user.id,
      public_id: clientId,
      secret_hash: secretHash,
      name: trimmedName,
    })
    .select("id, public_id, name, created_at, revoked_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create OAuth client." };
  }

  getPostHogClient().capture({
    distinctId: user.id,
    event: "oauth_client_created",
    properties: { name: trimmedName },
  });

  return {
    ok: true,
    clientId: data.public_id as string,
    clientSecret,
    row: data as OAuthClientRow,
  };
}

export type RevokeOAuthClientResult = { ok: true } | { ok: false; error: string };

export async function revokeOAuthClientAction(id: string): Promise<RevokeOAuthClientResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("oauth_clients")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

