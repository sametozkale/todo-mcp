import { cache } from "react";
import { getCachedAuth } from "@/lib/supabase/cached-auth";

export type CachedUserListRow = { id: string; title: string; slug: string };

/** Dedupes list lookup between `generateMetadata` and page for `/{listSlug}` in one request. */
export const getCachedUserListBySlug = cache(async (slug: string) => {
  const { supabase, user } = await getCachedAuth();
  if (!user) {
    return {
      supabase,
      user: null,
      list: null as CachedUserListRow | null,
    };
  }

  const { data: list, error } = await supabase
    .from("lists")
    .select("id, title, slug")
    .eq("user_id", user.id)
    .eq("slug", slug.toLowerCase())
    .maybeSingle();

  if (error || !list) return { supabase, user, list: null };
  return { supabase, user, list };
});
