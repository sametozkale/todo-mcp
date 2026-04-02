import type { SupabaseClient } from "@supabase/supabase-js";
import { FREE_LIMITS, isProPlan, type PlanType } from "@/lib/subscription";

export type InsertInboxTodoResult =
  | { ok: true; title: string; id: string }
  | { ok: false; userMessage: string };

/**
 * Inserts an unassigned (inbox / All) todo using service-role client.
 * Mirrors free-tier limits and position logic used by MCP create_todo for inbox.
 */
export async function insertInboxTodoAdmin(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  source: "whatsapp",
): Promise<InsertInboxTodoResult> {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { ok: false, userMessage: "⚠️ Lütfen bir başlık girin. Örnek: YENİ Toplantı notlarını yaz" };
  }

  const { data: subRow } = await supabase
    .from("user_subscriptions")
    .select("plan_type, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  const plan = (subRow?.plan_type ?? "free") as PlanType;
  const isPro = isProPlan(plan, subRow?.subscription_status ?? "inactive");

  if (!isPro) {
    const { count: totalActive, error: totalErr } = await supabase
      .from("todos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .or("is_completed.is.null,is_completed.eq.false");

    if (totalErr) {
      return { ok: false, userMessage: "⚠️ Şu anda todo eklenemedi. Daha sonra tekrar dene." };
    }

    if ((totalActive ?? 0) >= FREE_LIMITS.allListTodos) {
      return {
        ok: false,
        userMessage:
          "⚠️ Ücretsiz planda en fazla 25 açık todo olabilir. Uygulamadan yükseltme yaparak devam edebilirsin.",
      };
    }
  }

  const { data: minAllPosRow } = await supabase
    .from("todos")
    .select("all_position")
    .eq("user_id", userId)
    .order("all_position", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { data: minListPosRow } = await supabase
    .from("todos")
    .select("position")
    .eq("user_id", userId)
    .is("list_id", null)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const nextAllPosition = (minAllPosRow?.all_position ?? 0) - 1;
  const nextListPosition = (minListPosRow?.position ?? 0) - 1;

  const { data, error } = await supabase
    .from("todos")
    .insert({
      user_id: userId,
      list_id: null,
      title: trimmed,
      position: nextListPosition,
      all_position: nextAllPosition,
      source,
    })
    .select("id, title")
    .single();

  if (error || !data) {
    console.error("insertInboxTodoAdmin:", error);
    return { ok: false, userMessage: "⚠️ Todo oluşturulamadı. Daha sonra tekrar dene." };
  }

  return { ok: true, title: data.title, id: data.id };
}
