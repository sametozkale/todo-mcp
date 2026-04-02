import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  await admin.from("whatsapp_link_tokens").update({ used: true }).eq("user_id", user.id).eq("used", false);

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await admin.from("whatsapp_link_tokens").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
    used: false,
  });

  if (error) {
    console.error("whatsapp generate-link-token:", error);
    return NextResponse.json({ error: "Could not create link token" }, { status: 500 });
  }

  const bizDigits = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") ?? "";
  if (!bizDigits) {
    return NextResponse.json({ error: "Server missing WHATSAPP_BUSINESS_NUMBER" }, { status: 500 });
  }

  const text = `LINK:${token}`;
  const deepLink = `https://wa.me/${bizDigits}?text=${encodeURIComponent(text)}`;

  return NextResponse.json({ deepLink, expiresAt });
}
