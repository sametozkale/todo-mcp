export type MacArch = "arm64" | "x64";

export type MacDownloadOption = {
  arch: MacArch;
  label: string;
  href: string;
};

/**
 * Download URL priority (per architecture):
 * 1) NEXT_PUBLIC_YALP_MAC_DMG_URL_ARM64 / _X64
 * 2) NEXT_PUBLIC_YALP_MAC_DMG_URL (legacy single URL)
 * 3) local API fallback (/api/downloads/macos?arch=...)
 */
export function getMacDesktopDmgUrl(arch: MacArch): string {
  const perArch =
    arch === "arm64"
      ? process.env.NEXT_PUBLIC_YALP_MAC_DMG_URL_ARM64?.trim()
      : process.env.NEXT_PUBLIC_YALP_MAC_DMG_URL_X64?.trim();
  if (perArch) return perArch;

  const legacy = process.env.NEXT_PUBLIC_YALP_MAC_DMG_URL?.trim();
  if (legacy) return legacy;

  return `/api/downloads/macos?arch=${arch}`;
}

export function getMacDownloadOptions(): MacDownloadOption[] {
  return [
    { arch: "arm64", label: "Apple Silicon", href: getMacDesktopDmgUrl("arm64") },
    { arch: "x64", label: "Intel", href: getMacDesktopDmgUrl("x64") },
  ];
}
