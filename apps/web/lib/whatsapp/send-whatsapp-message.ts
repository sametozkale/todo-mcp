/**
 * Sends a WhatsApp Cloud API text message.
 * @param toE164 Phone in E.164 with leading + (e.g. +905551234567)
 */
export async function sendWhatsAppMessage(toE164: string, text: string): Promise<unknown> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !accessToken) {
    throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN");
  }

  const toDigits = toE164.replace(/\D/g, "");
  if (!toDigits) {
    throw new Error("Invalid WhatsApp recipient");
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits,
      type: "text",
      text: { body: text, preview_url: false },
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error("WhatsApp send error:", response.status, errBody);
    throw new Error("WhatsApp message failed");
  }

  return response.json();
}
