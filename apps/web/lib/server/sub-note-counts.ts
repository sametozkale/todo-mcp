type ChildNoteLike = {
  parent_id: string | null;
  is_completed: boolean | null;
};

type NoteWithSubNoteCounts = {
  sub_note_total_count: number;
  sub_note_completed_count: number;
};

type ParentNoteRow = {
  id: string;
  title: string;
  is_completed: boolean | null;
  note_list_id: string | null;
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
        ) => PromiseLike<{ data: ChildNoteLike[] | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function attachSubNoteCounts(
  supabase: unknown,
  userId: string,
  notes: ParentNoteRow[] | null,
): Promise<Array<ParentNoteRow & NoteWithSubNoteCounts>> {
  const list = notes ?? [];
  if (list.length === 0) return [];

  const parentIds = list.map((note) => note.id);
  const queryable = supabase as SupabaseQueryLike;
  const { data: children, error } = await queryable
    .from("notes")
    .select("parent_id, is_completed")
    .eq("user_id", userId)
    .in("parent_id", parentIds);

  const counts = new Map<string, NoteWithSubNoteCounts>();
  if (!error && children) {
    for (const row of children) {
      if (!row.parent_id) continue;
      const prev = counts.get(row.parent_id) ?? { sub_note_total_count: 0, sub_note_completed_count: 0 };
      prev.sub_note_total_count += 1;
      if (row.is_completed) prev.sub_note_completed_count += 1;
      counts.set(row.parent_id, prev);
    }
  }

  return list.map((note) => {
    const c = counts.get(note.id) ?? { sub_note_total_count: 0, sub_note_completed_count: 0 };
    return { ...note, ...c };
  });
}
