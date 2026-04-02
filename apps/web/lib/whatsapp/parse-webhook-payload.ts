type WaTextMessage = {
  from?: string;
  type?: string;
  text?: { body?: string };
};

type WaPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: WaTextMessage[] };
    }>;
  }>;
};

/** Extracts WhatsApp Cloud API text messages from a webhook payload. */
export function extractTextMessagesFromWebhook(payload: unknown): Array<{ from: string; body: string }> {
  const out: Array<{ from: string; body: string }> = [];
  const p = payload as WaPayload;
  for (const e of p.entry ?? []) {
    for (const c of e.changes ?? []) {
      const messages = c.value?.messages;
      if (!messages?.length) continue;
      for (const m of messages) {
        if (m.type !== "text" || !m.text?.body || !m.from) continue;
        out.push({ from: String(m.from), body: String(m.text.body) });
      }
    }
  }
  return out;
}
