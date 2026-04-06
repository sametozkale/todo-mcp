"use client";

import { Button } from "@heroui/react";
import { Copy as CopyIcon } from "lucide-react";
import { ClaudeBrandIcon } from "@/components/claude-brand-icon";

export type ClaudeWebConnectStepsProps = {
  headline: string;
  subline: string;
  showActivity: boolean;
  activityMessage: string;
  mcpRemoteUrl: string;
  oauthSecretOnce: { clientId: string; secret: string } | null;
  onDismissSecret: () => void;
  activeOAuthClientCount: number;
  onOpenActiveConnections: () => void;
  onCreateClient: () => void;
  onCopy: (text: string, toastMessage: string) => void;
  isPending: boolean;
};

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e4e4e4] bg-[#fafafa] text-sm font-semibold tabular-nums text-foreground">
      {n}
    </span>
  );
}

export function ClaudeWebConnectSteps({
  headline,
  subline,
  showActivity,
  activityMessage,
  mcpRemoteUrl,
  oauthSecretOnce,
  onDismissSecret,
  activeOAuthClientCount,
  onOpenActiveConnections,
  onCreateClient,
  onCopy,
  isPending,
}: ClaudeWebConnectStepsProps) {
  return (
    <div className="flex flex-col">
      <div className="mb-5 flex flex-col gap-3">
        <div className="inline-flex items-start justify-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e8e8e8] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <ClaudeBrandIcon className="h-5 w-5 shrink-0" />
          </span>
          <div className="min-w-0">
            <h2 className="font-title text-balance text-lg font-semibold leading-snug text-foreground sm:text-xl">{headline}</h2>
            <p className="mt-0.5 text-pretty text-sm text-muted">{subline}</p>
          </div>
        </div>

        {showActivity ? (
          <div
            className="motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out rounded-[14px] border border-emerald-200/90 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_4px_14px_-6px_rgba(5,150,105,0.2)]"
            role="status"
          >
            <p className="font-medium text-emerald-900">Looks connected</p>
            <p className="mt-0.5 text-pretty text-xs text-emerald-800/95">{activityMessage}</p>
          </div>
        ) : null}

        {activeOAuthClientCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onPress={onOpenActiveConnections}
            className="h-auto min-h-0 w-fit max-w-full justify-start rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-medium leading-tight text-emerald-900 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset] transition-colors hover:border-emerald-300/90 hover:bg-emerald-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/40"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15"
                aria-hidden
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" />
              </span>
              <span className="text-left">
                {activeOAuthClientCount === 1
                  ? "1 active connection"
                  : `${activeOAuthClientCount} active connections`}
              </span>
            </span>
            <span className="sr-only"> — open Active connections tab</span>
          </Button>
        ) : null}
      </div>

      <ol className="flex flex-col gap-8">
        {/* Step 1 — MCP URL first */}
        <li className="flex gap-3">
          <StepBadge n={1} />
          <div className="min-w-0 flex-1 space-y-3 pt-0.5">
            <div>
              <p className="text-sm font-semibold text-foreground">Copy the remote MCP server URL</p>
              <p className="mt-1 text-xs text-muted">
                Tap the button — the full URL is copied in one step. Paste it first into claude.ai&apos;s connector URL field.
              </p>
            </div>
            <Button
              variant="primary"
              className="h-10 min-h-10 w-fit max-w-full rounded-[12px] px-4"
              onPress={() => onCopy(mcpRemoteUrl, "MCP URL copied — paste into claude.ai")}
              aria-label="Copy remote MCP server URL to clipboard"
            >
              <span className="inline-flex items-center gap-2">
                <CopyIcon size={18} strokeWidth={2} className="shrink-0" aria-hidden />
                Copy MCP URL
              </span>
            </Button>
            <span className="sr-only">{mcpRemoteUrl}</span>
          </div>
        </li>

        {/* Step 2 — OAuth */}
        <li className="flex gap-3">
          <StepBadge n={2} />
          <div className="min-w-0 flex-1 space-y-3 pt-0.5">
            <div>
              <p className="text-sm font-semibold text-foreground">Generate OAuth Client ID &amp; Client Secret</p>
              <p className="mt-1 text-xs text-muted">
                Paste Client ID + Secret into claude.ai <span className="font-medium text-foreground">Advanced</span> —{" "}
                not a <code className="rounded bg-[#f5f5f5] px-1 py-0.5 font-mono text-[11px]">yalp_</code> key (those are
                for local apps only).
              </p>
            </div>

            <Button
              variant="primary"
              className="h-10 min-h-10 w-fit max-w-full rounded-[12px] px-4"
              onPress={onCreateClient}
              isDisabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? "Generating…" : "Generate Client ID & Secret"}
            </Button>

            {oauthSecretOnce ? (
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-3 text-xs text-amber-950">
                <p className="font-semibold text-amber-950">Copy both values now — the secret is shown only once</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-900/85">Paste as OAuth Client ID</p>
                    <code className="block break-all rounded-lg border border-amber-200/80 bg-white px-2.5 py-2 font-mono text-[11px] text-foreground">
                      {oauthSecretOnce.clientId}
                    </code>
                    <Button
                      variant="secondary"
                      className="mt-2 h-8 min-h-8 text-xs"
                      onPress={() => onCopy(oauthSecretOnce.clientId, "Client ID copied — paste into Claude Advanced")}
                    >
                      <span className="inline-flex items-center gap-2">
                        <CopyIcon size={14} strokeWidth={2} aria-hidden />
                        Copy Client ID
                      </span>
                    </Button>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-900/85">Paste as OAuth Client Secret</p>
                    <code className="block break-all rounded-lg border border-amber-200/80 bg-white px-2.5 py-2 font-mono text-[11px] text-foreground">
                      {oauthSecretOnce.secret}
                    </code>
                    <Button
                      variant="secondary"
                      className="mt-2 h-8 min-h-8 text-xs"
                      onPress={() => onCopy(oauthSecretOnce.secret, "Client Secret copied — paste into Claude Advanced")}
                    >
                      <span className="inline-flex items-center gap-2">
                        <CopyIcon size={14} strokeWidth={2} aria-hidden />
                        Copy Client Secret
                      </span>
                    </Button>
                  </div>
                </div>
                <Button variant="ghost" className="mt-3 h-8 px-2 text-xs text-amber-950" onPress={onDismissSecret}>
                  I&apos;ve copied both
                </Button>
              </div>
            ) : null}
          </div>
        </li>
      </ol>
    </div>
  );
}
