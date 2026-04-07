"use client";

import { useEffect, useState } from "react";
import { Button, Modal, useOverlayState } from "@heroui/react";
import { useSubscription } from "@/hooks/useSubscription";
import { FREE_LIMITS } from "@/lib/subscription";
import { Check, InfinityIcon, Sparkles, CalendarDays } from "lucide-react";

type PlanKey = "monthly" | "yearly" | "lifetime";

type PlanDef = {
  key: PlanKey;
  title: string;
  priceLabel: string;
  cadence: string;
  subLabel: string;
  bullets: string[];
  bestValue?: boolean;
  icon: typeof CalendarDays;
};

const PLANS: PlanDef[] = [
  {
    key: "monthly",
    title: "Monthly",
    priceLabel: "$5",
    cadence: "/ month",
    subLabel: "Flexible — cancel anytime",
    bullets: ["Unlimited todos", "Unlimited lists", "Billed monthly"],
    icon: CalendarDays,
  },
  {
    key: "yearly",
    title: "Yearly",
    priceLabel: "$49",
    cadence: "/ year",
    subLabel: "Best value — save vs monthly",
    bullets: ["Everything in Monthly", "Lowest effective price", "Billed once a year"],
    bestValue: true,
    icon: Sparkles,
  },
  {
    key: "lifetime",
    title: "Lifetime",
    priceLabel: "$99",
    cadence: "once",
    subLabel: "Pay once, keep Pro forever",
    bullets: ["All Pro features", "No renewals", "One-time payment"],
    icon: InfinityIcon,
  },
];

const RECURRING_PLANS = PLANS.filter((p) => p.key !== "lifetime");
const LIFETIME_PLAN = PLANS.find((p) => p.key === "lifetime")!;

/** Menü/modal rozetleri: yinelenen abonelik → Pro, tek seferlik → Lifetime. */
const PRO_ENTITLEMENT_FEATURES = [
  "Unlimited active todos across every list",
  "Unlimited custom lists (no 10-task cap per list)",
  "Same fast inbox, drag-and-drop, and keyboard workflow — without free-tier limits",
  "Priority access to new product updates while you stay subscribed",
] as const;

function FreePlanUsageSection({
  usage,
}: {
  usage: {
    totalActiveTodosCount: number;
    extraListsCount: number;
    maxExtraListTodosCount: number;
  };
}) {
  return (
    <div
      className="rounded-2xl border border-[#ebebeb] bg-[#f7f7f7] p-4 sm:p-5"
      role="region"
      aria-label="Free plan usage"
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        Free plan usage
      </p>
      <div className="flex flex-col gap-4">
        <LimitRow
          label="Active todos (all lists)"
          current={usage.totalActiveTodosCount}
          max={FREE_LIMITS.allListTodos}
        />
        <LimitRow
          label="Extra lists"
          current={usage.extraListsCount}
          max={FREE_LIMITS.extraLists}
        />
        <LimitRow
          label="Extra list todos (max in one list)"
          current={usage.maxExtraListTodosCount}
          max={FREE_LIMITS.extraListTodos}
        />
      </div>
    </div>
  );
}

