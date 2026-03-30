import { SoftwareApplicationJsonLd } from "@/components/seo/software-app-json-ld";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { PRODUCT_HOME } from "@/lib/routes";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingHeader } from "./landing-header";
import { LandingHeroBlock } from "./landing-hero-block";
import { LandingFeaturesPaper } from "./landing-features-paper";
import { LandingIntegrationBeam } from "./landing-integration-beam";
import { LandingPricingFooterPaper } from "./landing-pricing-footer-paper";

const landingTitle = "Yalp — Manage todos from Cursor & Claude";
const landingDescription =
  "One task list: use it from Cursor, Claude, or other MCP clients. Free tier with generous limits.";

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
    <main className="relative flex min-h-dvh flex-col items-center overflow-x-hidden bg-white p-6 pb-24 sm:p-8 sm:pb-24">
      <LandingHeader />
      <SoftwareApplicationJsonLd />
      <LandingHeroBlock />
      <LandingIntegrationBeam />
      <LandingFeaturesPaper />
      <LandingPricingFooterPaper />
    </main>
  );
}
