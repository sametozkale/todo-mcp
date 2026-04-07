type ChildTodoLike = {
  parent_id: string | null;
  is_completed: boolean | null;
};

type TodoWithSubTodoCounts = {
  sub_todo_total_count: number;
  sub_todo_completed_count: number;
};

type ParentTodoRow = {
  id: string;
  title: string;
  is_completed: boolean | null;
  list_id: string | null;
  parent_id?: string | null;
  created_at?: string;
};

type SupabaseQueryLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        in: (
          column: string,
          values: string[],
        ) => PromiseLike<{ data: ChildTodoLike[] | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function attachSubTodoCounts(
  supabase: unknown,
  userId: string,
  todos: ParentTodoRow[] | null,
): Promise<Array<ParentTodoRow & TodoWithSubTodoCounts>> {
  const list = todos ?? [];
  if (list.length === 0) return [];

  const parentIds = list.map((todo) => todo.id);
  const queryable = supabase as SupabaseQueryLike;
  const { data: children, error } = await queryable
    .from("todos")
    .select("parent_id, is_completed")
    .eq("user_id", userId)
    .in("parent_id", parentIds);

  const counts = new Map<string, TodoWithSubTodoCounts>();
  if (!error && children) {
    for (const row of children) {
      if (!row.parent_id) continue;
      const prev = counts.get(row.parent_id) ?? { sub_todo_total_count: 0, sub_todo_completed_count: 0 };
      prev.sub_todo_total_count += 1;
      if (row.is_completed) prev.sub_todo_completed_count += 1;
      counts.set(row.parent_id, prev);
    }
  }

  return list.map((todo) => {
    const c = counts.get(todo.id) ?? { sub_todo_total_count: 0, sub_todo_completed_count: 0 };
    return { ...todo, ...c };
  });
}
