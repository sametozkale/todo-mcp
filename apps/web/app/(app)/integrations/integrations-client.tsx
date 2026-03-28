"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, Label, TextField, toast } from "@heroui/react";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { Copy as CopyIcon, Info as InfoIcon } from "lucide-react";
import type { ApiKeyRow, CreateApiKeyResult } from "./actions";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

function base64EncodeUtf8(input: string): string {
  // btoa expects latin1; encodeURIComponent produces UTF-8 percent escapes.
  return btoa(unescape(encodeURIComponent(input)));
}

type Props = {
  initialKeys: ApiKeyRow[];
  baseUrl: string;
};

type PlatformCardProps = {
  title: string;
  icon: React.ReactNode;
  description: string;
  status: "connected" | "not_connected" | "error";
  ctaLabel: string;
  ctaIcon?: React.ReactNode;
  infoTooltip?: string;
  onCta: () => void;
  disabled?: boolean;
  helper?: React.ReactNode;
  ctaClassName?: string;
  cardClassName?: string;
};

function StatusBadge({ status }: { status: PlatformCardProps["status"] }) {
  if (status === "connected") {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[3px] text-[11px] font-medium text-emerald-700">
        Connected
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-[3px] text-[11px] font-medium text-rose-700">
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-[#e7e7e7] bg-white px-2 py-[3px] text-[11px] font-medium text-muted opacity-0 transition-opacity group-hover:opacity-100">
      Not Connected
    </span>
  );
}

function PlatformCard({
  title,
  icon,
  description,
  status,
  ctaLabel,
  ctaIcon,
  infoTooltip,
  onCta,
  disabled,
  helper,
  ctaClassName,
  cardClassName,
}: PlatformCardProps) {
  const showInfoIcon = Boolean(infoTooltip && status !== "connected");
  return (
    <div
      className={["group rounded-2xl border border-[#ececec] bg-[#fafafa] p-4", cardClassName]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#e3e3e3] bg-white text-[14px] leading-none">
            {icon}
        </span>
          <div className="inline-flex items-center gap-[6px]">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {showInfoIcon ? (
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#e6e6e6] bg-white/60 text-muted/70 hover:text-foreground/80"
                title={infoTooltip}
                aria-label={infoTooltip}
              >
                <InfoIcon size={14} strokeWidth={2} className="text-current" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="mb-3 text-xs text-muted">{description}</p>
      <Button
        variant={status === "connected" ? "secondary" : "primary"}
        onPress={onCta}
        isDisabled={disabled}
        className={ctaClassName}
      >
        <span className="inline-flex items-center gap-2">
          {ctaIcon ? (
            <span className="inline-flex items-center" aria-hidden="true">
              {ctaIcon}
            </span>
          ) : null}
          {ctaLabel}
        </span>
      </Button>
      {helper ? <div className="mt-2 text-xs text-muted">{helper}</div> : null}
    </div>
  );
}

export function IntegrationsClient({ initialKeys, baseUrl }: Props) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [activeTab, setActiveTab] = useState<"connect" | "active" | "faq">("connect");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [label, setLabel] = useState("MCP Key");
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, PlatformCardProps["status"]>>({
    cursor: "not_connected",
    claudeDesktop: "not_connected",
    claudeWeb: "not_connected",
    windsurf: "not_connected",
    vscode: "not_connected",
    manual: "not_connected",
  });
  const [isPending, startTransition] = useTransition();

  const cursorConfig = useMemo(() => {
    if (!newKey) return null;
    return {
      mcpServers: {
        yalp: {
          command: "npx",
          args: ["-y", "-p", "yalp-mcp-server", "yalp-mcp"],
          env: {
            YALP_API_KEY: newKey,
            YALP_API_BASE_URL: baseUrl,
          },
        },
      },
    };
  }, [newKey, baseUrl]);

  const cursorInstallLink = useMemo(() => {
    if (!cursorConfig) return null;
    const json = JSON.stringify(cursorConfig);
    const configB64 = base64EncodeUtf8(json);
    const name = encodeURIComponent("yalp");
    const config = encodeURIComponent(configB64);
    return `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${config}`;
  }, [cursorConfig]);

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied to clipboard.", { timeout: 2500 }))
      .catch(() => toast.danger("Could not copy to clipboard.", { timeout: 4000 }));
  }

  const syncCommand = "npx -y -p yalp-mcp-server yalp-mcp";
  const universalConfig = JSON.stringify(cursorConfig, null, 2);
  const claudeDesktopConfigPath = "~/Library/Application Support/Claude/claude_desktop_config.json";
  const mcpRemoteUrl = `${baseUrl}/api/mcp`;

  return (
    <div className="flex w-full flex-col gap-6">
      <nav className="flex w-full items-center justify-between gap-3" aria-label="MCP sections">
        <div className="flex flex-wrap items-center gap-[2px]">
          <button
            type="button"
            className={[
              "rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              "inline-flex items-center whitespace-nowrap leading-none",
              activeTab === "connect"
                ? "bg-[#ececec] text-foreground"
                : "text-muted hover:text-foreground/80",
            ].join(" ")}
            onClick={() => setActiveTab("connect")}
            aria-current={activeTab === "connect" ? "page" : undefined}
          >
            Connect
          </button>
          <button
            type="button"
            className={[
              "rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              "inline-flex items-center whitespace-nowrap leading-none",
              activeTab === "active"
                ? "bg-[#ececec] text-foreground"
                : "text-muted hover:text-foreground/80",
            ].join(" ")}
            onClick={() => setActiveTab("active")}
            aria-current={activeTab === "active" ? "page" : undefined}
          >
            Active connections
          </button>
        </div>
        <button
          type="button"
          className={[
            "rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
            "inline-flex items-center whitespace-nowrap leading-none",
            activeTab === "faq"
              ? "bg-[#ececec] text-foreground"
              : "text-muted hover:text-foreground/80",
          ].join(" ")}
          onClick={() => setActiveTab("faq")}
          aria-current={activeTab === "faq" ? "page" : undefined}
        >
          FAQ
        </button>
      </nav>

      {activeTab === "faq" ? (
        <div className="rounded-[28px] border border-[#eaeaea] bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="mb-5 space-y-2">
            <h2 className="font-title text-2xl font-semibold text-foreground">FAQ</h2>
            <p className="text-sm text-muted">Quick answers for setting up MCP connections.</p>
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
                MCP (Model Context Protocol) is a standard protocol that lets AI clients securely call external app
                capabilities as tools. Once you connect this Yalp MCP server with your API key, your client can list,
                create, update, and delete your todos and lists through Yalp—so you don’t have to manually wire
                endpoints or keys for each app.
              </p>
            </details>

            <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>Where do I paste the config?</span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  strokeWidth={1.75}
                  className="text-muted transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <div className="mt-2 space-y-1 text-xs text-muted">
                <p>
                  - <span className="font-medium text-foreground">Cursor</span>: Use the “Add to Cursor” button (deeplink).
                </p>
                <p>
                  - <span className="font-medium text-foreground">Claude Desktop</span>: Paste into{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[11px] text-foreground">
                    {claudeDesktopConfigPath}
                  </code>
                  .
                </p>
                <p>
                  - <span className="font-medium text-foreground">Claude Web</span>: Use the remote MCP URL:{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[11px] text-foreground">{mcpRemoteUrl}</code>
                </p>
              </div>
            </details>

            <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>What are “friendly aliases” and how do I use them?</span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  strokeWidth={1.75}
                  className="text-muted transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <div className="mt-2 space-y-2 text-xs text-muted">
                <p>
                  Friendly aliases are alternate tool names that map to the same Yalp MCP actions. If your client
                  supports tool calling, you can use either name — they behave the same.
                </p>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Examples</p>
                  <p>
                    - <code className="rounded bg-white px-1 py-0.5 text-[11px] text-foreground">list_todos</code>{" "}
                    and{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px] text-foreground">todo_list</code>
                  </p>
                  <p>
                    - <code className="rounded bg-white px-1 py-0.5 text-[11px] text-foreground">create_todo</code>{" "}
                    and{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px] text-foreground">todo_create</code>
                  </p>
                  <p>
                    - <code className="rounded bg-white px-1 py-0.5 text-[11px] text-foreground">update_todo</code>{" "}
                    and{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px] text-foreground">todo_update</code>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">If it “doesn’t work”</p>
                  <p>- Make sure the client is actually connected (check Active connections).</p>
                  <p>- Some clients show only the “canonical” tool names and hide aliases — that’s OK.</p>
                  <p>- If your client can’t see any tools, re-check your API key and MCP URL/config.</p>
                </div>
              </div>
            </details>
          </div>
        </div>
      ) : null}

      {activeTab === "connect" ? (
      <div className="rounded-[28px] border border-[#eaeaea] bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="mb-5 space-y-2">
          <h2 className="font-title text-2xl font-semibold text-foreground">Connect your AI tools via MCP</h2>
          <p className="text-sm text-muted">
            Add your MCP server to Cursor, Claude, Windsurf, VS Code and more with a single click.
          </p>
        </div>

        {error ? (
          <p className="mb-4 text-sm text-[color:var(--color-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ececec] bg-[#fafafa] p-4 md:col-span-1">
            <div className="mb-3 flex items-start gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-foreground">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Create API key</p>
                <p className="mt-0.5 text-xs text-muted">Generate the MCP key used by Cursor, Claude and other clients.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pl-7 sm:flex-row sm:items-end">
              <TextField
                name="label"
                value={label}
                onChange={(v) => setLabel(String(v))}
                className="w-full sm:max-w-xs"
              >
                <Label>Key label</Label>
                <Input placeholder="MCP Key" fullWidth />
              </TextField>
              <Button
                variant="primary"
                isDisabled={isPending}
                className="h-9 min-h-9 sm:h-10 sm:min-h-10"
                onPress={() => {
                  setError(null);
                  startTransition(async () => {
                    const result: CreateApiKeyResult = await createApiKeyAction(label);
                    if (!result.ok) {
                      setError(result.error);
                      setConnectionStatus((prev) => ({ ...prev, cursor: "error" }));
                      toast.danger(result.error, { timeout: 4500 });
                      return;
                    }
                    setNewKey(result.apiKey);
                    setKeys((prev) => [result.row, ...prev]);
                    toast.success("API key generated.", { timeout: 2500 });
                  });
                }}
              >
                {isPending ? "Generating…" : "Generate key"}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ececec] bg-[#fafafa] p-4 md:col-span-2">
            <div className="mb-3 flex items-start gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-foreground">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Choose your platform</p>
                <p className="mt-0.5 text-xs text-muted">Pick the client you want to connect with this Yalp MCP server.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <PlatformCard
                title="Cursor"
                icon={
                  <Image
                    src="https://www.cursor.com/favicon.ico"
                    alt="Cursor logo"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                }
                description="One-click install with Cursor deeplink."
                status={connectionStatus.cursor}
                ctaLabel={connectionStatus.cursor === "connected" ? "Connected" : "Add to Cursor"}
                disabled={!newKey || connectionStatus.cursor === "connected"}
                cardClassName="bg-white"
                ctaClassName="h-7 min-h-7 rounded-[10px]"
                onCta={() => {
                  if (!cursorInstallLink) return;
                  window.location.href = cursorInstallLink;
                  setConnectionStatus((prev) => ({ ...prev, cursor: "connected" }));
                  toast.success("Cursor deeplink launched.", { timeout: 2500 });
                }}
              />
              <PlatformCard
                title="Claude Desktop"
                icon={
                  <Image
                    src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/anthropic.svg"
                    alt="Claude logo"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                }
                description="Use Desktop config file and paste MCP JSON."
                status={connectionStatus.claudeDesktop}
                ctaLabel="Copy Claude Config"
                ctaIcon={<CopyIcon size={16} strokeWidth={2} className="text-current" aria-hidden="true" />}
                disabled={!cursorConfig}
                cardClassName="bg-white"
                ctaClassName="h-7 min-h-7 rounded-[10px]"
                onCta={() => {
                  copy(universalConfig);
                  setConnectionStatus((prev) => ({ ...prev, claudeDesktop: "connected" }));
                }}
                infoTooltip={claudeDesktopConfigPath}
              />
              <PlatformCard
                title="Claude Web"
                icon={
                  <Image
                    src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/anthropic.svg"
                    alt="Claude logo"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                }
                description="Use remote MCP endpoint with authorization flow."
                status={connectionStatus.claudeWeb}
                ctaLabel="Copy MCP URL"
                ctaIcon={<CopyIcon size={16} strokeWidth={2} className="text-current" aria-hidden="true" />}
                cardClassName="bg-white"
                ctaClassName="h-7 min-h-7 rounded-[10px]"
                onCta={() => {
                  copy(mcpRemoteUrl);
                  setConnectionStatus((prev) => ({ ...prev, claudeWeb: "connected" }));
                }}
                infoTooltip={mcpRemoteUrl}
              />
              <PlatformCard
                title="Windsurf"
                icon={
                  <Image
                    src="https://windsurf.com/favicon.ico"
                    alt="Windsurf logo"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                }
                description="Install via Windsurf MCP settings with JSON config."
                status={connectionStatus.windsurf}
                ctaLabel="Copy Config"
                ctaIcon={<CopyIcon size={16} strokeWidth={2} className="text-current" aria-hidden="true" />}
                disabled={!cursorConfig}
                cardClassName="bg-white"
                ctaClassName="h-7 min-h-7 rounded-[10px]"
                onCta={() => {
                  copy(universalConfig);
                  setConnectionStatus((prev) => ({ ...prev, windsurf: "connected" }));
                }}
              />
              <PlatformCard
                title="VS Code"
                icon={
                  <Image
                    src="https://code.visualstudio.com/favicon.ico"
                    alt="VS Code logo"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                }
                description="Paste config to MCP extension or settings.json."
                status={connectionStatus.vscode}
                ctaLabel="Copy VS Code Config"
                ctaIcon={<CopyIcon size={16} strokeWidth={2} className="text-current" aria-hidden="true" />}
                disabled={!cursorConfig}
                cardClassName="bg-white"
                ctaClassName="h-7 min-h-7 rounded-[10px]"
                onCta={() => {
                  copy(universalConfig);
                  setConnectionStatus((prev) => ({ ...prev, vscode: "connected" }));
                }}
              />
              <PlatformCard
                title="Manual / Other"
                icon={<span className="text-[12px] font-semibold text-[#444]">&gt;_</span>}
                description="Universal JSON config for any MCP-compatible client."
                status={connectionStatus.manual}
                ctaLabel="Copy Universal Config"
                ctaIcon={<CopyIcon size={16} strokeWidth={2} className="text-current" aria-hidden="true" />}
                disabled={!cursorConfig}
                cardClassName="bg-white"
                ctaClassName="h-7 min-h-7 rounded-[10px]"
                onCta={() => {
                  copy(universalConfig);
                  setConnectionStatus((prev) => ({ ...prev, manual: "connected" }));
                }}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#ececec] bg-[#fafafa] p-4 md:col-span-1">
            <div className="mb-3 flex items-start gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-foreground">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Connect & verify</p>
                <p className="mt-0.5 text-xs text-muted">Click Connect/Copy on a platform card, then check that it shows under Active connections.</p>
              </div>
            </div>

            <Button variant="secondary" className="self-start" onPress={() => setActiveTab("active")}>
              View Active connections
            </Button>
            <p className="mt-2 text-[11px] text-muted">It may take a few seconds after the client connects.</p>
          </section>
        </div>

        {newKey ? (
          <div className="mt-4 rounded-[16px] border border-[#efefef] bg-[#fafafa] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Your API key (shown once)</p>
                <p className="mt-1 break-all font-mono text-xs text-muted">{newKey}</p>
              </div>
              <Button variant="secondary" onPress={() => copy(newKey)}>
                <span className="inline-flex items-center gap-2">
                  <CopyIcon size={16} strokeWidth={2} className="text-current" aria-hidden="true" />
                  Copy key
                </span>
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <pre className="overflow-auto rounded-[12px] border border-[#ededed] bg-white p-3 text-xs text-foreground">
                {JSON.stringify(cursorConfig, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-[20px] border border-[#ececec] bg-[#fafafa] p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Sync existing project</p>
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#ebebeb] bg-white px-3 py-2">
            <code className="overflow-auto text-xs text-foreground">{syncCommand}</code>
            <Button variant="secondary" onPress={() => copy(syncCommand)}>
              <span className="inline-flex items-center gap-2">
                <CopyIcon size={16} strokeWidth={2} className="text-current" aria-hidden="true" />
                Copy
              </span>
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Run this command to verify the latest Yalp MCP package is available locally.
          </p>
        </div>
      </div>
      ) : null}

      {activeTab === "active" ? (
      <div className="rounded-[24px] border border-[#f4f4f4] bg-white p-6">
        <div className="mb-3 space-y-1">
          <h2 className="font-title text-lg font-semibold text-foreground">Active connections</h2>
          <p className="text-sm text-muted">Client name, timestamps and disconnect actions.</p>
        </div>

        {keys.length === 0 ? (
          <p className="text-sm text-muted">No active connections yet. Connect your first AI tool above.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex flex-col justify-between gap-2 rounded-[16px] border border-[#f4f4f4] bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {k.label || "MCP Key"}
                  </p>
                  <p className="text-xs text-muted">
                    Created {k.created_at ? new Date(k.created_at).toLocaleString() : "—"}
                    {" · "}
                    Last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                    Active
                  </span>
                  <Button
                    variant="secondary"
                    isDisabled={isPending}
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
                        toast.success("Disconnected.", { timeout: 2500 });
                      });
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      ) : null}
    </div>
  );
}

