import { SoftwareApplicationJsonLd } from "@/components/seo/software-app-json-ld";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { PRODUCT_HOME } from "@/lib/routes";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeCta } from "./home-cta";

const landingTitle = "Yalp — Fast todo lists and MCP connections for AI tools";
const landingDescription =
  "Yalp helps you capture tasks, organize lists, and stay focused. Connect Cursor, Claude, and other clients via MCP. Free tier includes inbox tasks and one extra list with generous limits.";

export const metadata: Metadata = {
  title: { absolute: landingTitle },
  description: landingDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: landingTitle,
    description: landingDescription,
    url: getSiteUrl(),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: landingTitle,
    description: landingDescription,
  },
};

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
      <SoftwareApplicationJsonLd />
      <h1 className="font-title shrink-0 text-2xl font-semibold text-foreground sm:text-3xl">
        Yalp
      </h1>
      <p className="max-w-md shrink text-center text-sm font-sans leading-snug text-muted sm:text-base">
        <strong className="font-semibold text-foreground">What is Yalp?</strong> It is a lightweight
        todo app for capturing tasks and lists, with MCP so you can use your todos from AI tools
        like Cursor and Claude. Stay focused and get things done in one place.
      </p>
      <HomeCta />
    </main>
  );
}
