import { z } from 'zod';

type TodoSummary = {
  id: string;
  user_id: string;
  list_id: string | null;
  title: string;
  description: string | null;
  is_completed: boolean | null;
  position: number | null;
  all_position?: number | null;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
};

type List = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  position: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type CreateTodoInput = {
  title: string;
  description?: string;
  listId?: string | null;
  listSlug?: string;
  listTitle?: string;
  listRef?: string;
};

/** Tool shape used with McpServer.registerTool */
export type YalpMcpTool = {
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: any) => Promise<unknown>;
};

function getBaseUrl(): string {
  return (
    process.env.YALP_API_BASE_URL ||
    process.env.YALP_BASE_URL ||
    'https://yalp.ai'
  ).replace(/\/+$/, '');
}

function getApiKey(provided?: string): string {
  return (provided ?? process.env.YALP_API_KEY ?? '').trim();
}

async function callYalpApi<T>(
  tool: string,
  payload: Record<string, unknown>
): Promise<T> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, ...payload })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Yalp MCP API error (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}

export const tools: Record<string, YalpMcpTool> = {
  list_todos: {
    description: 'List todos for the authenticated user',
    inputSchema: {
      apiKey: z.string().optional(),
      listId: z.string().nullable().optional(),
      listSlug: z.string().optional(),
      listTitle: z.string().optional(),
      listRef: z.string().optional()
    },
    handler: async ({
      apiKey,
      listId,
      listSlug,
      listTitle,
      listRef
    }: {
      apiKey?: string;
      listId?: string | null;
      listSlug?: string;
      listTitle?: string;
      listRef?: string;
    }) => {
      const resolvedApiKey = getApiKey(apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callYalpApi<TodoSummary[]>('list_todos', {
        apiKey: resolvedApiKey,
        listId: listId ?? null,
        listSlug,
        listTitle,
        listRef
      });
    }
  },
  create_todo: {
    description: 'Create a new todo for the authenticated user',
    inputSchema: {
      apiKey: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      listId: z.string().nullable().optional(),
      listSlug: z.string().optional(),
      listTitle: z.string().optional(),
      listRef: z.string().optional()
    },
    handler: async ({
      apiKey,
      title,
      description,
      listId,
      listSlug,
      listTitle,
      listRef
    }: CreateTodoInput & { apiKey?: string }) => {
      const resolvedApiKey = getApiKey(apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callYalpApi<TodoSummary>('create_todo', {
        apiKey: resolvedApiKey,
        title,
        description: description ?? null,
        listId: listId ?? null,
        listSlug,
        listTitle,
        listRef
      });
    }
  },
  update_todo: {
    description: 'Update an existing todo for the authenticated user',
    inputSchema: {
      apiKey: z.string().optional(),
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      is_completed: z.boolean().optional()
    },
    handler: async (input: {
      apiKey?: string;
      id: string;
      title?: string;
      description?: string;
      is_completed?: boolean;
    }) => {
      const resolvedApiKey = getApiKey(input.apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callYalpApi<TodoSummary>('update_todo', {
        ...input,
        apiKey: resolvedApiKey
      });
    }
  },
  delete_todo: {
    description: 'Delete a todo by id for the authenticated user',
    inputSchema: {
      apiKey: z.string().optional(),
      id: z.string()
    },
    handler: async ({ apiKey, id }: { apiKey?: string; id: string }) => {
      const resolvedApiKey = getApiKey(apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callYalpApi<{ success: true }>('delete_todo', { apiKey: resolvedApiKey, id });
    }
  },
  list_lists: {
    description: 'List all lists for the authenticated user',
    inputSchema: {
      apiKey: z.string().optional()
    },
    handler: async ({ apiKey }: { apiKey?: string }) => {
      const resolvedApiKey = getApiKey(apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callYalpApi<List[]>('list_lists', { apiKey: resolvedApiKey });
    }
  },
  create_list: {
    description: 'Create a new list for the authenticated user',
    inputSchema: {
      apiKey: z.string().optional(),
      title: z.string()
    },
    handler: async ({ apiKey, title }: { apiKey?: string; title: string }) => {
      const resolvedApiKey = getApiKey(apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callYalpApi<List>('create_list', { apiKey: resolvedApiKey, title });
    }
  },
  resolve_list: {
    description:
      'Resolve a list by listSlug, listTitle, or listRef. Defaults to Today. Can create the list if missing.',
    inputSchema: {
      apiKey: z.string().optional(),
      listSlug: z.string().optional(),
      listTitle: z.string().optional(),
      listRef: z.string().optional(),
      createIfMissing: z.boolean().optional()
    },
    handler: async (input: {
      apiKey?: string;
      listSlug?: string;
      listTitle?: string;
      listRef?: string;
      createIfMissing?: boolean;
    }) => {
      const resolvedApiKey = getApiKey(input.apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callYalpApi<List>('resolve_list', { ...input, apiKey: resolvedApiKey });
    }
  }
};

// Friendly aliases for easier prompting in MCP clients.
// Keep legacy names for backwards compatibility.
tools['/todo list'] = tools.list_todos;
tools['/todo create'] = tools.create_todo;
tools['/todo update'] = tools.update_todo;
tools['/todo delete'] = tools.delete_todo;
tools['/list list'] = tools.list_lists;
tools['/list create'] = tools.create_list;
tools['/list resolve'] = tools.resolve_list;

