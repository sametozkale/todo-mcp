import crypto from "node:crypto";
import { getSiteUrl } from "@/lib/site-url";

export const OAUTH_ACCESS_TOKEN_PREFIX = "yalp_at_";
export const OAUTH_CLIENT_ID_PREFIX = "yalp_oc_";

function oauthPepper(): string {
  return process.env.YALP_OAUTH_SECRET_PEPPER?.trim() || process.env.YALP_API_KEY_PEPPER || "";
}

export function hashOAuthClientSecret(secret: string): string {
  return crypto.createHash("sha256").update(`${secret}.${oauthPepper()}`, "utf8").digest("hex");
}

export function verifyOAuthClientSecret(secret: string, secretHash: string): boolean {
  const h = hashOAuthClientSecret(secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(secretHash, "hex"));
  } catch {
    return false;
  }
}

export function hashOAuthAuthCode(code: string): string {
  return crypto.createHash("sha256").update(`${code}.${oauthPepper()}`, "utf8").digest("hex");
}

export function hashOAuthAccessToken(token: string): string {
  return crypto.createHash("sha256").update(`${token}.${oauthPepper()}`, "utf8").digest("hex");
}

export function generateOAuthClientId(): string {
  const raw = crypto.randomBytes(18).toString("base64url");
  return `${OAUTH_CLIENT_ID_PREFIX}${raw}`;
}

export function generateOAuthClientSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateAccessToken(): string {
  const raw = crypto.randomBytes(32).toString("base64url");
  return `${OAUTH_ACCESS_TOKEN_PREFIX}${raw}`;
}

/** RFC 7636 S256: code_challenge = BASE64URL(SHA256(ASCII(code_verifier))) */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const hash = crypto.createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
  try {
    const a = Buffer.from(hash, "utf8");
    const b = Buffer.from(codeChallenge, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getOAuthIssuerBase(): string {
  return getSiteUrl().replace(/\/+$/, "");
}

export function getMcpResourceUrl(): string {
  return `${getOAuthIssuerBase()}/api/mcp/stream`;
}

export function parseAllowedOAuthRedirectUris(): string[] {
  const raw = process.env.YALP_OAUTH_ALLOWED_REDIRECT_URIS?.trim();
  if (raw) {
    return raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [
    "https://claude.ai/api/mcp/auth_callback",
    "https://www.claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback",
  ];
}

export function isAllowedOAuthRedirectUri(candidate: string): boolean {
  const allowed = parseAllowedOAuthRedirectUris();
  return allowed.some((u) => u === candidate);
}
