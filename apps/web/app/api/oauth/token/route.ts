import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server/mcp-tools";
import { exchangeAuthorizationCode } from "@/lib/server/oauth-token-service";

function parseBasicAuth(header: string | null): { id: string; secret: string } | null {
  if (!header?.toLowerCase().startsWith("basic ")) return null;
  try {
    const raw = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const i = raw.indexOf(":");
    if (i === -1) return null;
    return { id: raw.slice(0, i), secret: raw.slice(i + 1) };
  } catch {
    return null;
  }
}

async function parseBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const j = (await req.json()) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    } catch {
      return {};
    }
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export async function POST(req: Request) {
  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json(
      { error: "server_error", error_description: "OAuth is not configured." },
      { status: 503 },
    );
  }

  const body = await parseBody(req);
  const grant_type = body.grant_type ?? "";

  if (grant_type !== "authorization_code") {
    return NextResponse.json(
      { error: "unsupported_grant_type", error_description: "Only authorization_code is supported." },
      { status: 400 },
    );
  }

  const code = body.code ?? "";
  const redirect_uri = body.redirect_uri ?? "";
  let client_id = body.client_id ?? "";
  let client_secret = body.client_secret ?? null;

  const basic = parseBasicAuth(req.headers.get("authorization"));
  if (basic) {
    client_id = basic.id;
    client_secret = basic.secret;
  }

  const code_verifier = body.code_verifier ?? "";

  if (!code || !redirect_uri || !client_id) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing code, redirect_uri, or client_id." },
      { status: 400 },
    );
  }

  const result = await exchangeAuthorizationCode(supabase, {
    code,
    redirect_uri,
    client_id,
    client_secret,
    code_verifier,
  });

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: result.error, error_description: result.error_description },
      { status: result.status },
    );
  }

  const ok = result as { access_token: string; token_type: "Bearer"; expires_in: number };
  return NextResponse.json({
    access_token: ok.access_token,
    token_type: ok.token_type,
    expires_in: ok.expires_in,
  });
}
