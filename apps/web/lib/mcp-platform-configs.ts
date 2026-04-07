import { base64EncodeUtf8 } from "./mcp-encoding";

export const YALP_MCP_SERVER_ID = "yalp";
export const YALP_MCP_PACKAGE = "yalp-mcp-server";
export const YALP_MCP_BIN = "yalp-mcp";

export type McpInstallContext = {
  apiKey: string;
  baseUrl: string;
};

export type InstallContextValidationResult =
  | { ok: true; normalizedBaseUrl: string }
  | { ok: false; message: string };

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
}

export function validateInstallContext(
  ctx: McpInstallContext,
  opts: { requiresRemoteHttps?: boolean } = {},
): InstallContextValidationResult {
  const apiKey = ctx.apiKey.trim();
  if (!apiKey) return { ok: false, message: "Missing API key. Generate a key first." };
  if (!apiKey.startsWith("yalp_")) {
    return { ok: false, message: "Invalid API key format. Expected a key starting with `yalp_`." };
  }
  if (apiKey.length < 20) {
    return { ok: false, message: "API key looks too short. Generate a fresh key and try again." };
  }

  let parsed: URL;
  try {
    parsed = new URL(ctx.baseUrl);
  } catch {
    return { ok: false, message: "Base URL is invalid. Please reload this page and try again." };
  }

  if (opts.requiresRemoteHttps && parsed.protocol !== "https:" && !isLocalHost(parsed.hostname)) {
    return {
      ok: false,
      message: "Remote MCP connectors require HTTPS (except localhost).",
    };
  }

  return { ok: true, normalizedBaseUrl: parsed.toString().replace(/\/+$/, "") };
}

/** Shared stdio server block for Claude Desktop, Cursor deeplink, universal JSON, Windsurf fallback. */
export function buildMcpServersStdio(ctx: McpInstallContext) {
  const validated = validateInstallContext(ctx);
  if (!validated.ok) throw new Error(validated.message);
  return {
    mcpServers: {
      [YALP_MCP_SERVER_ID]: {
        command: "npx",
        args: ["-y", "-p", YALP_MCP_PACKAGE, YALP_MCP_BIN],
        env: {
          YALP_API_KEY: ctx.apiKey.trim(),
          YALP_API_BASE_URL: validated.normalizedBaseUrl,
        },
      },
    },
  };
}

/** Cursor: base64-encoded mcpServers JSON → deeplink. */
export function buildCursorMcpInstallDeeplink(ctx: McpInstallContext): string {
  // Cursor expects the *server config object* for the selected name, not the
  // full { mcpServers: { ... } } wrapper used by other clients.
  const configObj = buildMcpServersStdio(ctx).mcpServers[YALP_MCP_SERVER_ID];
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

/** Legacy JSON tool router used by the published `yalp-mcp-server` package (stdio → HTTP). */
export function buildMcpApiUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/mcp`;
}

function normalizeConnectorBaseUrl(baseUrl: string): string {
  const raw = baseUrl.replace(/\/+$/, "");
  try {
    const parsed = new URL(raw);
    // Avoid POST redirect for hosted MCP connectors.
    if (parsed.hostname === "yalp.work") {
      parsed.hostname = "www.yalp.work";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
}

/**
 * Remote MCP (JSON-RPC) URL for Claude Web / hosted connectors — streamable HTTP endpoint.
 * Auth: `Authorization: Bearer <yalp_api_key>` or `X-Api-Key` (create a key on this page).
 */
export function buildRemoteMcpUrl(baseUrl: string): string {
  return `${normalizeConnectorBaseUrl(baseUrl)}/api/mcp/stream`;
}

/** Claude Web: remote MCP URL — user supplies API key in the connector (Bearer / API key field). */
export function formatClaudeWebCopyText(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:" && !isLocalHost(parsed.hostname)) {
    throw new Error("Claude Web connector needs an HTTPS URL.");
  }
  return buildRemoteMcpUrl(baseUrl);
}

/**
 * Claude Code CLI: copyable script. Stdio via npx; user must have env available to the subprocess.
 * If your `claude` CLI version differs, use Advanced → universal JSON with Desktop/Cursor instead.
 */
export function buildClaudeCodeMcpCommand(ctx: McpInstallContext): string {
  const validated = validateInstallContext(ctx);
  if (!validated.ok) throw new Error(validated.message);
  const key = ctx.apiKey.replace(/'/g, "'\\''");
  const url = validated.normalizedBaseUrl.replace(/'/g, "'\\''");
  return `YALP_API_KEY='${key}' YALP_API_BASE_URL='${url}' claude mcp add ${YALP_MCP_SERVER_ID} --scope user --transport stdio --command npx --args -y --args -p --args ${YALP_MCP_PACKAGE} --args ${YALP_MCP_BIN}`;
}

export function buildClaudeCodeMcpCommandVariants(ctx: McpInstallContext): {
  bashZsh: string;
  fish: string;
  powershell: string;
} {
  const validated = validateInstallContext(ctx);
  if (!validated.ok) throw new Error(validated.message);

  const keySingle = ctx.apiKey.replace(/'/g, "'\\''");
  const keyDouble = ctx.apiKey.replace(/"/g, '`"');
  const urlSingle = validated.normalizedBaseUrl.replace(/'/g, "'\\''");
  const urlDouble = validated.normalizedBaseUrl.replace(/"/g, '`"');

  const addCmd = `claude mcp add ${YALP_MCP_SERVER_ID} --scope user --transport stdio --command npx --args -y --args -p --args ${YALP_MCP_PACKAGE} --args ${YALP_MCP_BIN}`;

  return {
    bashZsh: `YALP_API_KEY='${keySingle}' YALP_API_BASE_URL='${urlSingle}' ${addCmd}`,
    fish: `env YALP_API_KEY='${keySingle}' YALP_API_BASE_URL='${urlSingle}' ${addCmd}`,
    powershell: `$env:YALP_API_KEY="${keyDouble}"; $env:YALP_API_BASE_URL="${urlDouble}"; ${addCmd}`,
  };
}

export function formatClaudeCodeCommandBundle(ctx: McpInstallContext): string {
  const variants = buildClaudeCodeMcpCommandVariants(ctx);
  return [
    "# Claude Code MCP setup",
    "# Use the variant that matches your shell.",
    "",
    "## bash/zsh",
    variants.bashZsh,
    "",
    "## fish",
    variants.fish,
    "",
    "## PowerShell",
    variants.powershell,
    "",
    "## Fallback",
    "# If the CLI flags differ in your version, use the universal JSON config from this page.",
  ].join("\n");
}

export function formatUniversalConfigJson(ctx: McpInstallContext): string {
  return JSON.stringify(buildMcpServersStdio(ctx), null, 2);
}

export const CLAUDE_DESKTOP_CONFIG_HINT =
  "~/Library/Application Support/Claude/claude_desktop_config.json";

export const SYNC_VERIFY_NPX_COMMAND = `npx -y -p ${YALP_MCP_PACKAGE} ${YALP_MCP_BIN}`;
