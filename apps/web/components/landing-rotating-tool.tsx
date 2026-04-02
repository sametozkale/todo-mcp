"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ClaudeBrandIcon } from "@/components/claude-brand-icon";

const ROTATE_EVERY_MS = 3000;

type Tool = {
  name: string;
  icon: "cursor" | "claude" | "windsurf" | "whatsapp" | "telegram";
};

const TOOLS: Tool[] = [
  { name: "Cursor", icon: "cursor" },
  { name: "Claude", icon: "claude" },
  { name: "Windsurf", icon: "windsurf" },
  { name: "WhatsApp", icon: "whatsapp" },
  { name: "Telegram", icon: "telegram" },
];

function ToolIcon({ icon }: { icon: Tool["icon"] }) {
  if (icon === "cursor") {
    return (
      <Image
        src="/landing-brand-cursor.svg"
        alt=""
        width={38}
        height={38}
        className="h-[38px] w-[38px]"
      />
    );
  }

  if (icon === "claude") {
    return <ClaudeBrandIcon className="h-[38px] w-[38px]" />;
  }

  if (icon === "whatsapp") {
    return (
      <Image
        src="/landing-brand-whatsapp.svg"
        alt=""
        width={38}
        height={38}
        className="h-[38px] w-[38px]"
      />
    );
  }

  if (icon === "telegram") {
    return (
      <Image
        src="/landing-brand-telegram.svg"
        alt=""
        width={38}
        height={38}
        className="h-[38px] w-[38px]"
      />
    );
  }

  return (
    <Image
      src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/windsurf.svg"
      alt=""
      width={38}
      height={38}
      className="h-[38px] w-[38px]"
    />
  );
}

export function LandingRotatingTool() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % TOOLS.length);
    }, ROTATE_EVERY_MS);
    return () => window.clearInterval(id);
  }, []);

  const active = TOOLS[index]!;

  return (
    <span className="inline-flex items-center gap-4">
      <span>from</span>
      <span className="inline-flex items-center gap-2.5">
        <ToolIcon icon={active.icon} />
        <span>{active.name}</span>
      </span>
    </span>
  );
}
