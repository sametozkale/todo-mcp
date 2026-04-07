import type { Metadata } from "next";
import { Suspense } from "react";
import { withSocialImage } from "@/lib/seo-metadata";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IntegrationsHubClient } from "./integrations-hub-client";

export const metadata: Metadata = withSocialImage({
  title: "Integrations",
  description: "Connect WhatsApp, MCP clients, and other tools to Yalp.",
  robots: { index: false, follow: false },
});

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fintegrations");
  }

  return (
    <div className="mx-auto w-full max-w-3xl pt-6">
      <Suspense
        fallback={
          <div className="rounded-[28px] border border-[#eaeaea] bg-white p-8 text-center text-sm text-muted">
            Loading…
          </div>
        }
      >
        <IntegrationsHubClient />
      </Suspense>
    </div>
  );
}
