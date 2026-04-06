import { NextResponse } from "next/server";
import { getOAuthIssuerBase } from "@/lib/server/oauth-internal";

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata.
 */
export function GET() {
  const issuer = getOAuthIssuerBase();

  return NextResponse.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
  });
}
