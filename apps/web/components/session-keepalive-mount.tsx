"use client";

import { useSessionKeepAlive } from "@/hooks/useSessionKeepAlive";

export function SessionKeepAliveMount() {
  useSessionKeepAlive();
  return null;
}
