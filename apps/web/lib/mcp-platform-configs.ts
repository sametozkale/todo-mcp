import { base64EncodeUtf8 } from "./mcp-encoding";

export const YALP_MCP_SERVER_ID = "yalp";
export const YALP_MCP_PACKAGE = "yalp-mcp-server";
export const YALP_MCP_BIN = "yalp-mcp";

export type McpInstallContext = {
  apiKey: string;
  baseUrl: string;
};

/** Shared stdio server block for Claude Desktop, Cursor deeplink, universal JSON, Windsurf fallback. */
export function buildMcpServersStdio(ctx: McpInstallContext) {
  return {
    mcpServers: {
      [YALP_MCP_SERVER_ID]: {
        command: "npx",
        args: ["-y", "-p", YALP_MCP_PACKAGE, YALP_MCP_BIN],
        env: {
          YALP_API_KEY: ctx.apiKey,
          YALP_API_BASE_URL: ctx.baseUrl,
        },
      },
    },
  };
}

/** Cursor: base64-encoded mcpServers JSON → deeplink. */
export function buildCursorMcpInstallDeeplink(ctx: McpInstallContext): string {
  const configObj = buildMcpServersStdio(ctx);
  const json = JSON.stringify(configObj);
  const configB64 = base64EncodeUtf8(json);
  const name = encodeURIComponent(YALP_MCP_SERVER_ID);
  const configParam = encodeURIComponent(configB64);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${configParam}`;
}

/** Claude Desktop: full file shape (merge under top-level `mcpServers` in claude_desktop_config.json). */
export function formatClaudeDesktopConfigJson(ctx: McpInstallContext): string {
  return JSON.stringify(buildMcpServersStdio(ctx), null, 2);
}

/**
 * VS Code `.vscode/mcp.json` — stdio transport (Copilot MCP / built-in MCP).
 * @see https://code.visualstudio.com/docs/copilot/customization/mcp-servers
 */
export function formatVsCodeMcpJson(ctx: McpInstallContext): string {
  const inner = buildMcpServersStdio(ctx).mcpServers[YALP_MCP_SERVER_ID];
  return JSON.stringify(
    {
      servers: {
        [YALP_MCP_SERVER_ID]: {
          type: "stdio",
          command: inner.command,
          args: inner.args,
          env: inner.env,
        },
      },
    },
    null,
    2,
  );
}

/** Windsurf: stdio-friendly JSON (same as universal mcpServers; HTTP transport deferred). */
export function formatWindsurfMcpJson(ctx: McpInstallContext): string {
  return formatClaudeDesktopConfigJson(ctx);
}

export function buildMcpApiUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/mcp`;
}

/** Claude Web: base URL only — auth is not embedded; user supplies API key per client UI. */
export function formatClaudeWebCopyText(baseUrl: string): string {
  return buildMcpApiUrl(baseUrl);
}

/**
 * Claude Code CLI: copyable script. Stdio via npx; user must have env available to the subprocess.
 * If your `claude` CLI version differs, use Advanced → universal JSON with Desktop/Cursor instead.
 */
export function buildClaudeCodeMcpCommand(ctx: McpInstallContext): string {
  const key = ctx.apiKey.replace(/'/g, "'\\''");
  const url = ctx.baseUrl.replace(/'/g, "'\\''");
  return `export YALP_API_KEY='${key}' YALP_API_BASE_URL='${url}' && claude mcp add ${YALP_MCP_SERVER_ID} --scope user --transport stdio --command npx --args "-y,-p,${YALP_MCP_PACKAGE},${YALP_MCP_BIN}"`;
}

export function formatUniversalConfigJson(ctx: McpInstallContext): string {
  return JSON.stringify(buildMcpServersStdio(ctx), null, 2);
}

export const CLAUDE_DESKTOP_CONFIG_HINT =
  "~/Library/Application Support/Claude/claude_desktop_config.json";

export const SYNC_VERIFY_NPX_COMMAND = `npx -y -p ${YALP_MCP_PACKAGE} ${YALP_MCP_BIN}`;
