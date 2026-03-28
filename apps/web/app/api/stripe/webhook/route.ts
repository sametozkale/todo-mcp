import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function planTypeFromPriceId(priceId: string | null | undefined) {
  const monthly = process.env.STRIPE_MONTHLY_PRICE_ID?.trim();
  const yearly = process.env.STRIPE_YEARLY_PRICE_ID?.trim();
  const lifetime = process.env.STRIPE_LIFETIME_PRICE_ID?.trim();

  if (!priceId) return "free" as const;
  if (monthly && priceId === monthly) return "monthly" as const;
  if (yearly && priceId === yearly) return "yearly" as const;
  if (lifetime && priceId === lifetime) return "lifetime" as const;
  return "free" as const;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId =
          (session.client_reference_id ?? session.metadata?.supabase_user_id ?? null) as string | null;
        const customerId = (session.customer as string | null) ?? null;
        const mode = session.mode;

        if (!userId || !customerId) break;

        if (mode === "subscription") {
          const subscriptionId = session.subscription as string | null;
          if (!subscriptionId) break;

          const subResp = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price"],
          });
          const sub = subResp as unknown as Stripe.Subscription;

          const item = sub.items.data[0];
          const priceId = (item?.price?.id ?? null) as string | null;
          const planType = planTypeFromPriceId(priceId);
          const subPeriods = sub as unknown as {
            current_period_start?: number | null;
            current_period_end?: number | null;
            cancel_at_period_end?: boolean | null;
          };
          const currentPeriodStart = subPeriods.current_period_start;
          const currentPeriodEnd = subPeriods.current_period_end;
          const cancelAtPeriodEnd = subPeriods.cancel_at_period_end;

          await supabaseAdmin
            .from("user_subscriptions")
            .upsert(
              ({
                user_id: userId,
                plan_type: planType,
                stripe_customer_id: customerId,
                stripe_subscription_id: sub.id,
                stripe_price_id: priceId,
                subscription_status: sub.status === "active" ? "active" : sub.status,
                current_period_start: currentPeriodStart
                  ? new Date(currentPeriodStart * 1000).toISOString()
                  : null,
                current_period_end: currentPeriodEnd
                  ? new Date(currentPeriodEnd * 1000).toISOString()
                  : null,
                cancel_at_period_end: cancelAtPeriodEnd ?? false,
                updated_at: new Date().toISOString(),
              }) as unknown as Record<string, unknown>,
              { onConflict: "user_id" },
            );
        } else if (mode === "payment") {
          // Lifetime: one-time payment.
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
          const priceId = (lineItems.data[0]?.price?.id ?? session.metadata?.selected_price_id ?? null) as
            | string
            | null;

          const planType = planTypeFromPriceId(priceId);

          await supabaseAdmin
            .from("user_subscriptions")
            .upsert(
              ({
                user_id: userId,
                plan_type: planType === "lifetime" ? "lifetime" : "lifetime",
                stripe_customer_id: customerId,
                stripe_subscription_id: null,
                stripe_price_id: priceId,
                subscription_status: "active",
                current_period_start: null,
                current_period_end: null,
                cancel_at_period_end: false,
                updated_at: new Date().toISOString(),
              }) as unknown as Record<string, unknown>,
              { onConflict: "user_id" },
            );
        }

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const customerId = (sub.customer as string | null) ?? null;
        if (!customerId) break;

        const item = sub.items.data[0];
        const priceId = (item?.price?.id ?? null) as string | null;
        const planType = planTypeFromPriceId(priceId);
        const subPeriods = sub as unknown as {
          current_period_start?: number | null;
          current_period_end?: number | null;
          cancel_at_period_end?: boolean | null;
        };
        const currentPeriodStart = subPeriods.current_period_start;
        const currentPeriodEnd = subPeriods.current_period_end;
        const cancelAtPeriodEnd = subPeriods.cancel_at_period_end;

        await supabaseAdmin
          .from("user_subscriptions")
          .update(({
            plan_type: planType,
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            subscription_status: sub.status === "active" ? "active" : sub.status,
            current_period_start: currentPeriodStart
              ? new Date(currentPeriodStart * 1000).toISOString()
              : null,
            current_period_end: currentPeriodEnd
              ? new Date(currentPeriodEnd * 1000).toISOString()
              : null,
            cancel_at_period_end: cancelAtPeriodEnd ?? false,
            updated_at: new Date().toISOString(),
          }) as unknown as Record<string, unknown>)
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = (sub.customer as string | null) ?? null;
        if (!customerId) break;

        await supabaseAdmin
          .from("user_subscriptions")
          .update(({
            plan_type: "free",
            subscription_status: "inactive",
            stripe_subscription_id: null,
            stripe_price_id: null,
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          }) as unknown as Record<string, unknown>)
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = (invoice.customer as string | null) ?? null;
        if (!customerId) break;

        await supabaseAdmin
          .from("user_subscriptions")
          .update(({
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          }) as unknown as Record<string, unknown>)
          .eq("stripe_customer_id", customerId);

        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

