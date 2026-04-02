"use client";

import Image from "next/image";
import { Button } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClaudeBrandIcon } from "@/components/claude-brand-icon";
import { getMcpConnectionsVisitedStorageKey } from "@/lib/mcp-connections-visited";
import { isReservedListSlug } from "@/lib/reserved-list-slugs";
import type { PlatformId } from "@/lib/mcp-platform-guides";

const ROTATION_MS = 60_000;

const ROTATION: Array<{
  platform: PlatformId;
  label: string;
  icon: "cursor" | "claude" | "windsurf";
}> = [
  { platform: "cursor", label: "Create todos from Cursor", icon: "cursor" },
  { platform: "claudeDesktop", label: "Create todos from Claude", icon: "claude" },
  { platform: "windsurf", label: "Create todos from Windsurf", icon: "windsurf" },
];

function isTodoSurfacePath(pathname: string): boolean {
  if (pathname === "/integrations" || pathname === "/mcp") return false;
  if (pathname.startsWith("/subscription/")) return false;
  if (pathname === "/all" || pathname === "/today") return true;
  // Single-segment paths: user list slugs (not integrations/mcp)
  if (!/^\/[^/]+$/.test(pathname)) return false;
  const slug = pathname.replace(/^\//, "");
  return !isReservedListSlug(slug);
}

function RotatingIcon({ kind }: { kind: "cursor" | "claude" | "windsurf" }) {
  switch (kind) {
    case "cursor":
      return (
        <Image
          src="https://www.cursor.com/favicon.ico"
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 shrink-0"
        />
      );
    case "claude":
      return <ClaudeBrandIcon className="h-4 w-4 shrink-0" />;
    case "windsurf":
      return (
        <Image
          src="https://windsurf.com/favicon.ico"
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 shrink-0"
        />
      );
    default:
      return null;
  }
}

type Props = {
  userId: string;
};

export function McpCtaRotator({ userId }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const v = localStorage.getItem(getMcpConnectionsVisitedStorageKey(userId));
      setDismissed(v === "1");
    } catch {
      setDismissed(false);
    }
  }, [mounted, userId, pathname]);

  useEffect(() => {
    if (!mounted || dismissed) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % ROTATION.length);
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, [mounted, dismissed]);

  const onTodo = isTodoSurfacePath(pathname);
  if (!mounted || dismissed || !onTodo) return null;

  const current = ROTATION[activeIndex]!;

  return (
    <div
      className={
        "pointer-events-none z-20 max-sm:flex max-sm:w-full max-sm:justify-end max-sm:px-0 " +
        "sm:fixed sm:bottom-6 sm:right-6 lg:right-12"
      }
    >
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onPress={() => router.push(`/mcp?platform=${current.platform}`)}
        className={
          "pointer-events-auto h-[30px] min-h-[30px] gap-1.5 rounded-2xl border !bg-white px-2.5 text-left text-[11px] font-medium " +
          "text-foreground max-sm:h-9 max-sm:min-h-9 max-sm:max-w-full max-sm:border-[#ebebeb] max-sm:px-3 max-sm:shadow-[0_1px_3px_rgba(0,0,0,0.06)] " +
          "max-sm:ring-1 max-sm:ring-black/[0.04] sm:max-w-[min(calc(100vw-2rem),14rem)] sm:border-[#eaeaea] sm:px-2 " +
          "sm:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]"
        }
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <RotatingIcon kind={current.icon} />
          <span className="min-w-0 truncate leading-none sm:whitespace-nowrap">{current.label}</span>
        </span>
      </Button>
    </div>
  );
}
