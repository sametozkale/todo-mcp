import Image from "next/image";

/** App logo asset used across brand surfaces (192×192). */
const LOGO_SRC = "/to-do-mcp-logo.png";

type ToDoMcpLogoProps = {
  className?: string;
};

export function ToDoMcpLogo({ className }: ToDoMcpLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt="To Do MCP"
      width={192}
      height={192}
      className={className ?? "block h-6 w-auto max-w-none"}
      unoptimized
      priority
    />
  );
}
