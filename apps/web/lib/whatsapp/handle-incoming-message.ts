import type { SupabaseClient } from "@supabase/supabase-js";
import { insertInboxTodoAdmin } from "@/lib/server/inbox-todo-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send-whatsapp-message";

function toE164FromMetaFrom(fromDigits: string): string {
  const d = fromDigits.replace(/\D/g, "");
  return d ? `+${d}` : "";
}

function normalizeCommandKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

/** First token upper for command dispatch (ASCII YENI vs YENİ handled separately). */
function firstTokenUpperTr(raw: string): string {
  const t = raw.trim().split(/\s+/)[0] ?? "";
  return t.toLocaleUpperCase("tr-TR");
}

export async function handleIncomingMessage(
  supabase: SupabaseClient,
  fromMetaDigits: string,
  rawBody: string,
): Promise<void> {
  const phone = toE164FromMetaFrom(fromMetaDigits);
  if (!phone) {
    return;
  }

  const trimmed = rawBody.trim();
  if (!trimmed) return;

  const linkMatch = trimmed.match(/^LINK:(.+)$/i);
  if (linkMatch) {
    const token = linkMatch[1]?.trim() ?? "";
    if (!token) {
      await sendWhatsAppMessage(phone, "❌ Geçersiz bağlantı mesajı. Lütfen uygulamadan yeni bir bağlantı iste.");
      return;
    }

    const { data: row, error: findErr } = await supabase
      .from("whatsapp_link_tokens")
      .select("id, user_id, used, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (findErr || !row) {
      await sendWhatsAppMessage(
        phone,
        "❌ Bağlantı linki geçersiz veya süresi dolmuş. Lütfen uygulamadan yeni bir link isteyin.",
      );
      return;
    }

    if (row.used || new Date(row.expires_at) < new Date()) {
      await sendWhatsAppMessage(
        phone,
        "❌ Bağlantı linki geçersiz veya süresi dolmuş. Lütfen uygulamadan yeni bir link isteyin.",
      );
      return;
    }

    const { data: existingPhone } = await supabase
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", phone)
      .eq("whatsapp_linked", true)
      .maybeSingle();

    if (existingPhone && existingPhone.id !== row.user_id) {
      await sendWhatsAppMessage(
        phone,
        "❌ Bu WhatsApp numarası başka bir hesaba bağlı. Önce o hesaptan bağlantıyı kaldırın.",
      );
      return;
    }

    const { error: tokErr } = await supabase
      .from("whatsapp_link_tokens")
      .update({ used: true })
      .eq("id", row.id)
      .eq("used", false);

    if (tokErr) {
      console.error("whatsapp token update:", tokErr);
      await sendWhatsAppMessage(phone, "❌ Bağlantı tamamlanamadı. Lütfen tekrar deneyin.");
      return;
    }

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ whatsapp_phone: phone, whatsapp_linked: true })
      .eq("id", row.user_id);

    if (profErr) {
      console.error("whatsapp profile link:", profErr);
      await supabase.from("whatsapp_link_tokens").update({ used: false }).eq("id", row.id);
      await sendWhatsAppMessage(
        phone,
        "❌ Bu numara zaten kullanımda veya bağlantı kurulamadı. Destek ile iletişime geçin.",
      );
      return;
    }

    await sendWhatsAppMessage(
      phone,
      "✅ Hesabın başarıyla bağlandı!\n\nKomutlar:\n- *YENİ <başlık>* — todo ekle\n- *LİSTE* — açık todo'larını gör\n- *TAMAM <numara>* — tamamlandı işaretle\n- *YARDIM* — bu listeyi tekrar gör",
    );
    return;
  }

  const { data: userRow } = await supabase
    .from("profiles")
    .select("id")
    .eq("whatsapp_phone", phone)
    .eq("whatsapp_linked", true)
    .maybeSingle();

  if (!userRow) {
    await sendWhatsAppMessage(
      phone,
      "👋 Merhaba! Bu numarayı hesabına bağlamak için uygulamayı aç ve *WhatsApp ile Bağla* adımını tamamla.",
    );
    return;
  }

  const userId = userRow.id as string;
  const norm = normalizeCommandKey(trimmed);
  const first = firstTokenUpperTr(trimmed);

  if (first === "YENİ" || first === "YENI") {
    const title = trimmed.replace(/^\S+\s*/u, "").trim();
    const result = await insertInboxTodoAdmin(supabase, userId, title, "whatsapp");
    if (!result.ok) {
      await sendWhatsAppMessage(phone, result.userMessage);
      return;
    }
    await sendWhatsAppMessage(phone, `✅ Todo oluşturuldu: "${result.title}"`);
    return;
  }

  if (norm === "LİSTE" || norm === "LISTE") {
    const { data: todos, error } = await supabase
      .from("todos")
      .select("title")
      .eq("user_id", userId)
      .is("list_id", null)
      .eq("is_completed", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("whatsapp LISTE:", error);
      await sendWhatsAppMessage(phone, "⚠️ Liste alınamadı. Biraz sonra tekrar dene.");
      return;
    }

    if (!todos?.length) {
      await sendWhatsAppMessage(phone, "📭 Açık todo'n yok.");
      return;
    }

    const list = todos.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
    await sendWhatsAppMessage(
      phone,
      `📋 *Açık Todo'ların:*\n\n${list}\n\nTamamlamak için: TAMAM <numara>`,
    );
    return;
  }

  const tamParts = trimmed.split(/\s+/);
  const tamCmd = firstTokenUpperTr(trimmed);
  if (tamCmd === "TAMAM" || tamCmd === "DONE") {
    const numStr = tamParts[1];
    const num = parseInt(numStr ?? "", 10);
    if (Number.isNaN(num) || num < 1) {
      await sendWhatsAppMessage(phone, "⚠️ Geçerli bir numara girin. Örnek: TAMAM 2");
      return;
    }

    const { data: openTodos, error } = await supabase
      .from("todos")
      .select("id, title")
      .eq("user_id", userId)
      .is("list_id", null)
      .eq("is_completed", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !openTodos) {
      await sendWhatsAppMessage(phone, "⚠️ Todo'lar yüklenemedi. Biraz sonra tekrar dene.");
      return;
    }

    const todo = openTodos[num - 1];
    if (!todo) {
      await sendWhatsAppMessage(
        phone,
        `⚠️ ${num} numaralı todo bulunamadı. LİSTE yazarak mevcut todo'ları gör.`,
      );
      return;
    }

    const { error: upErr } = await supabase
      .from("todos")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", todo.id)
      .eq("user_id", userId);

    if (upErr) {
      console.error("whatsapp TAMAM:", upErr);
      await sendWhatsAppMessage(phone, "⚠️ Güncelleme başarısız. Tekrar dene.");
      return;
    }

    await sendWhatsAppMessage(phone, `✅ "${todo.title}" tamamlandı olarak işaretlendi!`);
    return;
  }

  if (norm === "YARDIM" || norm === "HELP") {
    await sendWhatsAppMessage(
      phone,
      "📖 *Komutlar:*\n\n- *YENİ <başlık>* — yeni todo oluştur\n- *LİSTE* — açık todo'larını gör\n- *TAMAM <numara>* — todo'yu tamamlandı işaretle\n- *YARDIM* — bu mesajı göster",
    );
    return;
  }

  await sendWhatsAppMessage(phone, "❓ Anlamadım. Komutları görmek için *YARDIM* yaz.");
}
