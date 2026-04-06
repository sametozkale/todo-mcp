import { createClient } from "@/lib/supabase/server";

export type ApiKeyRow = {
  id: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string | null;
};

export async function listApiKeysForCurrentUser(): Promise<ApiKeyRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("api_keys")
    .select("id, label, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as ApiKeyRow[];
}
