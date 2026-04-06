import { NextResponse } from "next/server";
import {
  authUserIdFromApiKey,
  executeMcpTool,
  getServiceSupabase,
  isToolName,
  touchApiKeyLastUsed,
  type ToolName,
} from "@/lib/server/mcp-tools";

export async function POST(req: Request) {
  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Server is missing SUPABASE_SERVICE_ROLE_KEY (required for MCP API).",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const payload = (typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const toolRaw = String(payload.tool ?? "");
  const apiKey = String(payload.apiKey ?? "").trim();

  if (!apiKey) {
    return NextResponse.json({ error: "Missing apiKey." }, { status: 400 });
  }

  if (!isToolName(toolRaw)) {
    return NextResponse.json({ error: "Unknown tool." }, { status: 400 });
  }
  const tool = toolRaw as ToolName;

  const { userId, keyRowId } = await authUserIdFromApiKey(supabase, apiKey);
  if (!userId || !keyRowId) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  touchApiKeyLastUsed(supabase, keyRowId);

  const toolPayload = { ...payload };
  delete toolPayload.tool;
  delete toolPayload.apiKey;

  const result = await executeMcpTool(supabase, userId, tool, toolPayload);
  return NextResponse.json(result.body, { status: result.status });
}
