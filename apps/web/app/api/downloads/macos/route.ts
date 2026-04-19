import { promises as fs } from "node:fs";
import * as path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function findLatestDmgPath(): Promise<string | null> {
  const distDir = path.resolve(process.cwd(), "../desktop/dist-app");
  let entries;
  try {
    entries = await fs.readdir(distDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const dmgFiles = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".dmg"))
      .map(async (entry) => {
        const fullPath = path.join(distDir, entry.name);
        const stat = await fs.stat(fullPath);
        return { fullPath, fileName: entry.name, mtimeMs: stat.mtimeMs };
      }),
  );

  if (dmgFiles.length === 0) return null;
  dmgFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dmgFiles[0]!.fullPath;
}

export async function GET() {
  const externalUrl = process.env.NEXT_PUBLIC_YALP_MAC_DMG_URL?.trim();
  if (externalUrl) {
    return NextResponse.redirect(externalUrl);
  }

  const localDmgPath = await findLatestDmgPath();
  if (!localDmgPath) {
    return NextResponse.json(
      {
        error:
          "No macOS build artifact found. Build desktop app (`pnpm --filter desktop build:mac`) or set NEXT_PUBLIC_YALP_MAC_DMG_URL.",
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
