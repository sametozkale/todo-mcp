import { CLAUDE_DESKTOP_CONFIG_HINT } from "./mcp-platform-configs";

export const DEFAULT_PLATFORM_ORDER = [
  "cursor",
  "claudeDesktop",
  "claudeWeb",
  "windsurf",
  "claudeCode",
  "vscode",
  "manual",
] as const;

export type PlatformId = (typeof DEFAULT_PLATFORM_ORDER)[number];

export function isPlatformId(value: string | undefined | null): value is PlatformId {
  return (
    value !== undefined &&
    value !== null &&
    (DEFAULT_PLATFORM_ORDER as readonly string[]).includes(value)
  );
}

export type PrimaryActionKind =
  | "deeplink_cursor"
  | "copy_vscode"
  | "copy_claude_desktop"
  | "copy_claude_web_url"
  | "copy_windsurf"
  | "copy_claude_code"
  | "copy_universal";

export type InstallGuideStep = {
  title: string;
  description?: string;
};

export type InstallGuide = {
  headline: string;
  /** Short name on the picker grid (no “Connect” prefix). */
  pickerTitle: string;
  subline: string;
  steps: InstallGuideStep[];
  primaryLabel: string;
  primaryKind: PrimaryActionKind;
  /** When false, primary action does not need McpInstallContext (e.g. copy base URL only). */
  needsInstallContext: boolean;
  /** Short line under the platform name on the picker card */
  pickerBlurb: string;
};

