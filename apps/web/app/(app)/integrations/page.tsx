import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./integrations-client";
import { listApiKeysAction } from "./actions";

export const metadata: Metadata = {
  title: "MCP Connections",
  description: "Connect your AI tools to Yalp via MCP.",
  robots: { index: false, follow: false },
};

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fintegrations");
  }

  const initialKeys = await listApiKeysAction();
  const baseUrl = getSiteUrl();

  return (
    <div className="mx-auto w-full max-w-3xl pt-6">
      <div className="mb-6 space-y-2">
        <h1 className="font-title text-2xl font-semibold text-foreground">MCP Connections</h1>
        <p className="text-sm text-muted">
          Manage one-click MCP setup and active AI tool connections.
        </p>
      </div>

      <IntegrationsClient initialKeys={initialKeys} baseUrl={baseUrl} />
    </div>
  );
}

