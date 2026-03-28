#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tools } from './tools.js';
import { PACKAGE_VERSION } from './version.js';

async function main() {
  const server = new McpServer(
    {
      name: 'yalp-mcp',
      version: PACKAGE_VERSION
    },
    {
      capabilities: {
        tools: { listChanged: true }
      }
    }
  );

  for (const [name, tool] of Object.entries(tools)) {
    server.registerTool(
      name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema
      } as Parameters<McpServer['registerTool']>[1],
      async (args) => {
        const result = await tool.handler(args);
        const text =
          typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        return {
          content: [{ type: 'text' as const, text }]
        };
      }
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Yalp MCP server failed to start', err);
  process.exit(1);
});
