export type TodoPriority = 0 | 1 | 2 | 3;

export type TodoSource = 'app' | 'mcp' | 'api' | 'whatsapp';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  whatsapp_phone?: string | null;
  whatsapp_linked?: boolean;
}

export interface List {
  id: string;
  user_id: string;
  title: string;
  color: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: string;
  user_id: string;
  list_id: string | null;
  title: string;
  description: string | null;
  is_completed: boolean;
  priority: TodoPriority;
  due_date: string | null;
  position: number;
  parent_id: string | null;
  source: TodoSource;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type NotePriority = 0 | 1 | 2 | 3;

export type NoteSource = 'app' | 'mcp' | 'api' | 'whatsapp';

export interface NoteList {
  id: string;
  user_id: string;
  title: string;
  color: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  note_list_id: string | null;
  title: string;
  description: string | null;
  is_completed: boolean;
  priority: NotePriority;
  due_date: string | null;
  position: number;
  parent_id: string | null;
  source: NoteSource;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  label: string;
  last_used_at: string | null;
  created_at: string;
}

// MCP tool IO types (simplified)
export interface CreateTodoInput {
  title: string;
  description?: string;
  listId?: string;
  priority?: TodoPriority;
  dueDate?: string | null;
}

export interface TodoSummary {
  id: string;
  title: string;
  is_completed: boolean;
  list_id: string | null;
  due_date: string | null;
  priority: TodoPriority;
}
