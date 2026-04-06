export const MCP_TOOL_CATALOG = [
  { name: "list_lists", description: "List all lists for the authenticated user" },
  { name: "create_list", description: "Create a new list for the authenticated user" },
  {
    name: "resolve_list",
    description:
      "Resolve a list by listSlug, listTitle, or listRef. Defaults to Today. Can create the list if missing.",
  },
  { name: "list_todos", description: "List todos for the authenticated user" },
  { name: "create_todo", description: "Create a new todo for the authenticated user" },
  { name: "update_todo", description: "Update an existing todo for the authenticated user" },
  { name: "delete_todo", description: "Delete a todo by id for the authenticated user" },
] as const;

export type ToolName = (typeof MCP_TOOL_CATALOG)[number]["name"];

const TOOL_NAME_SET = new Set<string>(MCP_TOOL_CATALOG.map((tool) => tool.name));

export function isToolName(value: string): value is ToolName {
  return TOOL_NAME_SET.has(value);
}
