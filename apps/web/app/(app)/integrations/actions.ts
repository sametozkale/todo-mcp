"use server";

import { createClient } from "@/lib/supabase/server";
import crypto from "node:crypto";

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

  return { ok: true, apiKey, row: data as ApiKeyRow };
}

export async function listApiKeysAction(): Promise<ApiKeyRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("api_keys")
    .select("id, label, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as ApiKeyRow[];
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
  return { ok: true };
}

