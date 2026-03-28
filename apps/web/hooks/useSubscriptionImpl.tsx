"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { FREE_LIMITS, PRO_LIMITS, isProPlan, type PlanType } from "@/lib/subscription";

export type SubscriptionSnapshot = {
  plan: PlanType;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export type UsageSnapshot = {
  /** All active todos (inbox + every list) — used for the free-tier account cap. */
  totalActiveTodosCount: number;
  /** Active todos with no list (inbox / new tasks from All). */
  allListTodosCount: number;
  extraListsCount: number;
  maxExtraListTodosCount: number;
  activeTodosByListId: Record<string, number>;
};

export type PaymentModalState = {
  isOpen: boolean;
  dismissible: boolean;
};

type SubscriptionContextValue = {
  subscription: SubscriptionSnapshot;
  usage: UsageSnapshot;
  paymentModal: PaymentModalState;
  openPaymentModal: (opts?: { dismissible?: boolean }) => void;
  closePaymentModal: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  initialSubscription,
  initialUsage,
  children,
}: {
  initialSubscription: SubscriptionSnapshot;
  initialUsage: UsageSnapshot;
  children: ReactNode;
}) {
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>({
    isOpen: false,
    dismissible: true,
  });

  const openPaymentModal = useCallback((opts?: { dismissible?: boolean }) => {
    setPaymentModal({ isOpen: true, dismissible: opts?.dismissible ?? false });
  }, []);

  const closePaymentModal = useCallback(() => {
    setPaymentModal((s) => (s.dismissible ? { ...s, isOpen: false } : s));
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription: initialSubscription,
      usage: initialUsage,
      paymentModal,
      openPaymentModal,
      closePaymentModal,
    }),
    [initialSubscription, initialUsage, paymentModal, openPaymentModal, closePaymentModal],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }

  const plan = ctx.subscription.plan;
  const status = ctx.subscription.subscription_status;

  const isActive = plan === "monthly" || plan === "yearly" ? status === "active" : false;
  const isPro = isProPlan(plan, status);

  const limits = isPro ? PRO_LIMITS : FREE_LIMITS;
  const usage = ctx.usage;

  const canCreateList = useCallback(() => {
    if (isPro) return true;
    return usage.extraListsCount < FREE_LIMITS.extraLists;
  }, [isPro, usage.extraListsCount]);

  const canAddTodo = useCallback(
    (listId: string | null) => {
      if (isPro) return true;
      if (usage.totalActiveTodosCount >= FREE_LIMITS.allListTodos) return false;
      if (!listId) {
        return usage.allListTodosCount < FREE_LIMITS.allListTodos;
      }
      const activeInThisList = usage.activeTodosByListId[listId] ?? 0;
      return activeInThisList < FREE_LIMITS.extraListTodos;
    },
    [isPro, usage.totalActiveTodosCount, usage.allListTodosCount, usage.activeTodosByListId],
  );

  return {
    plan,
    isActive,
    isPro,
    limits: {
      allListTodos: limits.allListTodos,
      extraLists: limits.extraLists,
      extraListTodos: limits.extraListTodos,
    },
    usage,
    canAddTodo,
    canCreateList,
    openPaymentModal: ctx.openPaymentModal,
    paymentModal: ctx.paymentModal,
    closePaymentModal: ctx.closePaymentModal,
    currentPeriodEnd: ctx.subscription.current_period_end,
    cancelAtPeriodEnd: ctx.subscription.cancel_at_period_end ?? false,
  };
}
