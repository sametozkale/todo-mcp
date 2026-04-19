"use client";

import { getMacDownloadOptions } from "@/lib/mac-desktop-download";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type LandingMacDownloadButtonProps = {
  /** Hero CTA row vs compact footer branding column */
  variant?: "hero" | "footer";
  className?: string;
};

export function LandingMacDownloadButton({
  variant = "hero",
  className,
}: LandingMacDownloadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = `mac-download-${variant}-menu`;
  const options = getMacDownloadOptions();

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      const target = event.target as Node;
      if (!rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  return (
    <div ref={rootRef} className={cn("relative", variant === "footer" && "self-start")}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "group inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#ececf2] bg-white font-title font-medium text-[rgba(24,25,37,1)] no-underline shadow-[0px_1px_2px_0px_rgba(16,24,40,0.04)] transition hover:border-[#e2e3ea] hover:bg-[#fcfcfd] hover:shadow-[0px_2px_6px_0px_rgba(16,24,40,0.05)]",
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
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center overflow-hidden transition-opacity duration-200 ease-out",
            variant === "hero" ? "h-4 w-4" : "h-[14px] w-[14px]",
            "opacity-100",
          )}
          aria-hidden
        >
          <ChevronDown
            className={cn(
              "shrink-0 text-muted transition-transform",
              variant === "hero" ? "h-4 w-4" : "h-[14px] w-[14px]",
              isOpen && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-40 mt-2 min-w-[190px] overflow-hidden rounded-xl border border-[#ececf2] bg-white p-1 shadow-[0px_10px_24px_rgba(16,24,40,0.12)]"
        >
          {options.map((option) => (
            <a
              key={option.arch}
              href={option.href}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-title text-[13px] text-[#181925] no-underline transition hover:bg-[#f7f8fb]"
            >
              <span>{option.label}</span>
              <span className="text-[12px] text-[#8a8e99]">{option.arch === "arm64" ? "ARM" : "x64"}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
