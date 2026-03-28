import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { resolvePublicSiteUrl } from "@/lib/public-site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  price_id?: string;
  /** Preferred: server maps to STRIPE_*_PRICE_ID so the client does not need NEXT_PUBLIC price env. */
  plan_key?: "monthly" | "yearly" | "lifetime";
  planKey?: "monthly" | "yearly" | "lifetime";
};

type UserSubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
};

/** Vercel/env copy-paste sometimes wraps values in quotes — strip for allowlist match. */
function readStripePriceEnv(key: "STRIPE_MONTHLY_PRICE_ID" | "STRIPE_YEARLY_PRICE_ID" | "STRIPE_LIFETIME_PRICE_ID"): string {
  const raw = process.env[key];
  if (raw == null) return "";
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function getConfiguredStripePriceIds(): {
  monthly: string;
  yearly: string;
  lifetime: string;
} {
  return {
    monthly: readStripePriceEnv("STRIPE_MONTHLY_PRICE_ID"),
    yearly: readStripePriceEnv("STRIPE_YEARLY_PRICE_ID"),
    lifetime: readStripePriceEnv("STRIPE_LIFETIME_PRICE_ID"),
  };
}

function planKeyFromBody(body: Body): "monthly" | "yearly" | "lifetime" | undefined {
  const k = body.plan_key ?? body.planKey;
  if (k === "monthly" || k === "yearly" || k === "lifetime") return k;
  return undefined;
}

function resolvePriceIdFromBody(body: Body): { priceId: string; error: string | null } {
  const { monthly, yearly, lifetime } = getConfiguredStripePriceIds();

  const pk = planKeyFromBody(body);
  if (pk === "monthly") {
    return monthly
      ? { priceId: monthly, error: null }
      : { priceId: "", error: "Set STRIPE_MONTHLY_PRICE_ID in Vercel Environment Variables and redeploy." };
  }
  if (pk === "yearly") {
    return yearly
      ? { priceId: yearly, error: null }
      : { priceId: "", error: "Set STRIPE_YEARLY_PRICE_ID in Vercel Environment Variables and redeploy." };
  }
  if (pk === "lifetime") {
    return lifetime
      ? { priceId: lifetime, error: null }
      : { priceId: "", error: "Set STRIPE_LIFETIME_PRICE_ID in Vercel Environment Variables and redeploy." };
  }

  const raw = (body.price_id ?? "").trim();
  if (!raw) {
    return {
      priceId: "",
      error:
        "Missing plan selection. Update the app (redeploy) or send plan_key: monthly | yearly | lifetime.",
    };
  }
  return { priceId: raw, error: null };
}

export async function POST(req: Request) {
  try {
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

    const { priceId, error: resolveErr } = resolvePriceIdFromBody(body);
    if (resolveErr || !priceId) {
      return NextResponse.json(
        { error: resolveErr || "Stripe price IDs are not configured on the server." },
        { status: 500 },
      );
    }

    const { monthly: monthlyPriceId, yearly: yearlyPriceId, lifetime: lifetimePriceId } =
      getConfiguredStripePriceIds();

    const allowed = new Set(
      [lifetimePriceId, monthlyPriceId, yearlyPriceId].filter(Boolean) as string[],
    );
    if (allowed.size === 0) {
      return NextResponse.json(
        {
          error:
            "No Stripe price IDs on the server. Add STRIPE_MONTHLY_PRICE_ID, STRIPE_YEARLY_PRICE_ID, STRIPE_LIFETIME_PRICE_ID to Vercel and redeploy.",
        },
        { status: 500 },
      );
    }
    if (!allowed.has(priceId)) {
      return NextResponse.json(
        {
          error:
            "Price ID does not match server configuration. Check Vercel STRIPE_*_PRICE_ID values match Stripe Dashboard.",
        },
        { status: 400 },
      );
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

