"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import Image from "next/image";
import { Copy as CopyIcon } from "lucide-react";
import { ClaudeBrandIcon } from "@/components/claude-brand-icon";
import type { InstallGuide, PlatformId } from "@/lib/mcp-platform-guides";

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
      <div className="mb-3 inline-flex items-center gap-3">
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
          className="mb-4 motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out rounded-[14px] border border-emerald-200/90 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_4px_14px_-6px_rgba(5,150,105,0.2)]"
          role="status"
        >
          <p className="font-medium text-emerald-900">Looks connected</p>
          <p className="mt-0.5 text-pretty text-xs text-emerald-800/95">{activityMessage}</p>
        </div>
      ) : (
        <p className="mb-4 text-pretty text-xs leading-relaxed text-muted motion-safe:transition-opacity motion-safe:duration-200">
          When your client calls Yalp through MCP, we show recent activity here — no extra verify step.
        </p>
      )}

      <ol className="mb-6 space-y-4">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e4e4e4] bg-[#fafafa] text-xs font-semibold tabular-nums text-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              {step.description ? <p className="mt-1 text-xs text-muted">{step.description}</p> : null}
            </div>
          </li>
        ))}
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
        <li>If nothing happens in Cursor, confirm Cursor is installed and try the button again.</li>
        <li>If copy fails, check browser permissions for the clipboard.</li>
        <li>For API key issues, expand the API keys section below and confirm keys are not revoked.</li>
        <li>
          VS Code/Windsurf: if the settings UI labels differ, use the copied JSON and map fields per client docs
          (`mcpServers` vs `servers`).
        </li>
        <li>
          Claude Web: use the copied <strong className="font-medium text-foreground">remote MCP</strong> URL (ends with{" "}
          <code className="rounded bg-[#f4f4f4] px-1 py-0.5 text-[11px]">/api/mcp/stream</code>) and paste your API key
          where the connector asks (Bearer token or API key field).
        </li>
        <li>
          Claude Code: the copied command needs the <code className="rounded bg-[#f4f4f4] px-1 py-0.5 text-[11px]">claude</code>{" "}
          CLI installed; use the copied bundle and run the command for your shell (bash/zsh, fish, or PowerShell).
        </li>
      </ul>
    </details>
  );
}
