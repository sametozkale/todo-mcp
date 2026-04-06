"use client";

import { ArrowDown01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Copy as CopyIcon } from "lucide-react";
import { toast } from "@/lib/app-toast";
import {
  buildCursorMcpInstallDeeplink,
  buildMcpApiUrl,
  buildRemoteMcpUrl,
  CLAUDE_DESKTOP_CONFIG_HINT,
  formatClaudeDesktopConfigJson,
  formatClaudeCodeCommandBundle,
  formatClaudeWebCopyText,
  formatUniversalConfigJson,
  formatVsCodeMcpJson,
  formatWindsurfMcpJson,
  SYNC_VERIFY_NPX_COMMAND,
  validateInstallContext,
} from "@/lib/mcp-platform-configs";
import {
  DEFAULT_PLATFORM_ORDER,
  getInstallGuide,
  getTryToolGuide,
  getSuggestedPlatformIds,
  isPlatformId,
  sortPlatformsForUserAgent,
  type PlatformId,
} from "@/lib/mcp-platform-guides";
import type { ApiKeyRow, CreateApiKeyResult, OAuthClientRow } from "./actions";
import {
  createApiKeyAction,
  createClaudeWebOAuthClientAction,
  ensureInstallKeyForSetupAction,
  listApiKeysAction,
  listOAuthClientsAction,
  revokeApiKeyAction,
  revokeOAuthClientAction,
} from "./actions";
import { ClaudeWebConnectSteps } from "./claude-web-connect-steps";
import { McpPlatformDetail, McpPlatformTroubleshooting, McpTryToolExamples } from "./mcp-platform-detail";
import { McpPlatformPicker } from "./mcp-platform-picker";

const QUICK_INSTALL_STORAGE_KEY = "yalp_mcp_quick_install_v1";

type QuickInstallStored = { userId: string; apiKey: string; keyId: string };

let quickInstallEnsureInFlight: Promise<CreateApiKeyResult> | null = null;

