import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { resolvePublicSiteUrl } from "@/lib/public-site-url";

export const runtime = "nodejs";

type UserSubscriptionRow = {
  stripe_customer_id: string | null;
};

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const stripe = getStripe();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: subRowRaw, error: subErr } = await supabaseAdmin
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  const subRow = (subRowRaw as unknown as UserSubscriptionRow | null) ?? null;
  const customerId = subRow?.stripe_customer_id?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "No Stripe customer found." }, { status: 400 });
  }

  const siteUrl = resolvePublicSiteUrl(req);

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/all`,
  });

  return NextResponse.json({ url: portal.url });
}

