import { NextResponse } from "next/server";
import { getMcpResourceUrl, getOAuthIssuerBase } from "@/lib/server/oauth-internal";

/**
 * RFC 9728 — OAuth 2.0 Protected Resource Metadata (MCP 2025-06-18).
 */
export function GET(request: Request) {
  const expectedResource = getMcpResourceUrl();
  const url = new URL(request.url);
  const resourceParam = url.searchParams.get("resource");
  const resource = resourceParam ?? expectedResource;

  if (resource !== expectedResource) {
    return NextResponse.json({ error: "invalid_request", error_description: "Unknown resource." }, { status: 404 });
  }

  const issuer = getOAuthIssuerBase();

  return NextResponse.json({
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
  });
}
