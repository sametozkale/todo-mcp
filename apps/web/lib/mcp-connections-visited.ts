/** localStorage flag: user has opened MCP Connections at least once (per browser, per user). */
export const MCP_CONNECTIONS_VISITED_STORAGE_PREFIX = "yalp_mcp_connections_visited:";

export function getMcpConnectionsVisitedStorageKey(userId: string): string {
  return `${MCP_CONNECTIONS_VISITED_STORAGE_PREFIX}${userId}`;
}

export function markMcpConnectionsVisited(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getMcpConnectionsVisitedStorageKey(userId), "1");
  } catch {
    /* quota / private mode */
  }
}
