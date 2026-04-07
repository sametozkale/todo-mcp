"use client";

import { isReservedListSlug } from "@/lib/reserved-list-slugs";

export type TodoStoreRow = {
  id: string;
  title: string;
  is_completed: boolean | null;
  list_id: string | null;
  parent_id?: string | null;
  sub_todo_completed_count?: number;
  sub_todo_total_count?: number;
  created_at?: string;
};

type CacheEntry = {
  todos: TodoStoreRow[];
  fetchedAt: number;
};

const todosCache = new Map<string, CacheEntry>();

export function getCachedTodos(pathname: string): TodoStoreRow[] | null {
  const hit = todosCache.get(pathname);
  return hit?.todos ?? null;
}

export function setCachedTodos(pathname: string, todos: TodoStoreRow[]): void {
  todosCache.set(pathname, { todos, fetchedAt: Date.now() });
}

async function fetchTodosForPath(pathname: string): Promise<TodoStoreRow[] | null> {
  let url: string | null = null;

  if (pathname === "/all") {
    url = "/api/todos?view=all";
  } else if (pathname === "/today") {
    url = "/api/todos?view=today";
  } else if (/^\/[^/]+$/.test(pathname)) {
    const slug = pathname.slice(1);
    if (!isReservedListSlug(slug)) {
      url = `/api/lists/${encodeURIComponent(slug)}/todos`;
    }
  }

  if (!url) return null;

  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return null;
  const json = (await res.json()) as { todos?: TodoStoreRow[] };
  return Array.isArray(json.todos) ? json.todos : null;
}

export async function prefetchTodosForPath(pathname: string): Promise<void> {
  if (todosCache.has(pathname)) return;
  try {
    const todos = await fetchTodosForPath(pathname);
    if (todos) setCachedTodos(pathname, todos);
  } catch {
    // Silent prefetch failure.
  }
}

export async function revalidateTodosForPath(pathname: string): Promise<TodoStoreRow[] | null> {
  try {
    const todos = await fetchTodosForPath(pathname);
    if (todos) {
      setCachedTodos(pathname, todos);
      return todos;
    }
  } catch {
    // Ignore transient failures.
  }
  return null;
}