function readQuickInstallSession(): QuickInstallStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(QUICK_INSTALL_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as QuickInstallStored;
    if (typeof p.userId !== "string" || typeof p.apiKey !== "string" || typeof p.keyId !== "string") {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

function writeQuickInstallSession(data: QuickInstallStored) {
  try {
    sessionStorage.setItem(QUICK_INSTALL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function clearQuickInstallSession() {
  try {
    sessionStorage.removeItem(QUICK_INSTALL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type Props = {
  userId: string;
  initialKeys: ApiKeyRow[];
  initialOAuthClients: OAuthClientRow[];
  baseUrl: string;
  initialPlatform: PlatformId | null;
};

type McpTab = "connect" | "active" | "faq";

function isMcpTab(value: string | null): value is McpTab {
  return value === "connect" || value === "active" || value === "faq";
}

function newestLastUsedAt(keys: ApiKeyRow[]): string | null {
  let best: string | null = null;
  for (const k of keys) {
    if (!k.last_used_at) continue;
    if (!best || new Date(k.last_used_at) > new Date(best)) best = k.last_used_at;
  }
  return best;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} h ago`;
  return new Date(iso).toLocaleString();
}

export function McpConnectionsClient({ userId, initialKeys, initialOAuthClients, baseUrl, initialPlatform }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [oauthClients, setOauthClients] = useState<OAuthClientRow[]>(initialOAuthClients);
  const [oauthSecretOnce, setOauthSecretOnce] = useState<{ clientId: string; secret: string } | null>(null);
  const [installKey, setInstallKey] = useState<string | null>(null);
  const [installKeyId, setInstallKeyId] = useState<string | null>(null);
  const [label, setLabel] = useState("MCP Key");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isEnsuringInstall, setIsEnsuringInstall] = useState(false);

  const [phase, setPhase] = useState<"pick" | "detail">(() => (initialPlatform ? "detail" : "pick"));
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | null>(() => initialPlatform);

  const engagedUntilRef = useRef<number | null>(null);
  const pollMountedRef = useRef(true);
  const [pollGeneration, setPollGeneration] = useState(0);
  const setupDetailRef = useRef(false);
  const keysRef = useRef(initialKeys);
  keysRef.current = keys;

  const ctx = useMemo(
    () => (installKey ? { apiKey: installKey, baseUrl } : null),
    [installKey, baseUrl],
  );

  const activeOAuthClients = useMemo(() => oauthClients.filter((c) => !c.revoked_at), [oauthClients]);

  const [platformOrder, setPlatformOrder] = useState<PlatformId[]>(() => [
    ...DEFAULT_PLATFORM_ORDER,
  ]);
  const [suggestedIds, setSuggestedIds] = useState<Set<PlatformId>>(() => new Set());

  const [activeTab, setActiveTab] = useState<McpTab>(() => {
    const t = searchParams.get("tab");
    return isMcpTab(t) ? t : "connect";
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatformOrder(sortPlatformsForUserAgent(ua));
    setSuggestedIds(getSuggestedPlatformIds(ua));
  }, []);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (isMcpTab(t)) setActiveTab(t);
  }, [searchParams]);

  const setTab = useCallback(
    (tab: McpTab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "connect") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const raw = searchParams.get("platform");
    if (isPlatformId(raw)) {
      setSelectedPlatform(raw);
      setPhase("detail");
    } else if (!raw) {
      setPhase("pick");
      setSelectedPlatform(null);
    }
  }, [searchParams]);

  const bumpEngagement = useCallback(() => {
    engagedUntilRef.current = Date.now() + 60_000;
    setPollGeneration((g) => g + 1);
  }, []);

  const copy = useCallback((text: string, toastMessage: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(toastMessage, { timeout: 2800 }))
      .catch(() => toast.danger("Could not copy to clipboard.", { timeout: 4000 }));
  }, []);

  useEffect(() => {
    if (phase !== "detail" || !selectedPlatform) {
      setupDetailRef.current = false;
      return;
    }
    if (selectedPlatform === "claudeWeb") {
      setupDetailRef.current = true;
      return;
    }
    if (installKey) return;

    const stored = readQuickInstallSession();
    if (stored?.userId === userId) {
      const kList = keysRef.current;
      const keyKnown = kList.length === 0 || kList.some((k) => k.id === stored.keyId);
      if (keyKnown) {
        setInstallKey(stored.apiKey);
        setInstallKeyId(stored.keyId);
        setupDetailRef.current = true;
        return;
      }
      clearQuickInstallSession();
    }

    const inFlight = quickInstallEnsureInFlight;
    if (inFlight) {
      setIsEnsuringInstall(true);
      setError(null);
      startTransition(async () => {
        const result = await inFlight;
        setIsEnsuringInstall(false);
        if (!result.ok) {
          setupDetailRef.current = false;
          setError(result.error);
          toast.danger(result.error, { timeout: 4500 });
          return;
        }
        writeQuickInstallSession({ userId, apiKey: result.apiKey, keyId: result.row.id });
        setInstallKey(result.apiKey);
        setInstallKeyId(result.row.id);
        setKeys((prev) => (prev.some((k) => k.id === result.row.id) ? prev : [result.row, ...prev]));
      });
      return;
    }

    if (setupDetailRef.current) return;
    setupDetailRef.current = true;
    setIsEnsuringInstall(true);
    setError(null);

    const pending = ensureInstallKeyForSetupAction();
    quickInstallEnsureInFlight = pending.finally(() => {
      quickInstallEnsureInFlight = null;
    });

    startTransition(async () => {
      const result = await pending;
      setIsEnsuringInstall(false);
      if (!result.ok) {
        setupDetailRef.current = false;
        setError(result.error);
        toast.danger(result.error, { timeout: 4500 });
        return;
      }
      writeQuickInstallSession({ userId, apiKey: result.apiKey, keyId: result.row.id });
      setInstallKey(result.apiKey);
      setInstallKeyId(result.row.id);
      setKeys((prev) => (prev.some((k) => k.id === result.row.id) ? prev : [result.row, ...prev]));
    });
  }, [phase, selectedPlatform, installKey, userId, startTransition]);

  useEffect(() => {
    if (phase !== "detail" || selectedPlatform !== "claudeWeb") return;
    let cancelled = false;
    void listOAuthClientsAction().then((rows) => {
      if (!cancelled) setOauthClients(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, selectedPlatform]);

  useEffect(() => {
    if (!installKeyId) return;
    const stillThere = keys.some((k) => k.id === installKeyId);
    if (!stillThere) {
      setInstallKey(null);
      setInstallKeyId(null);
      setupDetailRef.current = false;
      clearQuickInstallSession();
    }
  }, [keys, installKeyId]);

  useEffect(() => {
    if (activeTab === "active") {
      void listOAuthClientsAction().then((rows) => setOauthClients(rows));
    }
  }, [activeTab]);

  useEffect(() => {
    pollMountedRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!pollMountedRef.current) return;
      try {
        const data = await listApiKeysAction();
        if (pollMountedRef.current) setKeys(data);
      } catch {
        /* ignore */
      }
      if (!pollMountedRef.current) return;
      const fast = engagedUntilRef.current !== null && Date.now() < engagedUntilRef.current;
      timeoutId = setTimeout(tick, fast ? 5000 : 30_000);
    };

    tick();
    return () => {
      pollMountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [pollGeneration]);

  const lastUsed = newestLastUsedAt(keys);
  const showActivity =
    lastUsed !== null && Date.now() - new Date(lastUsed).getTime() < 10 * 60 * 1000;
  const activityMessage = `Last MCP tool use ${formatRelativeTime(lastUsed)} (any client using your keys).`;

  const mcpApiUrl = buildMcpApiUrl(baseUrl);
  const mcpRemoteUrl = buildRemoteMcpUrl(baseUrl);

  const selectPlatform = useCallback(
    (id: PlatformId) => {
      setActiveTab("connect");
      setSelectedPlatform(id);
      setPhase("detail");
      const params = new URLSearchParams(searchParams.toString());
      params.set("platform", id);
      params.delete("tab");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const goBackToPicker = useCallback(() => {
    setActiveTab("connect");
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const runCreateOAuthClient = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await createClaudeWebOAuthClientAction();
      if (!result.ok) {
        setError(result.error);
        toast.danger(result.error, { timeout: 4500 });
        return;
      }
      setOauthClients((prev) => [result.row, ...prev]);
      setOauthSecretOnce({ clientId: result.clientId, secret: result.clientSecret });
      bumpEngagement();
      toast.success("OAuth client created — copy the secret now; it is only shown once.", { timeout: 5200 });
    });
  }, [bumpEngagement, startTransition]);

  const revokeOauthClient = useCallback(
    (id: string) => {
      setError(null);
      startTransition(async () => {
        const result = await revokeOAuthClientAction(id);
        if (!result.ok) {
          setError(result.error);
          toast.danger(result.error, { timeout: 4500 });
          return;
        }
        setOauthClients((prev) =>
          prev.map((c) => (c.id === id ? { ...c, revoked_at: new Date().toISOString() } : c)),
        );
        toast.success("OAuth client revoked.", { timeout: 2500 });
      });
    },
    [startTransition],
  );

  function runCreateKeyAdvanced() {
    setError(null);
    startTransition(async () => {
      const result: CreateApiKeyResult = await createApiKeyAction(label);
      if (!result.ok) {
        setError(result.error);
        toast.danger(result.error, { timeout: 4500 });
        return;
      }
      setInstallKey(result.apiKey);
      setInstallKeyId(result.row.id);
      setKeys((prev) => [result.row, ...prev]);
      bumpEngagement();
      toast.success("New key ready — session updated for configs below.", { timeout: 3000 });
    });
  }

  const guide = selectedPlatform ? getInstallGuide(selectedPlatform) : null;
  const tryToolGuide = selectedPlatform ? getTryToolGuide(selectedPlatform) : null;

  const handlePrimaryPress = useCallback(() => {
    if (!selectedPlatform || !guide) return;
    if (ctx) {
      const validate = validateInstallContext(ctx, {
        requiresRemoteHttps: selectedPlatform === "claudeWeb",
      });
      if (!validate.ok) {
        toast.danger(validate.message, { timeout: 4500 });
        return;
      }
    }
    try {
      switch (guide.primaryKind) {
        case "deeplink_cursor": {
          if (!ctx) return;
          bumpEngagement();
          window.location.href = buildCursorMcpInstallDeeplink(ctx);
          toast.success("Opening Cursor… Follow the prompt to install.", { timeout: 3500 });
          break;
        }
        case "copy_vscode": {
          if (!ctx) return;
          bumpEngagement();
          copy(formatVsCodeMcpJson(ctx), "VS Code config copied — paste into .vscode/mcp.json");
          break;
        }
        case "copy_claude_desktop": {
          if (!ctx) return;
          bumpEngagement();
          copy(
            formatClaudeDesktopConfigJson(ctx),
            "Claude Desktop config copied — paste in Developer → Edit Config",
          );
          break;
        }
        case "copy_claude_web_url": {
          bumpEngagement();
          copy(
            formatClaudeWebCopyText(baseUrl),
            "Remote MCP URL copied — paste in claude.ai custom connector (use OAuth ID/secret from below)",
          );
          break;
        }
        case "copy_windsurf": {
          if (!ctx) return;
          bumpEngagement();
          copy(formatWindsurfMcpJson(ctx), "Windsurf config copied — paste in MCP settings");
          break;
        }
        case "copy_claude_code": {
          if (!ctx) return;
          bumpEngagement();
          copy(
            formatClaudeCodeCommandBundle(ctx),
            "Claude Code command bundle copied — pick bash/zsh, fish, or PowerShell",
          );
          break;
        }
        case "copy_universal": {
          if (!ctx) return;
          bumpEngagement();
          copy(formatUniversalConfigJson(ctx), "Universal config copied");
          break;
        }
        default:
          break;
      }
    } catch (err: unknown) {
      toast.danger(err instanceof Error ? err.message : "Could not prepare MCP config.", {
        timeout: 4500,
      });
    }
  }, [selectedPlatform, guide, ctx, baseUrl, bumpEngagement, copy]);

  const primaryNeedsCtx = guide?.needsInstallContext ?? true;
  const primaryDisabled = primaryNeedsCtx && !ctx;
  const showCopyIcon = guide ? guide.primaryKind !== "deeplink_cursor" : false;

  const verifyChecklist = selectedPlatform
    ? {
        cursor: [
          "Cursor MCP panel shows yalp as installed/running.",
          "Confirm “Looks connected” updates after Yalp tools run in chat.",
        ],
        vscode: [
          "VS Code MCP/Copilot tools shows yalp server started.",
          "Confirm “Looks connected” updates after Yalp tools run.",
        ],
        windsurf: [
          "Windsurf MCP settings shows yalp server configured.",
          "Confirm “Looks connected” updates after Yalp tools run.",
        ],
        manual: [
          "Your client accepted the pasted MCP server config.",
          "Confirm “Looks connected” updates after a Yalp tool runs.",
        ],
        claudeDesktop: [
          "Claude Desktop reloads with yalp server present.",
          "Confirm “Looks connected” updates after Yalp tools run in chat.",
        ],
        claudeCode: [
          "Run the copied shell command bundle for your shell.",
          "Confirm CLI MCP shows yalp and “Looks connected” updates after tools run.",
        ],
        claudeWeb: [
          "OAuth credentials in claude.ai Advanced; remote MCP URL added; Connect and browser sign-in completed.",
          "Confirm “Looks connected” updates after Yalp tools run in Claude.",
        ],
      }[selectedPlatform]
    : null;

  const verifyFlowBlock = verifyChecklist ? (
    <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-3 sm:p-4">
      <p className="mb-1.5 text-xs font-semibold text-foreground">Verify this platform connection</p>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted">
        {verifyChecklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </div>
  ) : null;

  const verifyNpmBlock = (
    <div className="rounded-2xl border border-[#ececec] bg-[#fafafa] p-3 sm:p-4">
      <p className="mb-1.5 text-xs font-semibold text-foreground">Verify npm package locally</p>
      <p className="mb-3 text-xs text-muted">
        Optional troubleshooting: run once in a terminal to confirm the published MCP package downloads and starts.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <code className="min-h-10 min-w-0 flex-1 overflow-auto rounded-[12px] border border-[#e8e8e8] bg-white px-3 py-2.5 font-mono text-xs leading-snug text-foreground shadow-[inset_0_1px_0_rgba(0,0,0,0.03)]">
          {SYNC_VERIFY_NPX_COMMAND}
        </code>
        <Button
          variant="secondary"
          className="shrink-0"
          onPress={() => copy(SYNC_VERIFY_NPX_COMMAND, "Command copied")}
        >
          <span className="inline-flex items-center gap-2">
            <CopyIcon size={16} strokeWidth={2} className="text-current" aria-hidden="true" />
            Copy
          </span>
        </Button>
      </div>
    </div>
  );

  const tabClass = (tab: McpTab) =>
    [
      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
      activeTab === tab
        ? "bg-[#f0f0f0] text-foreground"
        : "text-muted hover:text-foreground",
    ].join(" ");

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="space-y-2">
        {phase === "detail" && activeTab === "connect" ? (
          <Button
            variant="ghost"
            className="h-8 min-h-8 -ml-2 gap-1 px-2 text-muted hover:text-foreground"
            onPress={goBackToPicker}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={1.75} aria-hidden />
            Back
          </Button>
        ) : null}
        <h1 className="font-title text-balance text-xl font-semibold leading-snug text-foreground sm:text-2xl">
          MCP Connections
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted">
          One-click setup for Cursor, Claude, VS Code, and other MCP-ready clients
        </p>
      </header>

      <nav
        className="flex w-full flex-wrap items-center gap-1"
        aria-label="MCP sections"
        role="tablist"
      >
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "connect"}
            className={tabClass("connect")}
            onClick={() => setTab("connect")}
          >
            Connect
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "active"}
            className={tabClass("active")}
            onClick={() => setTab("active")}
          >
            Active connections
          </button>
        </div>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "faq"}
          className={`${tabClass("faq")} ml-auto`}
          onClick={() => setTab("faq")}
        >
          FAQ
        </button>
      </nav>

      <div className="rounded-[28px] border border-[#eaeaea]/90 bg-white p-6 shadow-[0_12px_40px_-22px_rgba(15,23,42,0.09),0_4px_14px_-6px_rgba(15,23,42,0.06)]">
        {error ? (
          <p className="mb-4 text-sm text-[color:var(--color-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {activeTab === "connect" ? (
          <div className="space-y-6">
            {phase === "pick" ? (
              <>
                <div className="space-y-2">
                  <h2 className="font-title text-lg font-semibold leading-snug text-foreground sm:text-xl">
                    Choose your AI tool
                  </h2>
                  <p className="text-sm text-muted">
                    Select where you use AI. We’ll prepare secure access when you open the next screen — you won’t need
                    to copy an API key on the main path.
                  </p>
                </div>
                <McpPlatformPicker
                  platformOrder={platformOrder}
                  suggestedIds={suggestedIds}
                  onSelect={selectPlatform}
                />
                {verifyFlowBlock}
              </>
            ) : null}

            {phase === "detail" && selectedPlatform && guide && tryToolGuide ? (
              <>
                {selectedPlatform === "claudeWeb" ? (
                  <ClaudeWebConnectSteps
                    headline={guide.headline}
                    subline={guide.subline}
                    showActivity={showActivity}
                    activityMessage={activityMessage}
                    mcpRemoteUrl={mcpRemoteUrl}
                    oauthSecretOnce={oauthSecretOnce}
                    onDismissSecret={() => setOauthSecretOnce(null)}
                    activeOAuthClientCount={activeOAuthClients.length}
                    onOpenActiveConnections={() => setTab("active")}
                    onCreateClient={runCreateOAuthClient}
                    onCopy={copy}
                    isPending={isPending}
                  />
                ) : (
                  <McpPlatformDetail
                    platform={selectedPlatform}
                    guide={guide}
                    onPrimaryPress={handlePrimaryPress}
                    primaryDisabled={primaryDisabled}
                    isEnsuringKey={isEnsuringInstall}
                    showPrimaryIcon={showCopyIcon}
                    showActivity={showActivity}
                    activityMessage={activityMessage}
                  />
                )}
              </>
            ) : null}
          </div>
        ) : null}

        {activeTab === "active" ? (
          <div className="space-y-4 text-sm">
            <div>
              <h2 className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">API keys & security</h2>
              <p className="mt-0.5 text-[11px] text-muted sm:text-xs">Keys, revoke, developer checks</p>
            </div>

            {phase === "detail" ? (
              <div className="space-y-4">
                {verifyFlowBlock}
                {selectedPlatform === "claudeWeb" ? (
                  <p className="text-xs text-muted">
                    Claude Web uses <span className="font-medium text-foreground">OAuth clients</span> from the Connect tab — not
                    your <code className="rounded bg-[#fafafa] px-1 py-0.5 text-[11px]">yalp_</code> key. Revoke OAuth clients
                    in the list below if you rotate credentials.
                  </p>
                ) : null}
                {verifyNpmBlock}
              </div>
            ) : null}

            <p className="text-xs text-muted">
              On Windows, Claude Desktop’s config file path differs from macOS — use Settings → Developer → Edit Config to
              open the correct file.
            </p>

            <div className="space-y-2">
              <Label htmlFor="advanced-mcp-key-input" className="text-sm font-medium text-foreground">
                Label for new key
              </Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
                <TextField
                  name="label"
                  value={label}
                  onChange={(v) => setLabel(String(v))}
                  className="min-w-0 flex-1 sm:max-w-xs"
                >
                  <Input id="advanced-mcp-key-input" placeholder="MCP Key" fullWidth />
                </TextField>
                <Button
                  variant="secondary"
                  isDisabled={isPending}
                  onPress={runCreateKeyAdvanced}
                  className="h-10 min-h-10 w-full shrink-0 sm:w-auto sm:min-w-[10.5rem]"
                >
                  {isPending ? "Generating…" : "Generate another key"}
                </Button>
              </div>
            </div>

            {installKey ? (
              <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
                <p className="text-xs font-medium text-foreground">Current session install key</p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted">{installKey}</p>
                <Button variant="secondary" className="mt-2 h-8 min-h-8 text-xs" onPress={() => copy(installKey, "Key copied")}>
                  Copy key
                </Button>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-medium text-foreground">Claude Web OAuth clients</p>
              <p className="mb-2 text-[11px] text-muted">
                Used in claude.ai Advanced settings. Secret is only shown once at creation — revoke and create a new client to
                rotate.
              </p>
              {oauthClients.filter((c) => !c.revoked_at).length === 0 ? (
                <p className="text-xs text-muted">No active OAuth clients.</p>
              ) : (
                <ul className="mb-6 flex flex-col gap-2">
                  {oauthClients
                    .filter((c) => !c.revoked_at)
                    .map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-col justify-between gap-2 rounded-[14px] border border-[#ececec] bg-white p-3 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          <p className="mt-0.5 break-all font-mono text-[11px] text-muted">{c.public_id}</p>
                        </div>
                        <Button
                          variant="secondary"
                          className="h-8 min-h-8 shrink-0 text-xs"
                          isDisabled={isPending}
                          onPress={() => revokeOauthClient(c.id)}
                        >
                          Revoke
                        </Button>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">Your API keys</p>
              {keys.length === 0 ? (
                <p className="text-xs text-muted">No keys yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {keys.map((k) => (
                    <li
                      key={k.id}
                      className="flex flex-col justify-between gap-2 rounded-[14px] border border-[#ececec] bg-white p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{k.label || "MCP Key"}</p>
                        <p className="text-[11px] text-muted">
                          Created {k.created_at ? new Date(k.created_at).toLocaleString() : "—"}
                          {" · "}
                          Last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        isDisabled={isPending}
                        className="h-8 min-h-8 shrink-0 text-xs"
                        onPress={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = await revokeApiKeyAction(k.id);
                            if (!result.ok) {
                              setError(result.error);
                              toast.danger(result.error, { timeout: 4500 });
                              return;
                            }
                            setKeys((prev) => prev.filter((x) => x.id !== k.id));
                            if (installKeyId === k.id) {
                              setInstallKey(null);
                              setInstallKeyId(null);
                              setupDetailRef.current = false;
                              clearQuickInstallSession();
                            }
                            toast.success("Key revoked.", { timeout: 2500 });
                          });
                        }}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "faq" ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-title text-lg font-semibold leading-snug text-foreground sm:text-xl">FAQ</h2>
              <p className="text-sm text-muted">Quick answers for MCP setup.</p>
            </div>

            <div className="space-y-2">
              <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span>What is MCP?</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={1.75}
                    className="text-muted transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="mt-2 text-xs text-muted">
                  MCP (Model Context Protocol) lets AI clients call your Yalp tools securely. After you connect with an
                  API key, clients can manage todos and lists without wiring custom endpoints.
                </p>
              </details>

              <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span>Where do I paste configs?</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={1.75}
                    className="text-muted transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <p>
                    <span className="font-medium text-foreground">Cursor</span>: Use Add to Cursor from the Cursor setup
                    screen.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">VS Code</span>: paste into{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">.vscode/mcp.json</code> and start the yalp
                    server in MCP/Copilot tools.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Windsurf</span>: paste the copied JSON in MCP settings; if
                    labels differ, map to server command/args/env fields.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Claude Desktop</span>:{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">{CLAUDE_DESKTOP_CONFIG_HINT}</code>{" "}
                    (macOS).
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Claude Web</span>: remote URL{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">{mcpRemoteUrl}</code> plus OAuth Client ID and
                    Secret from this page (Connect → Claude Web). Stdio legacy URL:{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">{mcpApiUrl}</code>.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Other clients</span>: use universal JSON; some clients use{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">mcpServers</code>, some use{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">servers</code>.
                  </p>
                </div>
              </details>

              <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span>Friendly tool aliases</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={1.75}
                    className="text-muted transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <p>
                    Examples: <code className="rounded bg-white px-1 py-0.5 text-[11px]">list_todos</code> /{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">todo_list</code>,{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">create_todo</code> /{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">todo_create</code>.
                  </p>
                  <p>If tools don’t appear, confirm the client is connected and the API key matches this page.</p>
                </div>
              </details>

              <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span>Auth errors on claude.ai (Claude Web custom connector)</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={1.75}
                    className="text-muted transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <p>
                    Create an OAuth client on this page (Connect → Claude Web), then paste{" "}
                    <span className="font-medium text-foreground">Client ID</span> and{" "}
                    <span className="font-medium text-foreground">Client Secret</span> into claude.ai Advanced settings. Your
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]"> yalp_</code> API key is for stdio clients only.
                  </p>
                  <p>
                    If Connect fails, confirm you are signed into the same Yalp account that owns the OAuth client, and that
                    redirect URIs on the server include Anthropic&apos;s callback (
                    <code className="rounded bg-white px-1 py-0.5 text-[10px]">YALP_OAUTH_ALLOWED_REDIRECT_URIS</code>).
                  </p>
                  <p>
                    Optional future: static Bearer for Web without OAuth is tracked in{" "}
                    <a
                      href="https://github.com/anthropics/claude-ai-mcp/issues/112"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                    >
                      claude-ai-mcp#112
                    </a>
                    .
                  </p>
                  <p>
                    If API keys fail after a deploy, regenerate them after any{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">YALP_API_KEY_PEPPER</code> change.
                  </p>
                </div>
              </details>

              <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span>Endpoint works in curl but Claude still errors</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={1.75}
                    className="text-muted transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <p>
                    If a direct <code className="rounded bg-white px-1 py-0.5 text-[11px]">POST</code> to{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px]">/api/mcp/stream</code> with your key succeeds
                    but Claude.ai still fails, capture the failing request in the browser Network tab (URL + status) and report
                    it to Anthropic’s MCP integration hub:{" "}
                    <a
                      href="https://github.com/anthropics/claude-ai-mcp/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                    >
                      anthropics/claude-ai-mcp (Issues)
                    </a>
                    .
                  </p>
                </div>
              </details>

              <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span>Claude Web says connected — what should I try first?</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={1.75}
                    className="text-muted transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <p>After connector auth is set, send one short instruction first.</p>
                  <p>
                    Example: <code className="rounded bg-white px-1 py-0.5 text-[11px]">List my todos</code>
                  </p>
                  <p>
                    If this succeeds, you should see <span className="font-medium text-foreground">Looks connected</span>{" "}
                    update on this page.
                  </p>
                </div>
              </details>
            </div>
          </div>
        ) : null}
      </div>

      {activeTab === "connect" && phase === "detail" && selectedPlatform && guide && tryToolGuide ? (
        <McpTryToolExamples guide={tryToolGuide} />
      ) : null}

      {activeTab === "connect" && phase === "detail" && selectedPlatform && guide ? (
        <McpPlatformTroubleshooting />
      ) : null}
    </div>
  );
}
