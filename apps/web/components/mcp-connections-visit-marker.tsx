"use client";

import { useEffect } from "react";
import { markMcpConnectionsVisited } from "@/lib/mcp-connections-visited";

type Props = {
  userId: string;
};

/** Marks MCP Connections as visited so the todo-page CTA can hide permanently. */
export function McpConnectionsVisitMarker({ userId }: Props) {
  useEffect(() => {
    markMcpConnectionsVisited(userId);
  }, [userId]);

  return null;
}
