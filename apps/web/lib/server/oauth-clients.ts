import { createClient } from "@/lib/supabase/server";

export type OAuthClientRow = {
  id: string;
  public_id: string;
  name: string;
  created_at: string | null;
  revoked_at: string | null;
};

export async function listOAuthClientsForCurrentUser(): Promise<OAuthClientRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("oauth_clients")
    .select("id, public_id, name, created_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as OAuthClientRow[];
}
