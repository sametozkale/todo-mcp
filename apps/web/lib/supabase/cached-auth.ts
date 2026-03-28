import { cache } from "react";
import { createClient } from "./server";

/**
 * Dedupes `getUser` + `createClient` within one RSC request (layout + page + metadata).
 */
export const getCachedAuth = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user, error };
});
