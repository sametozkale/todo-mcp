"use client";

import { getMacDownloadOptions } from "@/lib/mac-desktop-download";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Copy, X } from "lucide-react";
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
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
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

  useEffect(() => {
    if (!isInfoModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsInfoModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isInfoModalOpen]);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(quarantineCommand);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block", variant === "footer" && "self-start")}>
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
        <span>Download</span>
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
          className="absolute right-0 z-40 mt-2 w-full overflow-hidden rounded-xl border border-[#ececf2] bg-white p-1 shadow-[0px_10px_24px_rgba(16,24,40,0.12)]"
        >
          {options.map((option) => (
            <a
              key={option.arch}
              href={option.href}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                setIsInfoModalOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-title text-[13px] text-[#181925] no-underline transition hover:bg-[#f7f8fb]"
            >
              <span>{option.label}</span>
              <span className="text-[12px] text-[#8a8e99]">{option.arch === "arm64" ? "ARM" : "x64"}</span>
            </a>
          ))}
        </div>
      ) : null}

      {isInfoModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#101828]/45 px-4"
          role="presentation"
          onClick={() => setIsInfoModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${menuId}-help-title`}
            className="w-full max-w-[420px] rounded-2xl border border-[#e9ecf4] bg-white p-4 shadow-[0_20px_60px_rgba(16,24,40,0.24)] sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 id={`${menuId}-help-title`} className="font-title text-[16px] font-semibold text-[#181925]">
                Downloaddan sonra acilmazsa
              </h3>
              <button
                type="button"
                onClick={() => setIsInfoModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e8f0] text-[#71778a] transition hover:bg-[#f7f8fc] hover:text-[#1f2533]"
                aria-label="Modali kapat"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <ol className="space-y-1.5 font-title text-[13px] leading-[1.5] text-[#586074]">
              <li>1) Uygulamayi Applications klasorune tasiyin.</li>
              <li>2) Yalp.app uzerine sag tiklayip Open secin.</li>
              <li>3) Hala bloklaniyorsa asagidaki komutu calistirin.</li>
            </ol>
            <div className="mt-3 rounded-lg border border-[#e8ebf4] bg-[#fafbff] px-3 py-2">
              <code className="block overflow-x-auto whitespace-nowrap font-mono text-[11px] text-[#364156]">
                {quarantineCommand}
              </code>
            </div>
            <button
              type="button"
              onClick={copyCommand}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#e2e6f0] bg-white px-3 py-1.5 font-title text-[12px] font-medium text-[#2a3140] transition hover:bg-[#f5f7fc]"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#0f9f6e]" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              <span>{copied ? "Komut kopyalandi" : "Komutu kopyala"}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
