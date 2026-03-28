"use client";

import Image from "next/image";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PlatformId } from "@/lib/mcp-platform-guides";
import { getInstallGuide } from "@/lib/mcp-platform-guides";

function PlatformIcon({ id }: { id: PlatformId }) {
  switch (id) {
    case "cursor":
      return (
        <Image src="https://www.cursor.com/favicon.ico" alt="" width={24} height={24} className="h-6 w-6" />
      );
    case "vscode":
      return (
        <Image
          src="https://code.visualstudio.com/favicon.ico"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6"
        />
      );
    case "claudeDesktop":
    case "claudeWeb":
      return (
        <Image
          src="https://raw.githubusercontent.com/simple-icons/simple-icons/master/icons/claude.svg"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6"
        />
      );
    case "windsurf":
      return <Image src="https://windsurf.com/favicon.ico" alt="" width={24} height={24} className="h-6 w-6" />;
    case "claudeCode":
    case "manual":
      return (
        <span className="flex h-6 w-6 items-center justify-center text-sm font-semibold text-[#444]">&gt;_</span>
      );
    default:
      return null;
  }
}

type Props = {
  platformOrder: PlatformId[];
  suggestedIds: Set<PlatformId>;
  onSelect: (id: PlatformId) => void;
};

export function McpPlatformPicker({ platformOrder, suggestedIds, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {platformOrder.map((id) => {
        const g = getInstallGuide(id);
        const suggested = suggestedIds.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={[
              "flex w-full items-center gap-4 rounded-2xl border border-[#ececec] bg-white p-4 text-left transition-colors",
              "hover:border-[#d4d4d4] hover:bg-[#fafafa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/20",
            ].join(" ")}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#e8e8e8] bg-[#fafafa]">
              <PlatformIcon id={id} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-title text-base font-semibold text-foreground">{g.pickerTitle}</span>
                {suggested ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-[2px] text-[10px] font-medium uppercase tracking-wide text-sky-800">
                    Suggested
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-sm text-muted">{g.pickerBlurb}</span>
            </span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={20}
              strokeWidth={1.75}
              className="shrink-0 text-muted"
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
