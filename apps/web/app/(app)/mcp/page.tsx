import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { isPlatformId } from "@/lib/mcp-platform-guides";
import { redirect } from "next/navigation";
import { McpConnectionsVisitMarker } from "@/components/mcp-connections-visit-marker";
import { McpConnectionsClient } from "../integrations/mcp-connections-client";
import { listApiKeysAction } from "../integrations/actions";

export const metadata: Metadata = {
  title: "MCP Connections",
  description: "Connect Cursor, Claude, VS Code, and other MCP clients to Yalp.",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ platform?: string }>;
};

export default async function McpConnectionsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fmcp");
  }

  const initialKeys = await listApiKeysAction();
  const baseUrl = getSiteUrl();
  const params = await searchParams;
  const initialPlatform = isPlatformId(params.platform) ? params.platform : null;

  return (
    <div className="mx-auto w-full max-w-3xl pt-6">
      <McpConnectionsVisitMarker userId={user.id} />
      <Suspense
        fallback={
          <div className="rounded-[28px] border border-[#eaeaea] bg-white p-8 text-center text-sm text-muted">
            Loading…
          </div>
        }
      >
        <McpConnectionsClient
          userId={user.id}
          initialKeys={initialKeys}
          baseUrl={baseUrl}
          initialPlatform={initialPlatform}
        />
      </Suspense>
    </div>
  );
}
