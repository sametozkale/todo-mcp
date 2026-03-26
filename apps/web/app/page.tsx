import { createClient } from "@/lib/supabase/server";
import { PRODUCT_HOME } from "@/lib/routes";
import { redirect } from "next/navigation";
import { HomeCta } from "./home-cta";

export default async function Home() {
  let user = null as { id: string } | null;
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    // Keep home page available even if auth provider is temporarily unreachable.
    user = null;
  }

  if (user) {
    redirect(PRODUCT_HOME);
  }

  return (
    <main className="flex h-dvh max-h-dvh min-h-0 flex-col items-center justify-center gap-4 overflow-hidden p-6 pb-24 sm:gap-5 sm:p-8 sm:pb-24">
      <h1 className="font-title shrink-0 text-2xl font-semibold text-foreground sm:text-3xl">
        Yalp
      </h1>
      <p className="max-w-md shrink text-center text-sm font-sans leading-snug text-muted sm:text-base">
        Keep your tasks in one place, stay focused, and get things done. A lightweight, fast todo
        experience.
      </p>
      <HomeCta />
    </main>
  );
}
