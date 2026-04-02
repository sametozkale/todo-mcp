import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { handleIncomingMessage } from "@/lib/whatsapp/handle-incoming-message";
import { extractTextMessagesFromWebhook } from "@/lib/whatsapp/parse-webhook-payload";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/verify-meta-signature";

export const runtime = "nodejs";

/**
 * META SETUP CHECKLIST:
 * 1. Go to developers.facebook.com → Create App → Business type
 * 2. Add WhatsApp product to the app
 * 3. In WhatsApp > API Setup: note your Phone Number ID → WHATSAPP_PHONE_NUMBER_ID
 * 4. In Meta Business Manager > System Users: create a system user,
 *    assign whatsapp_business_messaging + whatsapp_business_management permissions,
 *    generate a permanent access token → WHATSAPP_ACCESS_TOKEN
 * 5. In WhatsApp > Configuration > Webhooks:
 *    - Callback URL: https://YOUR_DOMAIN/api/whatsapp/webhook
 *    - Verify Token: value of WHATSAPP_WEBHOOK_VERIFY_TOKEN env var
 *    - Subscribe to: "messages" field
 * 6. For testing: use the test number provided by Meta (up to 5 recipient numbers free)
 * 7. For production: complete Meta Business Verification to lift messaging limits as needed
 *
 * Dev: use ngrok/cloudflared — Meta does not accept localhost URLs for webhooks.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verify = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && token && verify && token === verify) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();

  if (appSecret) {
    const sig = req.headers.get("x-hub-signature-256");
    if (!verifyMetaWebhookSignature(rawBody, sig, appSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = extractTextMessagesFromWebhook(payload);
  const admin = getSupabaseAdmin();

  for (const m of messages) {
    try {
      await handleIncomingMessage(admin, m.from, m.body);
    } catch (e) {
      console.error("whatsapp webhook handleIncomingMessage:", e);
    }
  }

  return NextResponse.json({ received: true });
}
