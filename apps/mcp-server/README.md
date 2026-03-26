# Yalp MCP Server

Local MCP server that lets Cursor/Claude create and manage Yalp todos.

## Install (Cursor)

Create a Yalp API key in the app, then install the MCP server in Cursor using the config below.

## MCP Config

```json
{
  "mcpServers": {
    "flowdo": {
      "command": "npx",
      "args": ["-y", "@flowdo/mcp-server"],
      "env": {
        "FLOWDO_API_KEY": "flowdo_<your_key_here>",
        "FLOWDO_API_BASE_URL": "https://yalp.ai"
      }
    }
  }
}
```

## Environment variables

- `FLOWDO_API_KEY` (required): Yalp API key generated from the app.
- `FLOWDO_API_BASE_URL` (optional): Yalp base URL (defaults to `https://yalp.ai`).

## Tools

- `list_lists`
- `create_list`
- `resolve_list`
- `list_todos`
- `create_todo`
- `update_todo`
- `delete_todo`

