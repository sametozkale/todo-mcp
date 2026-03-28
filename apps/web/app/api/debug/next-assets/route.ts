import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { isServerDebugIngestEnabled, sendDebugIngest } from "@/lib/debug-ingest";

function exists(p: string) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

export async function GET() {
  const cwd = process.cwd();
  const p = (...parts: string[]) => path.join(cwd, ...parts);

  const checks = {
    cwd,
    nextDir: p(".next"),
    staticCssLayout: p(".next", "static", "css", "app", "layout.css"),
    staticChunkMainApp: p(".next", "static", "chunks", "main-app.js"),
    staticChunkAppLayout: p(".next", "static", "chunks", "app", "layout.js"),
    serverWebpackRuntime: p(".next", "server", "webpack-runtime.js"),
    serverVendorChunkNext: p(
      ".next",
      "server",
      "vendor-chunks",
      "next@15.5.14_react-dom@19.1.0_react@19.1.0__react@19.1.0.js",
    ),
    serverVendorChunkLucide: p(".next", "server", "vendor-chunks", "lucide-react@1.7.0_react@19.1.0.js"),
  } as const;

  const result = Object.fromEntries(
    Object.entries(checks).map(([k, v]) => {
      if (k === "cwd") return [k, v];
      return [k, { path: v, exists: exists(v) }];
    }),
  );

  // #region agent log
  if (isServerDebugIngestEnabled()) {
    void sendDebugIngest(
      {
        sessionId: "8f4b9f",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "apps/web/app/api/debug/next-assets/route.ts:1",
        message: "Next asset existence snapshot",
        data: result,
        timestamp: Date.now(),
      },
      { headerSessionId: "8f4b9f" },
    );
  }
  // #endregion

  return NextResponse.json(result);
}