function LimitRow({ label, current, max }: { label: string; current: number; max: number }) {
  const clamped = Math.max(0, Math.min(current, max));
  const pct = max <= 0 ? 0 : Math.round((clamped / max) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-[1.25rem] items-start justify-between gap-3 text-[13px] leading-tight">
        <span className="min-w-0 flex-1 text-muted">{label}</span>
        <span className="shrink-0 tabular-nums font-medium text-foreground">
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_#e8e8e8]">
        <div
          className="h-full rounded-full bg-[#00b5e9] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function PlanCardColumn({
  plan: p,
  loadingKey,
  onCheckout,
}: {
  plan: PlanDef;
  loadingKey: PlanKey | null;
  onCheckout: (key: PlanKey) => void;
}) {
  const Icon = p.icon;
  const featured = Boolean(p.bestValue);
  return (
    <div
      className={[
        "relative flex h-full flex-col rounded-2xl border bg-white p-4 transition-shadow sm:p-5",
        featured
          ? "border-[#00b5e9] shadow-[0_8px_30px_rgba(0,181,233,0.12),0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-inset ring-[#00b5e9]/25"
          : "border-[#efefef] shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
      ].join(" ")}
    >
      {featured ? (
        <span className="absolute right-4 top-4 rounded-full bg-[#00b5e9] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:right-5 sm:top-5">
          Best value
        </span>
      ) : null}

      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#f4f4f4] text-foreground">
        <Icon size={18} strokeWidth={1.75} aria-hidden className="text-[#323232]" />
      </div>

      <div className="text-[13px] font-semibold text-foreground">{p.title}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
        <span className="text-[22px] font-semibold leading-tight tracking-tight text-foreground min-[400px]:text-[26px] sm:text-[28px]">
          {p.priceLabel}
        </span>
        <span className="text-[12px] font-medium text-muted min-[400px]:text-[13px]">{p.cadence}</span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted min-[400px]:text-[12px]">{p.subLabel}</p>

      <ul className="mt-4 flex flex-1 flex-col gap-1.5 border-t border-[#f4f4f4] pt-3">
        {p.bullets.map((line) => (
          <li key={line} className="flex gap-2 text-[11px] leading-snug text-foreground min-[400px]:text-[12px]">
            <Check
              size={16}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-[#00b5e9]"
              aria-hidden
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <Button
          variant={featured ? "primary" : "secondary"}
          className="w-full"
          isPending={loadingKey === p.key}
          isDisabled={Boolean(loadingKey)}
          onPress={() => onCheckout(p.key)}
        >
          {loadingKey === p.key ? "Redirecting…" : `Continue with ${p.title}`}
        </Button>
      </div>
    </div>
  );
}

function LifetimePlanRow({
  plan: p,
  loadingKey,
  onCheckout,
}: {
  plan: PlanDef;
  loadingKey: PlanKey | null;
  onCheckout: (key: PlanKey) => void;
}) {
  const Icon = p.icon;
  return (
    <div className="relative rounded-2xl border border-[#efefef] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)] sm:grid-rows-[auto_auto] sm:items-start sm:gap-x-6 sm:gap-y-3">
        <div className="min-w-0 w-full sm:col-start-1 sm:row-start-1 sm:max-w-[12.5rem]">
          <div className="flex gap-2">
            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-[10px] bg-[#f4f4f4] text-foreground">
              <Icon size={16} strokeWidth={1.75} aria-hidden className="text-[#323232]" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold leading-tight text-foreground">{p.title}</div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[22px] font-semibold leading-none tracking-tight text-foreground sm:text-[24px]">
                  {p.priceLabel}
                </span>
                <span className="text-[12px] font-medium text-muted">{p.cadence}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{p.subLabel}</p>
            </div>
          </div>
        </div>
        <div className="w-full sm:col-start-1 sm:row-start-2 sm:w-auto sm:justify-self-stretch">
          <Button
            variant="secondary"
            className="w-full sm:min-w-[12rem]"
            isPending={loadingKey === p.key}
            isDisabled={Boolean(loadingKey)}
            onPress={() => onCheckout(p.key)}
          >
            {loadingKey === p.key ? "Redirecting…" : `Continue with ${p.title}`}
          </Button>
        </div>
        <ul className="flex min-w-0 flex-col gap-1 border-t border-[#f4f4f4] pt-3 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:border-t-0 sm:border-l sm:border-[#f4f4f4] sm:pt-0 sm:pl-6">
          {p.bullets.map((line) => (
            <li key={line} className="flex gap-2 text-[12px] leading-snug text-foreground">
              <Check
                size={16}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-[#00b5e9]"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PaymentModal() {
  const {
    paymentModal,
    closePaymentModal,
    isPro,
    plan: currentPlan,
    currentPeriodEnd,
    usage,
  } = useSubscription();
  const [loadingKey, setLoadingKey] = useState<PlanKey | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const modalState = useOverlayState({
    isOpen: paymentModal.isOpen,
    onOpenChange: (open) => {
      if (!open) closePaymentModal();
    },
  });

  useEffect(() => {
    if (!paymentModal.isOpen) return;
    setCheckoutError(null);
    setLoadingKey(null);
  }, [paymentModal.isOpen]);

  const backdropDismissable = paymentModal.dismissible;

  async function parseJsonResponse(res: Response): Promise<{ url?: string; error?: string }> {
    const text = await res.text();
    if (!text.trim()) {
      return {};
    }
    try {
      return JSON.parse(text) as { url?: string; error?: string };
    } catch {
      throw new Error(`Server returned an invalid response (${res.status}).`);
    }
  }

  async function startCheckout(planKey: PlanKey) {
    setCheckoutError(null);
    setLoadingKey(planKey);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_key: planKey }),
      });
      const json = await parseJsonResponse(res);
      if (!res.ok || !json.url) {
        throw new Error(json.error || `Could not start checkout (${res.status}).`);
      }
      window.location.href = json.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setCheckoutError(msg);
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleManageBilling() {
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/create-portal-session", { method: "POST" });
      const json = await parseJsonResponse(res);
      if (!res.ok || !json.url) {
        throw new Error(json.error || `Could not open billing portal (${res.status}).`);
      }
      window.location.href = json.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not open billing portal.";
      setCheckoutError(msg);
    }
  }

  const planLabel =
    currentPlan === "lifetime"
      ? "Lifetime"
      : currentPlan === "yearly"
        ? "Yearly"
        : currentPlan === "monthly"
          ? "Monthly"
          : "Free";

  const entitlementTitle = currentPlan === "lifetime" ? "Lifetime" : isPro ? "Pro" : "Free";
  const billingCadenceLabel =
    currentPlan === "monthly"
      ? "Monthly billing"
      : currentPlan === "yearly"
        ? "Yearly billing"
        : currentPlan === "lifetime"
          ? "One-time — never renews"
          : null;

  const showHeaderClose = isPro || paymentModal.dismissible;

  return (
    <Modal.Root state={modalState}>
      <Modal.Backdrop isDismissable={backdropDismissable}>
        <Modal.Container
          size="lg"
          placement="center"
          className="w-[min(100vw-1.5rem,920px)] max-w-[min(100vw-1.5rem,920px)] sm:w-[min(100vw-2rem,920px)]"
        >
          <Modal.Dialog
            className="max-h-[min(calc(100dvh-1.25rem),min(920px,92dvh))] overflow-y-auto"
            aria-describedby={
              !paymentModal.dismissible && !isPro
                ? "plans-modal-subtitle plans-modal-limit-notice"
                : "plans-modal-subtitle"
            }
          >
            {showHeaderClose ? <Modal.CloseTrigger /> : null}

            <Modal.Header className="border-0 pb-0">
              <div className="flex flex-wrap items-center gap-2 pr-10">
                <Modal.Heading className="font-title text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {isPro ? "Your plan" : "Upgrade to Pro"}
                </Modal.Heading>
                {isPro ? (
                  <span className="inline-flex items-center rounded-full bg-[#e8f7fc] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#0078a8]">
                    {entitlementTitle}
                  </span>
                ) : null}
              </div>
              <p id="plans-modal-subtitle" className="text-[13px] leading-relaxed text-muted">
                {isPro
                  ? currentPlan === "lifetime"
                    ? "Lifetime includes every Pro capability with a single payment — no renewals or subscription management."
                    : `Your Pro subscription (${planLabel.toLowerCase()}) includes full access below. Update the card on file or cancel renewal from Stripe whenever you need.`
                  : "Pro unlocks unlimited todos and lists. Compare monthly, yearly, or lifetime below, then continue to checkout when you’re ready."}
              </p>
              {!paymentModal.dismissible && !isPro ? (
                <p
                  id="plans-modal-limit-notice"
                  className="rounded-xl border border-[#c8ecf7] bg-[#eef9fd] px-4 py-3 text-[13px] leading-relaxed text-foreground"
                  role="status"
                >
                  You’ve reached a limit on the free plan. Choose a plan below to continue — this dialog
                  stays open until you upgrade or complete checkout.
                </p>
              ) : null}
            </Modal.Header>

            <Modal.Body className="!mt-5 flex flex-col gap-5 pt-0 sm:!mt-6">
              {checkoutError ? (
                <p
                  className="rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/[0.06] px-4 py-3 text-[13px] leading-relaxed text-[color:var(--color-danger)]"
                  role="alert"
                >
                  {checkoutError}
                </p>
              ) : null}

              {!isPro ? <FreePlanUsageSection usage={usage} /> : null}

              {isPro ? (
                <div className="flex flex-col gap-5">
                  <div className="overflow-hidden rounded-[16px] border border-[#e4e4e4] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.022),0_1px_2px_rgba(0,0,0,0.016)]">
                    <div className="border-b border-[#f0f0f0] bg-[linear-gradient(135deg,#f7fcff_0%,#fafafa_100%)] px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                          <Sparkles size={16} className="text-[#00b5e9]" aria-hidden />
                          {entitlementTitle}
                        </span>
                        {billingCadenceLabel ? (
                          <>
                            <span className="text-[#cfcfcf]" aria-hidden>
                              ·
                            </span>
                            <span>{billingCadenceLabel}</span>
                          </>
                        ) : null}
                      </div>
                      {currentPlan !== "lifetime" && currentPeriodEnd ? (
                        <p className="mt-1.5 text-[12px] text-muted">
                          <span className="font-medium text-foreground">Renews </span>
                          {new Date(currentPeriodEnd).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      ) : null}
                      {currentPlan === "lifetime" ? (
                        <p className="mt-1.5 text-[12px] text-muted">
                          You own Pro features outright — no renewal dates or subscription invoices.
                        </p>
                      ) : null}
                    </div>
                    <div className="px-5 py-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Included with {entitlementTitle}
                      </p>
                      <ul className="grid gap-2.5 sm:grid-cols-2">
                        {PRO_ENTITLEMENT_FEATURES.map((line) => (
                          <li
                            key={line}
                            className="flex gap-2.5 text-[12px] leading-snug text-foreground sm:text-[13px]"
                          >
                            <Check
                              size={17}
                              strokeWidth={2}
                              className="mt-0.5 shrink-0 text-[#00b5e9]"
                              aria-hidden
                            />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[12px] leading-snug text-muted sm:max-w-[55%]">
                        {currentPlan === "lifetime"
                          ? "Need a receipt or to update account details? Stripe keeps your payment history for Lifetime purchases."
                          : "Change payment method, download invoices, or cancel renewal — all handled securely in Stripe."}
                      </p>
                      <Button
                        variant="primary"
                        className="w-full shrink-0 sm:w-auto sm:min-w-[11.5rem]"
                        onPress={() => void handleManageBilling()}
                      >
                        Manage billing
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 sm:gap-5">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {RECURRING_PLANS.map((p) => (
                        <PlanCardColumn
                          key={p.key}
                          plan={p}
                          loadingKey={loadingKey}
                          onCheckout={(key) => void startCheckout(key)}
                        />
                      ))}
                    </div>

                    <LifetimePlanRow
                      plan={LIFETIME_PLAN}
                      loadingKey={loadingKey}
                      onCheckout={(key) => void startCheckout(key)}
                    />
                  </div>

                  <p className="mx-auto max-w-lg text-center text-[12px] leading-relaxed text-muted">
                    Secure checkout with Stripe. You can manage your plans in the customer portal.
                  </p>
                </>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
