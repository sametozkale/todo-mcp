import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { resolvePublicSiteUrl } from "@/lib/public-site-url";

export const runtime = "nodejs";

type Body = {
  price_id?: string;
};

type UserSubscriptionRow = {
  user_id: string;
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const priceId = (body.price_id ?? "").trim();
  if (!priceId) {
    return NextResponse.json({ error: "Missing price_id." }, { status: 400 });
  }

  const lifetimePriceId = process.env.STRIPE_LIFETIME_PRICE_ID?.trim();
  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID?.trim();
  const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID?.trim();

  const allowed = new Set([lifetimePriceId, monthlyPriceId, yearlyPriceId].filter(Boolean) as string[]);
  if (!allowed.has(priceId)) {
    return NextResponse.json({ error: "Invalid price." }, { status: 400 });
  }

  const { data: subRowRaw, error: subErr } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  const subRow = (subRowRaw as unknown as UserSubscriptionRow | null) ?? null;
  let stripeCustomerId = subRow?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    stripeCustomerId = customer.id;
    const { error: upErr } = await supabaseAdmin
      .from("user_subscriptions")
      .update(
        { stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() } as unknown as Record<
          string,
          unknown
        >,
      )
      .eq("user_id", user.id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  const isLifetime = Boolean(lifetimePriceId && priceId === lifetimePriceId);
  const siteUrl = resolvePublicSiteUrl(req);

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: isLifetime ? "payment" : "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${siteUrl}/subscription/success`,
    cancel_url: `${siteUrl}/subscription/cancel`,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
      selected_price_id: priceId,
    },
  });

  return NextResponse.json({ url: session.url });
}

