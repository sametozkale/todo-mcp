"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * from Paper — https://app.paper.design/file/01KMXM6SWKF9CNKZ6GZJ3G8JBQ?node=2C-0 (Mar 30, 2026)
 * Layout + type scale; amounts aligned with `PaymentModal` / Stripe.
 */
const MONTHLY_USD = 5;
const YEARLY_USD = 39;
const LIFETIME_USD = 69;

const YEARLY_SAVE_PCT = Math.round((1 - YEARLY_USD / (MONTHLY_USD * 12)) * 100);

const PRO_FEATURES = [
  "Unlimited active todos across every list",
  "Unlimited custom lists (no per-list caps)",
  "MCP + web app: same list in Cursor, Claude, or the browser",
  "Priority updates while subscribed (Monthly / Yearly)",
] as const;

type Billing = "monthly" | "annually" | "lifetime";

export function LandingPlansPaperSection() {
  const [billing, setBilling] = useState<Billing>("monthly");

  const priceLabel =
    billing === "monthly"
      ? "Per month"
      : billing === "annually"
        ? "Per year"
        : "One-time";

  const priceMain =
    billing === "monthly"
      ? `$${MONTHLY_USD}`
      : billing === "annually"
        ? `$${YEARLY_USD}`
        : `$${LIFETIME_USD}`;

  const priceSub =
    billing === "annually"
      ? `About $${(YEARLY_USD / 12).toFixed(2)}/mo when billed yearly`
      : null;

  return (
    <section
      className="flex w-full max-w-[450px] flex-col items-center gap-6 self-center bg-white px-1 py-6 text-[12px] leading-4 antialiased sm:px-0"
      aria-label="Plans and pricing"
    >
      <div className="flex items-center gap-2 rounded-xl bg-[#F7F7F7] px-3 py-[6.5px]">
        <span className="font-title text-[12px] font-medium leading-[1.5] text-[#777777]">PRICING</span>
      </div>

      <h2 className="w-full text-center font-title text-[36px] font-medium leading-[44px] tracking-[-0.64px] text-[#181925]">
        Simplified pricing
      </h2>

      <p className="-mt-2 w-full text-center font-title text-[16px] font-normal leading-6 tracking-[-0.32px] text-[#777777]">
        Our pricing is simple and transparent;
        <br />
        you just pay for value and scalability.
      </p>

      <div
        className="inline-flex w-fit max-w-full shrink-0 items-center self-center rounded-[99px] border border-[#F7F7F7] bg-white p-1"
        role="tablist"
        aria-label="Billing period"
      >
        <button
          type="button"
          role="tab"
          aria-selected={billing === "monthly"}
          onClick={() => setBilling("monthly")}
          className={cn(
            "rounded-[99px] px-4 py-2 font-title text-[14px] font-medium leading-5 transition-colors",
            billing === "monthly"
              ? "bg-[#F7F7F7] text-[#181925]"
              : "text-[#666666] hover:text-[#181925]",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={billing === "annually"}
          onClick={() => setBilling("annually")}
          className={cn(
            "flex items-center gap-1 rounded-[99px] px-4 py-2 font-title text-[14px] font-medium leading-5 transition-colors",
            billing === "annually"
              ? "bg-[#F7F7F7] text-[#181925]"
              : "text-[#666666] hover:text-[#181925]",
          )}
        >
          Annually
          <span className="rounded border border-transparent bg-[#00B5E9]/8 px-1 py-0.5 font-title text-[12px] font-medium leading-4 text-[#00b5e9]">
            -{YEARLY_SAVE_PCT}%
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={billing === "lifetime"}
          onClick={() => setBilling("lifetime")}
          className={cn(
            "rounded-[99px] px-4 py-2 font-title text-[14px] font-medium leading-5 transition-colors",
            billing === "lifetime"
              ? "bg-[#F7F7F7] text-[#181925]"
              : "text-[#666666] hover:text-[#181925]",
          )}
        >
          Lifetime
        </button>
      </div>

      <div className="w-full max-w-[400px]">
        <div className="flex flex-col gap-6 rounded-3xl border border-[#EDEDED] bg-white px-8 py-8">
          <div className="flex items-center justify-between gap-2">
            <span className="font-title text-[20px] font-normal leading-7 text-[#00b5e9]">Pro</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-title text-[14px] font-normal leading-5 text-[#666666]">
              {priceLabel}
            </span>
            <span className="font-title text-[36px] font-medium leading-10 tracking-[-0.02em] text-[#181925]">
              {priceMain}
            </span>
            {priceSub ? (
              <span className="font-title text-[13px] font-normal leading-5 text-[#777777]">{priceSub}</span>
            ) : null}
          </div>

          <ul className="flex flex-col gap-4">
            {PRO_FEATURES.map((line) => (
              <li key={line} className="flex gap-2.5">
                <Check
                  className="mt-0.5 size-[18px] shrink-0 text-[#979797]"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="font-title text-[14px] font-normal leading-5 text-[#666666]">{line}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="flex w-full items-center justify-center rounded-[999px] bg-[#00b5e9] px-4 py-[11px] font-title text-[14px] font-medium leading-5 text-white shadow-[0px_1px_1px_rgba(0,0,0,0.08),0px_0px_0px_1px_rgba(0,0,0,0.05)] transition hover:bg-[#09abda]"
          >
            Get started for free
          </Link>
        </div>
      </div>

      <p className="mt-1 w-full max-w-[400px] text-center font-title text-[12px] leading-[18px] text-[#8a8a94]">
        Billing is handled securely via Stripe. You can manage or cancel recurring plans from your
        account anytime.
      </p>
    </section>
  );
}
