import { promises as fs } from "node:fs";
import * as path from "node:path";
import { NextResponse } from "next/server";
import type { MacArch } from "@/lib/mac-desktop-download";

export const runtime = "nodejs";

function parseArch(input: string | null): MacArch {
  return input === "x64" ? "x64" : "arm64";
}

function getExternalUrlForArch(arch: MacArch): string | null {
  const perArch =
    arch === "arm64"
      ? process.env.NEXT_PUBLIC_YALP_MAC_DMG_URL_ARM64?.trim()
      : process.env.NEXT_PUBLIC_YALP_MAC_DMG_URL_X64?.trim();
  if (perArch) return perArch;
  return process.env.NEXT_PUBLIC_YALP_MAC_DMG_URL?.trim() || null;
}

async function findLatestDmgPath(arch: MacArch): Promise<string | null> {
  const distDir = path.resolve(process.cwd(), "../desktop/dist-app");
  let entries;
  try {
    entries = await fs.readdir(distDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const dmgFiles = await Promise.all(
    entries
      .filter((entry) => {
        if (!entry.isFile() || !entry.name.endsWith(".dmg")) return false;
        return arch === "arm64" ? entry.name.includes("arm64") : entry.name.includes("x64");
      })
      .map(async (entry) => {
        const fullPath = path.join(distDir, entry.name);
        const stat = await fs.stat(fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs };
      }),
  );

  if (dmgFiles.length === 0) return null;
  dmgFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dmgFiles[0]!.fullPath;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const arch = parseArch(searchParams.get("arch"));

  const externalUrl = getExternalUrlForArch(arch);
  if (externalUrl) {
    return NextResponse.redirect(externalUrl);
  }

  const localDmgPath = await findLatestDmgPath(arch);
  if (!localDmgPath) {
    return NextResponse.json(
      {
        error: `No ${arch} macOS build artifact found. Build it with pnpm --filter desktop build:mac or set NEXT_PUBLIC_YALP_MAC_DMG_URL_${arch.toUpperCase()}.`,
      },
      { status: 404 },
    );
  }

  const stat = await fs.stat(localDmgPath);
  const fileName = path.basename(localDmgPath);
  const fileBuffer = await fs.readFile(localDmgPath);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/x-apple-diskimage",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      "Cache-Control": "no-store",
    },
  });
}
