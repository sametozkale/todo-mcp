"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import Image from "next/image";
import { Copy as CopyIcon } from "lucide-react";
import { ClaudeBrandIcon } from "@/components/claude-brand-icon";
import type { InstallGuide, PlatformId, TryToolGuide } from "@/lib/mcp-platform-guides";

function PlatformIcon({ id }: { id: PlatformId }) {
  switch (id) {
    case "cursor":
      return (
        <Image src="https://www.cursor.com/favicon.ico" alt="" width={20} height={20} className="h-5 w-5" />
      );
    case "vscode":
      return (
        <Image
          src="https://code.visualstudio.com/favicon.ico"
          alt=""
          width={20}
          height={20}
          className="h-5 w-5"
        />
      );
    case "claudeDesktop":
    case "claudeWeb":
      return <ClaudeBrandIcon className="h-5 w-5 shrink-0" />;
    case "windsurf":
      return <Image src="https://windsurf.com/favicon.ico" alt="" width={20} height={20} className="h-5 w-5" />;
    case "claudeCode":
      return <ClaudeBrandIcon className="h-5 w-5 shrink-0" />;
    case "manual":
      return (
        <span className="flex h-5 w-5 items-center justify-center text-xs font-semibold text-[#444]">&gt;_</span>
      );
    default:
      return null;
  }
}

type Props = {
  platform: PlatformId;
  guide: InstallGuide;
  onPrimaryPress: () => void;
  primaryDisabled: boolean;
  isEnsuringKey: boolean;
  showPrimaryIcon: boolean;
  showActivity: boolean;
  activityMessage: string;
};

export function McpPlatformDetail({
  platform,
  guide,
  onPrimaryPress,
  primaryDisabled,
  isEnsuringKey,
  showPrimaryIcon,
  showActivity,
  activityMessage,
}: Props) {
  return (
    <div className="flex flex-col">
      <div className="mb-5 flex flex-col gap-3">
        <div className="inline-flex items-start justify-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e8e8e8] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <PlatformIcon id={platform} />
          </span>
          <div className="min-w-0">
            <h2 className="font-title text-balance text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {guide.headline}
            </h2>
            <p className="mt-0.5 text-pretty text-sm text-muted">{guide.subline}</p>
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
      </div>

      <ol className="mb-6 space-y-4">
        {guide.steps.map((step, i) => {
          const hasDescription = Boolean(step.description);
          return (
            <li key={i} className={`flex gap-3 ${hasDescription ? "items-start" : "items-center"}`}>
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#e4e4e4] bg-[#fafafa] text-[11px] font-semibold leading-none tabular-nums text-foreground"
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-foreground">{step.title}</p>
                {step.description ? <p className="mt-1 text-xs text-muted">{step.description}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex max-w-full flex-col gap-2 self-start">
        <Button
          variant="primary"
          className="h-10 min-h-10 w-fit max-w-full rounded-[12px] px-4 motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out active:scale-[0.99]"
          onPress={onPrimaryPress}
          isDisabled={primaryDisabled || isEnsuringKey}
          aria-busy={isEnsuringKey}
        >
          <span className="inline-flex items-center gap-2">
            {showPrimaryIcon ? (
              <CopyIcon size={18} strokeWidth={2} className="shrink-0 text-current" aria-hidden />
            ) : null}
            {isEnsuringKey ? "Preparing secure access…" : guide.primaryLabel}
          </span>
        </Button>
        {isEnsuringKey ? (
          <>
            <span className="sr-only" aria-live="polite">
              Preparing secure access for MCP.
            </span>
            <div
              className="h-1.5 w-full min-w-[12rem] max-w-[20rem] overflow-hidden rounded-full bg-[#ececec]"
              aria-hidden
            >
              <div className="h-full w-2/5 rounded-full bg-neutral-400/55 motion-safe:animate-pulse motion-reduce:w-full motion-reduce:animate-none motion-reduce:bg-neutral-400/35" />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function McpTryToolExamples({ guide }: { guide: TryToolGuide }) {
  return (
    <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-3 sm:p-4">
      <p className="text-xs font-semibold text-foreground">{guide.title}</p>
      <p className="mt-1 text-xs text-muted">{guide.subtitle}</p>
      <ul className="mt-2 space-y-1.5">
        {guide.examples.map((line) => (
          <li key={line}>
            <code className="block overflow-x-auto rounded-[10px] border border-[#e8e8e8] bg-white px-2.5 py-2 text-[11px] text-foreground">
              {line}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function McpPlatformTroubleshooting() {
  return (
    <details className="group rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span>Troubleshooting</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          strokeWidth={1.75}
          className="text-muted transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
        <li>If copy fails, allow clipboard permissions and try again.</li>
        <li>If tools do not run, confirm your API key (stdio) or OAuth access token (Claude Web) path is correct.</li>
        <li>
          <span className="font-medium text-foreground">Claude Web:</span> use the OAuth client from this page in Advanced
          settings — not your <code className="rounded bg-white px-1 py-0.5 text-[11px]">yalp_</code> API key.
        </li>
        <li>
          <span className="font-medium text-foreground">401 on tools/call:</span> Yalp returns HTTP 401 by default when
          auth is missing (set <code className="rounded bg-white px-1 py-0.5 text-[11px]">YALP_MCP_LEGACY_AUTH_HTTP200=true</code>{" "}
          only if an old client expects 200 + JSON-RPC errors).
        </li>
        <li>
          If the app still reports an invalid key after a deploy, generate a new key — especially if{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px]">YALP_API_KEY_PEPPER</code> changed.
        </li>
      </ul>
    </details>
  );
}
