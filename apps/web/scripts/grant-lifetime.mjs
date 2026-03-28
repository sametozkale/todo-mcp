#!/usr/bin/env node
/**
 * Complimentary lifetime: Stripe customer (create or reuse) + Supabase user_subscriptions upsert.
 *
 * Usage (from apps/web, env in .env.local):
 *   node --env-file=.env.local scripts/grant-lifetime.mjs you@example.com
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *               STRIPE_SECRET_KEY, STRIPE_LIFETIME_PRICE_ID (optional but recommended for stripe_price_id)
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/grant-lifetime.mjs <email>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;
const lifetimePriceId = process.env.STRIPE_LIFETIME_PRICE_ID?.trim() || null;

if (!supabaseUrl || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!stripeKey) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stripe = new Stripe(stripeKey, {
  apiVersion: "2026-03-25.dahlia",
});

async function findAuthUserIdByEmail(targetEmail) {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === targetEmail);
    if (match) return match.id;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const userId = await findAuthUserIdByEmail(email);
  if (!userId) {
    console.error(`No Supabase auth user found for: ${email}`);
    process.exit(1);
  }

  let customerId = null;
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    customerId = existing.data[0].id;
    console.info(`Stripe customer: ${customerId} (existing)`);
  } else {
    const created = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: userId, comp_lifetime: "true" },
    });
    customerId = created.id;
    console.info(`Stripe customer: ${customerId} (created)`);
  }

  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    plan_type: "lifetime",
    stripe_customer_id: customerId,
    stripe_subscription_id: null,
    stripe_price_id: lifetimePriceId,
    subscription_status: "active",
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    updated_at: now,
  };

  const { error: upErr } = await supabase.from("user_subscriptions").upsert(row, {
    onConflict: "user_id",
  });

  if (upErr) {
    console.error("Supabase upsert failed:", upErr.message);
    process.exit(1);
  }

  console.info(`OK: ${email} → user_id=${userId}, plan_type=lifetime`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
