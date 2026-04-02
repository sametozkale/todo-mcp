import crypto from "node:crypto";

/**
 * Verifies X-Hub-Signature-256 from Meta webhooks (HMAC-SHA256 of raw body).
 */
export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const receivedHex = signatureHeader.slice("sha256=".length).trim();
  const expectedHex = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(receivedHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
