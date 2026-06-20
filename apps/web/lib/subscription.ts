export type PlanType = "free" | "monthly" | "yearly" | "lifetime";

export const FREE_LIMITS = {
  /** Max active todos across inbox + all lists (free tier). */
  allListTodos: 25,
  extraLists: 1,
  extraListTodos: 10,
  /** Max active notes across inbox + all note lists (free tier). */
  allListNotes: 25,
  extraNoteLists: 1,
  extraListNotes: 10,
} as const;

export const PRO_LIMITS = {
  allListTodos: Infinity,
  extraLists: Infinity,
  extraListTodos: Infinity,
  allListNotes: Infinity,
  extraNoteLists: Infinity,
  extraListNotes: Infinity,
} as const;

export function isProPlan(plan: PlanType, status: string | null | undefined) {
  if (plan === "lifetime") return true;
  if (plan === "monthly" || plan === "yearly") return status === "active";
  return false;
}

