"use client";

import { McpConnectionsClient } from "./mcp-connections-client";

type Props = Parameters<typeof McpConnectionsClient>[0];

export function IntegrationsClient(props: Props) {
  return <McpConnectionsClient {...props} />;
}
