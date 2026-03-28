function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function addHttpsDeployment(set: Set<string>, value: string | undefined) {
  if (!value?.trim()) return;
  let v = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  set.add(normalizeOrigin(v));
}

/** Origins we accept from `Origin` / `Referer` when building Stripe return URLs (avoids open redirects). */
function collectAllowedPublicSiteOrigins(): string[] {
  const out = new Set<string>();
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) out.add(normalizeOrigin(env));
  out.add("http://localhost:3001");
  out.add("http://127.0.0.1:3001");
  addHttpsDeployment(out, process.env.VERCEL_URL);
  addHttpsDeployment(out, process.env.VERCEL_BRANCH_URL);
  return [...out];
}

/**
 * Prefer the browser's Origin (allowlisted) so Stripe cancel/success URLs match where the user started checkout
 * (local, preview, or production). Falls back to NEXT_PUBLIC_SITE_URL.
 */
export function resolvePublicSiteUrl(req: Request): string {
  const allowed = new Set(collectAllowedPublicSiteOrigins());
  const origin = normalizeOrigin(req.headers.get("origin") ?? "");
  if (origin && allowed.has(origin)) return origin;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      const refOrigin = normalizeOrigin(`${u.protocol}//${u.host}`);
      if (allowed.has(refOrigin)) return refOrigin;
    } catch {
      /* ignore */
    }
  }

  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return normalizeOrigin(env);
  return "http://localhost:3001";
}
