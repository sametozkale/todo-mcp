"use client";

import { ArrowRight01Icon, McpServerIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

function isIntegrationDetail(value: string | null): value is "whatsapp" {
  return value === "whatsapp";
}

export function IntegrationsHubClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasLegacyDetailParam = isIntegrationDetail(searchParams.get("integration"));

  useEffect(() => {
    if (!hasLegacyDetailParam) return;
    router.replace(pathname, { scroll: false });
  }, [hasLegacyDetailParam, pathname, router]);

  const goMcp = useCallback(() => {
    router.push("/mcp");
  }, [router]);

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="space-y-2">
        <h1 className="font-title text-balance text-xl font-semibold leading-snug text-foreground sm:text-2xl">
          Integrations
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted">
          Connect messaging channels and AI tools to your Yalp workspace. Open an integration for step-by-step setup.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={goMcp}
          className={[
            "group flex w-full items-start justify-start gap-4 rounded-2xl border border-[#ececec] bg-white p-4 text-left transition-colors",
            "hover:border-[#d4d4d4] hover:bg-[#fafafa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/20",
          ].join(" ")}
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#e8e8e8] bg-[#fafafa]">
            <HugeiconsIcon icon={McpServerIcon} size={26} strokeWidth={1.75} className="text-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-title text-base font-semibold text-foreground">MCP Connections</span>
            <span className="mt-0.5 block text-sm text-muted">
              Cursor, Claude, VS Code, Windsurf — one-click install and API keys
            </span>
          </span>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={20}
            strokeWidth={1.75}
            className="shrink-0 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          />
        </button>

        <div
          className="flex w-full items-start justify-start gap-4 rounded-2xl border border-[#ececec] bg-white p-4 text-left opacity-90"
          aria-label="WhatsApp integration coming soon"
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#e8e8e8] bg-[#fafafa]">
            <Image src="https://www.whatsapp.com/favicon.ico" alt="" width={28} height={28} className="h-7 w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-title text-base font-semibold text-foreground">WhatsApp</span>
            <span className="mt-0.5 block text-sm text-muted">Add and complete todos from WhatsApp</span>
          </span>
          <span className="rounded-full border border-[#e6e6e6] bg-[#f7f7f7] px-2.5 py-1 text-xs font-medium text-muted">
            soon
          </span>
        </div>

        <div
          className="flex w-full items-start justify-start gap-4 rounded-2xl border border-[#ececec] bg-white p-4 text-left opacity-90"
          aria-label="Telegram integration coming soon"
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#e8e8e8] bg-[#fafafa]">
            <Image src="https://telegram.org/img/t_logo.png" alt="" width={28} height={28} className="h-7 w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-title text-base font-semibold text-foreground">Telegram</span>
            <span className="mt-0.5 block text-sm text-muted">Create and manage todos from Telegram chat</span>
          </span>
          <span className="rounded-full border border-[#e6e6e6] bg-[#f7f7f7] px-2.5 py-1 text-xs font-medium text-muted">
            soon
          </span>
        </div>
      </div>
    </div>
  );
}
