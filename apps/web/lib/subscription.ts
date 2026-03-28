export type PlanType = "free" | "monthly" | "yearly" | "lifetime";

export const FREE_LIMITS = {
  allListTodos: 25,
  extraLists: 1,
  extraListTodos: 10,
} as const;

export const PRO_LIMITS = {
  allListTodos: Infinity,
  extraLists: Infinity,
  extraListTodos: Infinity,
} as const;

export function isProPlan(plan: PlanType, status: string | null | undefined) {
  if (plan === "lifetime") return true;
  if (plan === "monthly" || plan === "yearly") return status === "active";
  return false;
}

