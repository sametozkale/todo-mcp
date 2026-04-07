import { CLAUDE_DESKTOP_CONFIG_HINT } from "./mcp-platform-configs";

/** Grid is 2 columns on sm+; order places all Claude options in the right column. */
export const DEFAULT_PLATFORM_ORDER = [
  "cursor",
  "claudeDesktop",
  "windsurf",
  "claudeWeb",
  "vscode",
  "claudeCode",
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
    subline: "Install Yalp in one tap — Cursor opens with the server ready and your key applied automatically.",
    pickerBlurb: "One-click install in Cursor",
    primaryLabel: "Add to Cursor",
    primaryKind: "deeplink_cursor",
    needsInstallContext: true,
    steps: [
      { title: "Click “Add to Cursor” below" },
      { title: "When Cursor opens, choose Install (or open Cursor first if prompted)" },
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
      {
        title: "Paste only the copied yalp server block into mcpServers",
        description: "Keep existing servers as-is. Add/update mcpServers.yalp, save the file.",
      },
      { title: "Restart Claude Desktop" },
    ],
  },
  claudeWeb: {
    headline: "Claude Web (claude.ai)",
    pickerTitle: "Claude Web",
    subline: "Remote connector for claude.ai — MCP URL plus OAuth client from Yalp.",
    pickerBlurb: "OAuth + remote URL",
    primaryLabel: "Copy remote MCP URL",
    primaryKind: "copy_claude_web_url",
    needsInstallContext: false,
    /** Steps are rendered by `ClaudeWebConnectSteps` (copy-paste flow). */
    steps: [],
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

const TRY_TOOL_TITLE = "Tool calls after you’re connected";
const TRY_TOOL_SUBTITLE =
  "Once MCP is working, paste an example below or call create_todo, list_todos, and update_todo by name.";

export function getTryToolGuide(id: PlatformId): TryToolGuide {
  const shared = [
    "/create-todo Buy milk",
    "/list-todos",
    "/update-todo <todo_id> done",
    "If slash aliases are unavailable, call exact MCP tools: create_todo, list_todos, update_todo",
  ];

  const byPlatform: Record<PlatformId, TryToolGuide> = {
    cursor: {
      title: TRY_TOOL_TITLE,
      subtitle: TRY_TOOL_SUBTITLE,
      examples: shared,
    },
    vscode: {
      title: TRY_TOOL_TITLE,
      subtitle: TRY_TOOL_SUBTITLE,
      examples: shared,
    },
    claudeDesktop: {
      title: TRY_TOOL_TITLE,
      subtitle: TRY_TOOL_SUBTITLE,
      examples: shared,
    },
    claudeWeb: {
      title: TRY_TOOL_TITLE,
      subtitle: TRY_TOOL_SUBTITLE,
      examples: shared,
    },
    windsurf: {
      title: TRY_TOOL_TITLE,
      subtitle: TRY_TOOL_SUBTITLE,
      examples: shared,
    },
    claudeCode: {
      title: TRY_TOOL_TITLE,
      subtitle: TRY_TOOL_SUBTITLE,
      examples: [
        "Create a todo: Buy milk (use create_todo)",
        "List my todos (use list_todos)",
        "Mark todo <todo_id> as done (use update_todo with is_completed=true)",
      ],
    },
    manual: {
      title: TRY_TOOL_TITLE,
      subtitle: TRY_TOOL_SUBTITLE,
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
