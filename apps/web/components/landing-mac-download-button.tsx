"use client";

import { getMacDesktopDmgUrl } from "@/lib/mac-desktop-download";
import { cn } from "@/lib/utils";

type LandingMacDownloadButtonProps = {
  /** Hero CTA row vs compact footer branding column */
  variant?: "hero" | "footer";
  className?: string;
};

export function LandingMacDownloadButton({
  variant = "hero",
  className,
}: LandingMacDownloadButtonProps) {
  return (
    <a
      href={getMacDesktopDmgUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-[#ececf2] bg-white font-title font-medium text-[rgba(24,25,37,1)] no-underline shadow-[0px_1px_2px_0px_rgba(16,24,40,0.04)] transition hover:border-[#e2e3ea] hover:bg-[#fcfcfd] hover:shadow-[0px_2px_6px_0px_rgba(16,24,40,0.05)]",
        variant === "hero" &&
          "px-4 py-[11px] text-sm leading-[18px] tracking-[-0.32px]",
        variant === "footer" &&
          "self-start px-3.5 py-2 text-[13px] leading-[18px] tracking-[-0.24px]",
        className,
      )}
    >
      <span
        className={cn(
          "shrink-0 leading-none text-[#1f2937]",
          variant === "hero" ? "text-[18px]" : "text-[16px]",
        )}
        aria-hidden
      >
        
      </span>
      <span>Download macOS app</span>
    </a>
  );
}
