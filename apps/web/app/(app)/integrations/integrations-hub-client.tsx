"use client";

import { ArrowLeft01Icon, ArrowRight01Icon, McpServerIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WhatsAppIntegrationDetail } from "./whatsapp-integration-detail";

type Props = {
  initialWhatsappLinked: boolean;
  initialWhatsappPhone: string | null;
};

function isIntegrationDetail(value: string | null): value is "whatsapp" {
  return value === "whatsapp";
}

export function IntegrationsHubClient({ initialWhatsappLinked, initialWhatsappPhone }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"pick" | "whatsapp">(() =>
    isIntegrationDetail(searchParams.get("integration")) ? "whatsapp" : "pick",
  );

  useEffect(() => {
    const raw = searchParams.get("integration");
    if (isIntegrationDetail(raw)) setPhase("whatsapp");
    else setPhase("pick");
  }, [searchParams]);

  const openWhatsapp = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("integration", "whatsapp");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const goBack = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const goMcp = useCallback(() => {
    router.push("/mcp");
  }, [router]);

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="space-y-2">
        {phase === "whatsapp" ? (
          <Button
            variant="ghost"
            className="h-8 min-h-8 -ml-2 gap-1 px-2 text-muted hover:text-foreground"
            onPress={goBack}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={1.75} aria-hidden />
            Back
          </Button>
        ) : null}
        <h1 className="font-title text-balance text-xl font-semibold leading-snug text-foreground sm:text-2xl">
          Integrations
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted">
          Connect messaging channels and AI tools to your Yalp workspace. Open an integration for step-by-step setup.
        </p>
      </header>

      {phase === "pick" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={goMcp}
            className={[
              "group flex w-full items-center gap-4 rounded-2xl border border-[#ececec] bg-white p-4 text-left transition-colors",
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

          <button
            type="button"
            onClick={openWhatsapp}
            className={[
              "group flex w-full items-center gap-4 rounded-2xl border border-[#ececec] bg-white p-4 text-left transition-colors",
              "hover:border-[#d4d4d4] hover:bg-[#fafafa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/20",
            ].join(" ")}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#e8e8e8] bg-[#fafafa]">
              <Image
                src="https://www.whatsapp.com/favicon.ico"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-title text-base font-semibold text-foreground">WhatsApp</span>
              <span className="mt-0.5 block text-sm text-muted">
                Link your number to add and complete todos from WhatsApp
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
        </div>
      ) : null}

      {phase === "whatsapp" ? (
        <div className="rounded-[28px] border border-[#eaeaea]/90 bg-white p-6 shadow-[0_12px_40px_-22px_rgba(15,23,42,0.09),0_4px_14px_-6px_rgba(15,23,42,0.06)]">
          <WhatsAppIntegrationDetail
            initialLinked={initialWhatsappLinked}
            initialPhone={initialWhatsappPhone}
          />
        </div>
      ) : null}
    </div>
  );
}
