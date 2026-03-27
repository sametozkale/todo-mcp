type TodoSummary = {
  id: string;
  user_id: string;
  list_id: string | null;
  title: string;
  description: string | null;
  is_completed: boolean | null;
  position: number | null;
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
export type FlowdoMcpTool = {
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: any) => Promise<unknown>;
};

function getBaseUrl(): string {
  return (
    process.env.YALP_API_BASE_URL ||
    process.env.YALP_BASE_URL ||
    process.env.FLOWDO_API_BASE_URL ||
    process.env.FLOWDO_BASE_URL ||
    'https://todo-mcp-web.vercel.app'
  ).replace(/\/+$/, '');
}

function getApiKey(provided?: string): string {
  return (provided ?? process.env.YALP_API_KEY ?? process.env.FLOWDO_API_KEY ?? '').trim();
}

async function callFlowdoApi<T>(
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

export const tools: Record<string, FlowdoMcpTool> = {
  list_todos: {
    description: 'List todos for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        listId: { type: ['string', 'null'], nullable: true },
        listSlug: { type: 'string' },
        listTitle: { type: 'string' },
        listRef: { type: 'string' }
      },
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
      return await callFlowdoApi<TodoSummary[]>('list_todos', {
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
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        listId: { type: ['string', 'null'], nullable: true },
        listSlug: { type: 'string' },
        listTitle: { type: 'string' },
        listRef: { type: 'string' }
      },
      required: ['title']
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
      return await callFlowdoApi<TodoSummary>('create_todo', {
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
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        is_completed: { type: 'boolean' }
      },
      required: ['id']
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
      return await callFlowdoApi<TodoSummary>('update_todo', {
        ...input,
        apiKey: resolvedApiKey
      });
    }
  },
  delete_todo: {
    description: 'Delete a todo by id for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        id: { type: 'string' }
      },
      required: ['id']
    },
    handler: async ({ apiKey, id }: { apiKey?: string; id: string }) => {
      const resolvedApiKey = getApiKey(apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callFlowdoApi<{ success: true }>('delete_todo', { apiKey: resolvedApiKey, id });
    }
  },
  list_lists: {
    description: 'List all lists for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' }
      },
    },
    handler: async ({ apiKey }: { apiKey?: string }) => {
      const resolvedApiKey = getApiKey(apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callFlowdoApi<List[]>('list_lists', { apiKey: resolvedApiKey });
    }
  },
  create_list: {
    description: 'Create a new list for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['title']
    },
    handler: async ({ apiKey, title }: { apiKey?: string; title: string }) => {
      const resolvedApiKey = getApiKey(apiKey);
      if (!resolvedApiKey) throw new Error('Missing apiKey.');
      return await callFlowdoApi<List>('create_list', { apiKey: resolvedApiKey, title });
    }
  },
  resolve_list: {
    description:
      'Resolve a list by listSlug, listTitle, or listRef. Defaults to Today. Can create the list if missing.',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        listSlug: { type: 'string' },
        listTitle: { type: 'string' },
        listRef: { type: 'string' },
        createIfMissing: { type: 'boolean' }
      }
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
      return await callFlowdoApi<List>('resolve_list', { ...input, apiKey: resolvedApiKey });
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

