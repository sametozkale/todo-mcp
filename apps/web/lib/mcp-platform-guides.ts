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

export type TryToolGuide = {
  title: string;
  subtitle: string;
  examples: string[];
};

const guides: Record<PlatformId, InstallGuide> = {
  cursor: {
    headline: "Connect Cursor",
    pickerTitle: "Cursor",
    subline:
      "Local stdio MCP — your Yalp API key is passed in env (not OAuth). Deeplink opens Cursor to add the server in one step.",
    pickerBlurb: "One-click install in Cursor",
    primaryLabel: "Add to Cursor",
    primaryKind: "deeplink_cursor",
    needsInstallContext: true,
    steps: [
      { title: "Click “Add to Cursor” below" },
      { title: "When Cursor opens, choose Install (or open Cursor first if prompted)" },
      {
        title: "Run a test prompt",
        description: "Example: list my todos — confirms tools are wired.",
      },
    ],
  },
  vscode: {
    headline: "Connect VS Code",
    pickerTitle: "VS Code",
    subline:
      "Project-level stdio MCP (Copilot MCP). Your API key lives in .vscode/mcp.json env — not Claude Web OAuth.",
    pickerBlurb: "Copilot MCP — add project mcp.json",
    primaryLabel: "Copy VS Code config",
    primaryKind: "copy_vscode",
    needsInstallContext: true,
    steps: [
      { title: "Click below to copy the JSON" },
      {
        title: "Create or edit .vscode/mcp.json in your project root",
        description: "Create the folder if needed, then paste and save.",
      },
      { title: "Open MCP / Copilot tools, trust the workspace, start yalp if prompted" },
      { title: "Run a test prompt (e.g. list my todos)" },
    ],
  },
  claudeDesktop: {
    headline: "Connect Claude Desktop",
    pickerTitle: "Claude Desktop",
    subline:
      "Local stdio via npx — API key in env. Claude Web uses OAuth; this path does not. Merge only the yalp block into your config.",
    pickerBlurb: "Developer config JSON",
    primaryLabel: "Copy Claude config",
    primaryKind: "copy_claude_desktop",
    needsInstallContext: true,
    steps: [
      { title: "Click below to copy the mcpServers JSON" },
      {
        title: "Claude Desktop → Settings → Developer → Edit Config",
        description: `macOS path is often ${CLAUDE_DESKTOP_CONFIG_HINT}. On Windows, use Settings to open the correct file.`,
      },
      { title: "Merge only mcpServers.yalp — do not remove other servers" },
      { title: "Restart Claude Desktop" },
      { title: "Run a test prompt (e.g. list my todos)" },
    ],
  },
  claudeWeb: {
    headline: "Claude Web (claude.ai)",
    pickerTitle: "Claude Web",
    subline:
      "Remote HTTPS MCP with OAuth. Create a Client ID + Secret below, paste them in Advanced settings on claude.ai, then Connect — do not put your yalp_ API key in OAuth fields.",
    pickerBlurb: "OAuth + remote URL",
    primaryLabel: "Copy remote MCP URL",
    primaryKind: "copy_claude_web_url",
    needsInstallContext: false,
    steps: [
      {
        title: "Create OAuth credentials on this page",
        description: "Use “Create Claude Web OAuth client” in the box below. Copy the Client ID and Client Secret once — the secret is shown only at creation.",
      },
      {
        title: "In claude.ai → Add custom connector",
        description: "Paste the remote MCP URL. Open Advanced and paste OAuth Client ID and Client Secret (from Yalp, not your yalp_ API key).",
      },
      { title: "Click Connect in Claude and sign in to Yalp when the browser opens" },
      {
        title: "Test with a short prompt",
        description: "Example: list my todos. Tool calls use the OAuth access token automatically.",
      },
    ],
  },
  windsurf: {
    headline: "Connect Windsurf",
    pickerTitle: "Windsurf",
    subline: "Stdio MCP JSON — same pattern as Claude Desktop. Labels may vary slightly by Windsurf version.",
    pickerBlurb: "MCP settings JSON",
    primaryLabel: "Copy Windsurf config",
    primaryKind: "copy_windsurf",
    needsInstallContext: true,
    steps: [
      { title: "Copy the config below" },
      { title: "Windsurf → Settings → MCP → Add server" },
      { title: "Paste JSON and save" },
      { title: "Run a test prompt in the assistant" },
    ],
  },
  claudeCode: {
    headline: "Claude Code (CLI)",
    pickerTitle: "Claude Code",
    subline: "Terminal stdio — API key via env. Separate from Claude Web OAuth (remote HTTP).",
    pickerBlurb: "Terminal command",
    primaryLabel: "Copy command",
    primaryKind: "copy_claude_code",
    needsInstallContext: true,
    steps: [
      { title: "Copy the command bundle (bash/zsh, fish, or PowerShell)" },
      { title: "Paste into Terminal and run" },
      { title: "Run one test prompt (e.g. list my todos)" },
    ],
  },
  manual: {
    headline: "Other MCP client",
    pickerTitle: "Other",
    subline: "Universal stdio JSON — adapt field names (mcpServers vs servers) per your client docs.",
    pickerBlurb: "Generic mcpServers JSON",
    primaryLabel: "Copy universal config",
    primaryKind: "copy_universal",
    needsInstallContext: true,
    steps: [
      { title: "Copy the JSON below" },
      { title: "Open your client’s MCP / tools settings" },
      {
        title: "Paste following that client’s documentation",
        description: "Map mcpServers ↔ servers if your client uses a different top-level key.",
      },
    ],
  },
};

export function getInstallGuide(id: PlatformId): InstallGuide {
  return guides[id];
}

export function getTryToolGuide(id: PlatformId): TryToolGuide {
  const shared = [
    "/create-todo Buy milk",
    "/list-todos",
    "/update-todo <todo_id> done",
    "If slash aliases are unavailable, call exact MCP tools: create_todo, list_todos, update_todo",
  ];

  const byPlatform: Record<PlatformId, TryToolGuide> = {
    cursor: {
      title: "Connected - Try these tool calls",
      subtitle: "Paste one line into Cursor chat to verify MCP tool usage.",
      examples: shared,
    },
    vscode: {
      title: "Connected - Try these tool calls",
      subtitle: "Paste one line into Copilot Chat after yalp server is running.",
      examples: shared,
    },
    claudeDesktop: {
      title: "Connected - Try these tool calls",
      subtitle: "Use one short instruction in Claude Desktop after restart.",
      examples: shared,
    },
    claudeWeb: {
      title: "Connected - Try these tool calls",
      subtitle: "After Connect completes in Claude Web, try one short instruction.",
      examples: shared,
    },
    windsurf: {
      title: "Connected - Try these tool calls",
      subtitle: "Paste one line into Windsurf assistant to confirm tool execution.",
      examples: shared,
    },
    claudeCode: {
      title: "Connected - Try these tool calls",
      subtitle: "After `claude mcp add`, run one prompt using tool intent language.",
      examples: [
        "Create a todo: Buy milk (use create_todo)",
        "List my todos (use list_todos)",
        "Mark todo <todo_id> as done (use update_todo with is_completed=true)",
      ],
    },
    manual: {
      title: "Connected - Try these tool calls",
      subtitle: "Use your client's prompt/tool-call format with these examples.",
      examples: shared,
    },
  };

  return byPlatform[id];
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
