# Yalp MCP Server

Local MCP server that lets Cursor/Claude create and manage Yalp todos.

## Install (Cursor)

Create a Yalp API key in the app, then install the MCP server in Cursor using the config below.

## MCP Config

```json
{
  "mcpServers": {
    "yalp": {
      "command": "npx",
      "args": ["-y", "-p", "yalp-mcp-server", "yalp-mcp"],
      "env": {
        "YALP_API_KEY": "yalp_<your_key_here>",
        "YALP_API_BASE_URL": "https://yalp.work"
      }
    }
  }
}
```

## Environment variables

- `YALP_API_KEY` (required): Yalp API key generated from the app.
- `YALP_API_BASE_URL` (optional): Yalp base URL (defaults to `https://yalp.work`). Override for preview deployments or local tunnels.

## Versioning and npm

The MCP server’s reported version matches **`package.json`** (single source of truth). Before publishing: bump `version` in `package.json`, run `pnpm build`, then `npm publish` from `apps/mcp-server`.

## Tools

Friendly aliases (recommended):

- `/todo list`
- `/todo create`
- `/todo update`
- `/todo delete`
- `/list list`
- `/list create`
- `/list resolve`

Legacy names (still supported):

- `list_lists`
- `create_list`
- `resolve_list`
- `list_todos`
- `create_todo`
- `update_todo`
- `delete_todo`