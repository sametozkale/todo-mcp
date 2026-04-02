"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, toast } from "@heroui/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const STEPS: { title: string; description: string }[] = [
  {
    title: "Generate a secure link",
    description:
      "Click the button below. We create a short-lived token so only you can finish linking from WhatsApp (Meta Cloud API).",
  },
  {
    title: "Open WhatsApp and send the message",
    description:
      "Use “Open WhatsApp”. Send the pre-filled message without editing it so we can verify your number.",
  },
  {
    title: "Stay on this page",
    description:
      "After Meta confirms the handoff, this screen updates automatically. You can then add and complete todos from WhatsApp.",
  },
];

type Props = {
  initialLinked: boolean;
  initialPhone: string | null;
};

export function WhatsAppIntegrationDetail({ initialLinked, initialPhone }: Props) {
  const [linked, setLinked] = useState(initialLinked);
  const [phone, setPhone] = useState(initialPhone);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    const id = pollRef.current;
    if (id != null) {
      window.clearInterval(id);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { linked?: boolean; phone?: string | null };
      if (data.linked) {
        setLinked(true);
        setPhone(data.phone ?? null);
        clearPoll();
        setDeepLink(null);
        setExpiresAt(null);
        toast.success("WhatsApp connected.", { timeout: 3200 });
      }
    } catch {
      /* ignore */
    }
  }, [clearPoll]);

  useEffect(() => {
    return () => clearPoll();
  }, [clearPoll]);

  useEffect(() => {
    if (!expiresAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt || !deepLink) return;
    const expMs = new Date(expiresAt).getTime();
    if (now > expMs) {
      clearPoll();
    }
  }, [now, expiresAt, deepLink, clearPoll]);

  const startPolling = useCallback(() => {
    clearPoll();
    pollRef.current = window.setInterval(() => {
      void pollStatus();
    }, 2500);
  }, [clearPoll, pollStatus]);

  const generateLink = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/generate-link-token", { method: "POST" });
      const data = (await res.json()) as { deepLink?: string; expiresAt?: string; error?: string };
      if (!res.ok) {
        toast.danger(data.error ?? "Could not create link.", { timeout: 4500 });
        return;
      }
      if (data.deepLink && data.expiresAt) {
        setDeepLink(data.deepLink);
        setExpiresAt(data.expiresAt);
        startPolling();
      }
    } finally {
      setLoading(false);
    }
  };

  const unlink = async () => {
    setUnlinking(true);
    try {
      const res = await fetch("/api/whatsapp/unlink", { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.danger(data.error ?? "Could not remove connection.", { timeout: 4500 });
        return;
      }
      setLinked(false);
      setPhone(null);
      clearPoll();
      setDeepLink(null);
      setExpiresAt(null);
      toast.success("WhatsApp disconnected.", { timeout: 2800 });
    } finally {
      setUnlinking(false);
    }
  };

  const secondsLeft = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const linkExpired = Boolean(expiresAt && deepLink && secondsLeft === 0);

  return (
    <div className="flex flex-col">
      <div className="mb-3 inline-flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e8e8e8] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <Image
            src="https://www.whatsapp.com/favicon.ico"
            alt=""
            width={22}
            height={22}
            className="h-[22px] w-[22px]"
          />
        </span>
        <div className="min-w-0">
          <h2 className="font-title text-balance text-lg font-semibold leading-snug text-foreground sm:text-xl">
            WhatsApp
          </h2>
          <p className="mt-0.5 text-pretty text-sm text-muted">
            Link your number to capture and complete todos from WhatsApp via Meta&apos;s Cloud API.
          </p>
        </div>
      </div>

      {linked ? (
        <div
          className="mb-4 motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out rounded-[14px] border border-emerald-200/90 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_4px_14px_-6px_rgba(5,150,105,0.2)]"
          role="status"
        >
          <p className="font-medium text-emerald-900">Connected</p>
          <p className="mt-0.5 text-pretty text-xs text-emerald-800/95">
            <span className="font-medium text-emerald-900">Number:</span> {phone ?? "—"}
          </p>
        </div>
      ) : (
        <p className="mb-4 text-pretty text-xs leading-relaxed text-muted motion-safe:transition-opacity motion-safe:duration-200">
          When your WhatsApp thread is linked, we show your connected number here — no extra verify step on this page.
        </p>
      )}

      <ol className="mb-6 space-y-4">
        {STEPS.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e4e4e4] bg-[#fafafa] text-xs font-semibold tabular-nums text-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="mt-1 text-xs text-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex max-w-full flex-col gap-2 self-start">
        {linked ? (
          <Button variant="secondary" className="h-10 min-h-10 w-fit" onPress={() => void unlink()} isDisabled={unlinking}>
            {unlinking ? "Disconnecting…" : "Disconnect WhatsApp"}
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              className="h-10 min-h-10 w-fit max-w-full rounded-[12px] px-4 motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out active:scale-[0.99]"
              onPress={() => void generateLink()}
              isDisabled={loading}
              aria-busy={loading}
            >
              {loading ? "Preparing link…" : "Generate WhatsApp link"}
            </Button>

            {deepLink && expiresAt && !linkExpired ? (
              <div className="mt-4 w-full max-w-md space-y-3 rounded-[14px] border border-[#ececec] bg-[#fafafa] p-4">
                <p className="text-xs font-medium text-foreground tabular-nums">
                  Time left: {mm}:{ss.toString().padStart(2, "0")}
                </p>
                <Button
                  variant="primary"
                  className="min-h-10 w-full sm:w-auto"
                  onPress={() => window.open(deepLink, "_blank", "noopener,noreferrer")}
                >
                  Open WhatsApp and send
                </Button>
                <p className="text-xs leading-relaxed text-muted">
                  After WhatsApp opens, send the message. Linking usually finishes within a few seconds.
                </p>
              </div>
            ) : null}

            {linkExpired ? (
              <p className="text-xs text-muted" role="status">
                This link expired. Generate a new one to continue.
              </p>
            ) : null}
          </>
        )}
      </div>

      {!linked ? (
        <details className="group mt-6 rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <span>Troubleshooting</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              strokeWidth={1.75}
              className="text-muted transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
            <li>If the timer hits zero, generate a fresh link — tokens are short-lived for security.</li>
            <li>Do not edit the pre-filled message; the token must match exactly.</li>
            <li>If status never updates, check that WhatsApp Business / Cloud API credentials are configured for this environment.</li>
          </ul>
        </details>
      ) : null}
    </div>
  );
}
