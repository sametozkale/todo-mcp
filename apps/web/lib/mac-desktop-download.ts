/**
 * Public URL of the macOS `.dmg` built from `apps/desktop` (e.g. Vercel Blob, GitHub Releases, or CDN).
 * Set `NEXT_PUBLIC_YALP_MAC_DMG_URL` in `apps/web/.env.local` / Vercel.
 */
export function getMacDesktopDmgUrl(): string {
  const raw = process.env.NEXT_PUBLIC_YALP_MAC_DMG_URL?.trim();
  return raw || "/api/downloads/macos";
}