const guides: Record<PlatformId, InstallGuide> = {
  cursor: {
    headline: "Connect Cursor",
    pickerTitle: "Cursor",
    subline: "Open Cursor and confirm the install. If deeplink fails, copy the universal JSON and add manually.",
    pickerBlurb: "One-click install in Cursor",
    primaryLabel: "Add to Cursor",
    primaryKind: "deeplink_cursor",
    needsInstallContext: true,
    steps: [
      { title: "Click “Add to Cursor” below" },
      { title: "When Cursor opens, choose Install (or Open Cursor first if prompted)" },
      { title: "If nothing opens, use Other → Copy universal config and import manually in Cursor MCP settings" },
      { title: "Try asking the AI to list your Yalp todos" },
    ],
  },
  vscode: {
    headline: "Connect VS Code",
    pickerTitle: "VS Code",
    subline: "Add Yalp MCP to your project with .vscode/mcp.json (MCP-enabled Copilot build required).",
    pickerBlurb: "Copilot MCP — add project mcp.json",
    primaryLabel: "Copy VS Code config",
    primaryKind: "copy_vscode",
    needsInstallContext: true,
    steps: [
      { title: "Click the button below to copy the JSON" },
      {
        title: "Create .vscode/mcp.json in your project root",
        description: "If the folder doesn’t exist, create it, then paste and save.",
      },
      { title: "Open MCP/Copilot tools, trust the workspace, and start the yalp server if prompted" },
      { title: "Run a quick test prompt (for example: list my todos)" },
    ],
  },
  claudeDesktop: {
    headline: "Connect Claude Desktop",
    pickerTitle: "Claude Desktop",
    subline: "Stdio MCP via npx — paste the block into Claude’s developer config (most reliable).",
    pickerBlurb: "Developer config JSON",
    primaryLabel: "Copy Claude config",
    primaryKind: "copy_claude_desktop",
    needsInstallContext: true,
    steps: [
      { title: "Click below to copy the mcpServers JSON" },
      {
        title: "Claude Desktop → Settings → Developer → Edit Config",
        description: `On macOS the file often lives at ${CLAUDE_DESKTOP_CONFIG_HINT}. On Windows the path differs — use Settings to open it.`,
      },
      { title: "Merge only mcpServers.yalp (do not overwrite other existing servers)" },
      { title: "Restart Claude Desktop" },
    ],
  },
  claudeWeb: {
    headline: "Claude Web",
    pickerTitle: "Claude Web",
    subline:
      "Remote MCP over HTTPS. Use the URL ending with /api/mcp/stream (not /api/mcp), then authenticate with your API key.",
    pickerBlurb: "Remote MCP URL + API key",
    primaryLabel: "Copy remote MCP URL",
    primaryKind: "copy_claude_web_url",
    needsInstallContext: false,
    steps: [
      { title: "Create or copy a Yalp API key (Advanced → API keys on this page if needed)" },
      { title: "Click below to copy the remote MCP URL (ends with /api/mcp/stream)" },
      {
        title: "In claude.ai → Settings → Connectors (or Integrations) → add custom connector",
        description: "Paste the URL. When asked for authentication, use your API key as a Bearer token or in the API key field.",
      },
      {
        title: "Prefer a local install?",
        description:
          "Use Cursor or Claude Desktop with the one-click / stdio config — no hosted connector required.",
      },
    ],
  },
  windsurf: {
    headline: "Connect Windsurf",
    pickerTitle: "Windsurf",
    subline: "Paste MCP JSON into Windsurf settings (stdio via npx). If labels differ by version, use the closest MCP server import flow.",
    pickerBlurb: "MCP settings JSON",
    primaryLabel: "Copy Windsurf config",
    primaryKind: "copy_windsurf",
    needsInstallContext: true,
    steps: [
      { title: "Copy the config below" },
      { title: "Windsurf → Settings → MCP → Add server (or equivalent naming in your version)" },
      { title: "Paste the JSON and save" },
      { title: "If this screen differs, use Other config and map fields manually" },
    ],
  },
  claudeCode: {
    headline: "Claude Code (CLI)",
    pickerTitle: "Claude Code",
    subline: "Stdio MCP via npx — run the one-liner in Terminal (requires the claude CLI).",
    pickerBlurb: "Terminal command",
    primaryLabel: "Copy command",
    primaryKind: "copy_claude_code",
    needsInstallContext: true,
    steps: [
      { title: "Copy the command bundle below (bash/zsh, fish, PowerShell)" },
      {
        title: "Paste into Terminal and run",
        description: "If flags don’t match your CLI version, use Cursor or Claude Desktop instead.",
      },
    ],
  },
  manual: {
    headline: "Other MCP client",
    pickerTitle: "Other",
    subline: "Universal stdio JSON you can adapt to any client’s schema (mcpServers or servers).",
    pickerBlurb: "Generic mcpServers JSON",
    primaryLabel: "Copy universal config",
    primaryKind: "copy_universal",
    needsInstallContext: true,
    steps: [
      { title: "Copy the JSON below" },
      { title: "Open your client’s MCP / tools settings" },
      { title: "Paste following that client’s documentation (map mcpServers ↔ servers if required)" },
    ],
  },
};

export function getInstallGuide(id: PlatformId): InstallGuide {
  return guides[id];
}

export function sortPlatformsForUserAgent(ua: string): PlatformId[] {
  const u = ua.toLowerCase();
  const boost: PlatformId[] = [];
  if (u.includes("cursor")) boost.push("cursor");
  if (u.includes("vscode") || u.includes("vscodium")) boost.push("vscode");
  if (u.includes("windsurf") || u.includes("codeium")) boost.push("windsurf");
  if (u.includes("claude")) boost.push("claudeDesktop", "claudeWeb");
  const rest = DEFAULT_PLATFORM_ORDER.filter((id) => !boost.includes(id));
  return [...boost, ...rest];
}

export function getSuggestedPlatformIds(ua: string): Set<PlatformId> {
  const u = ua.toLowerCase();
  const s = new Set<PlatformId>();
  if (u.includes("vscode") || u.includes("vscodium")) s.add("vscode");
  if (u.includes("windsurf") || u.includes("codeium")) s.add("windsurf");
  if (u.includes("claude")) {
    s.add("claudeDesktop");
    s.add("claudeWeb");
  }
  return s;
}
