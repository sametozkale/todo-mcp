import { cache } from "react";
import { getCachedAuth } from "@/lib/supabase/cached-auth";

export type CachedUserNoteListRow = { id: string; title: string; slug: string };

export const getCachedUserNoteListBySlug = cache(async (slug: string) => {
  const { supabase, user } = await getCachedAuth();
  if (!user) {
    return {
      supabase,
      user: null,
      list: null as CachedUserNoteListRow | null,
    };
  }

  const { data: list, error } = await supabase
    .from("note_lists")
    .select("id, title, slug")
    .eq("user_id", user.id)
    .eq("slug", slug.toLowerCase())
    .maybeSingle();

  if (error || !list) return { supabase, user, list: null };
  return { supabase, user, list };
});
