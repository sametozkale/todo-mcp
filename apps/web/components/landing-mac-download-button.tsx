"use client";

import { getMacDownloadOptions } from "@/lib/mac-desktop-download";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Copy } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = `mac-download-${variant}-menu`;
  const options = getMacDownloadOptions();
  const quarantineCommand = 'xattr -dr com.apple.quarantine "/Applications/Yalp.app"';

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

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(quarantineCommand);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

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
          className="absolute right-0 z-40 mt-2 w-[320px] overflow-hidden rounded-xl border border-[#ececf2] bg-white p-1 shadow-[0px_10px_24px_rgba(16,24,40,0.12)]"
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
          <div className="mt-1 rounded-lg border border-[#eef0f6] bg-[#fafbff] px-3 py-2.5">
            <p className="font-title text-[12px] font-medium text-[#181925]">Downloaddan sonra acilmazsa:</p>
            <ol className="mt-1.5 space-y-1 font-title text-[11px] leading-[1.45] text-[#656b78]">
              <li>1) Uygulamayi Applications klasorune tasiyin.</li>
              <li>2) Yalp.app uzerine sag tiklayip Open secin.</li>
              <li>3) Hala bloklaniyorsa asagidaki komutu calistirin.</li>
            </ol>
            <div className="mt-2 rounded-md border border-[#e8ebf4] bg-white px-2 py-1.5">
              <code className="block overflow-x-auto whitespace-nowrap font-mono text-[10px] text-[#3b4353]">
                {quarantineCommand}
              </code>
            </div>
            <button
              type="button"
              onClick={copyCommand}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#e4e7ef] bg-white px-2 py-1 font-title text-[11px] font-medium text-[#2a3140] transition hover:bg-[#f5f7fc]"
            >
              {copied ? <Check className="h-3 w-3 text-[#0f9f6e]" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
              <span>{copied ? "Komut kopyalandi" : "Komutu kopyala"}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
