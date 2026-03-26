import type { CreateTodoInput, TodoSummary, List } from '@flowdo/types';

/** Tool shape used with McpServer.registerTool */
export type FlowdoMcpTool = {
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: any) => Promise<unknown>;
};
import { supabase } from './supabase.js';

async function getUserIdFromApiKey(apiKey: string): Promise<string | null> {
  const keyHash = apiKey; // For MVP, treat provided key as already-hashed or opaque.
  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id')
    .eq('key_hash', keyHash)
    .maybeSingle();
  if (error || !data) return null;
  return data.user_id;
}

export const tools: Record<string, FlowdoMcpTool> = {
  list_todos: {
    description: 'List todos for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        listId: { type: ['string', 'null'], nullable: true }
      },
      required: ['apiKey']
    },
    handler: async ({ apiKey, listId }: { apiKey: string; listId?: string | null }) => {
      const userId = await getUserIdFromApiKey(apiKey);
      if (!userId) {
        throw new Error('Invalid API key');
      }
      const query = supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .order('position');
      const { data, error } = listId
        ? await query.eq('list_id', listId)
        : await query.is('list_id', null);
      if (error) {
        throw error;
      }
      return (data ?? []) as TodoSummary[];
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
        listId: { type: ['string', 'null'], nullable: true }
      },
      required: ['apiKey', 'title']
    },
    handler: async ({
      apiKey,
      title,
      description,
      listId
    }: CreateTodoInput & { apiKey: string }) => {
      const userId = await getUserIdFromApiKey(apiKey);
      if (!userId) {
        throw new Error('Invalid API key');
      }
      const { data, error } = await supabase
        .from('todos')
        .insert({
          user_id: userId,
          title,
          description: description ?? null,
          list_id: listId ?? null,
          source: 'mcp'
        })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return data as TodoSummary;
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
      required: ['apiKey', 'id']
    },
    handler: async (input: {
      apiKey: string;
      id: string;
      title?: string;
      description?: string;
      is_completed?: boolean;
    }) => {
      const userId = await getUserIdFromApiKey(input.apiKey);
      if (!userId) {
        throw new Error('Invalid API key');
      }
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.is_completed !== undefined) {
        updates.is_completed = input.is_completed;
        updates.completed_at = input.is_completed ? new Date().toISOString() : null;
      }
      const { data, error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', input.id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return data as TodoSummary;
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
      required: ['apiKey', 'id']
    },
    handler: async ({ apiKey, id }: { apiKey: string; id: string }) => {
      const userId = await getUserIdFromApiKey(apiKey);
      if (!userId) {
        throw new Error('Invalid API key');
      }
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) {
        throw error;
      }
      return { success: true };
    }
  },
  list_lists: {
    description: 'List all lists for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' }
      },
      required: ['apiKey']
    },
    handler: async ({ apiKey }: { apiKey: string }) => {
      const userId = await getUserIdFromApiKey(apiKey);
      if (!userId) {
        throw new Error('Invalid API key');
      }
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', userId)
        .order('position');
      if (error) {
        throw error;
      }
      return (data ?? []) as List[];
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
      required: ['apiKey', 'title']
    },
    handler: async ({ apiKey, title }: { apiKey: string; title: string }) => {
      const userId = await getUserIdFromApiKey(apiKey);
      if (!userId) {
        throw new Error('Invalid API key');
      }
      const { data, error } = await supabase
        .from('lists')
        .insert({ user_id: userId, title })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return data as List;
    }
  }
};

