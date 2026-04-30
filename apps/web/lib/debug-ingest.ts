/**
 * Optional local debug telemetry (Cursor ingest). No-op in production unless enabled via env.
 * Server: DEBUG_INGEST=true. Client: NEXT_PUBLIC_DEBUG_INGEST=true.
 */

const INGEST_URL = "http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2";

export type DebugIngestPayload = {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: unknown;
  timestamp?: number;
};

export function isServerDebugIngestEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEBUG_INGEST === "true";
}

export function isClientDebugIngestEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_INGEST === "true";
}

export async function sendDebugIngest(
  payload: DebugIngestPayload,
  options?: { headerSessionId?: string },
): Promise<void> {
  const timestamp = payload.timestamp ?? Date.now();
  const headerId = options?.headerSessionId ?? payload.sessionId;
  await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": headerId,
    },
    body: JSON.stringify({ ...payload, timestamp }),
  }).catch(() => {});
}

/** Do not await on request-critical paths (middleware, redirects). */
export function enqueueDebugIngest(
  payload: DebugIngestPayload,
  options?: { headerSessionId?: string },
): void {
  void sendDebugIngest(payload, options);
}
