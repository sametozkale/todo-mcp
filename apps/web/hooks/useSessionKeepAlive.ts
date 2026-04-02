"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Keeps Supabase session fresh while user stays on visible app tabs.
 * Uses low-frequency checks to avoid noisy network activity.
 */
export function useSessionKeepAlive() {
  const inFlightRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;

    const tick = async () => {
      if (disposed) return;
      if (document.visibilityState !== "visible") return;
      if (!navigator.onLine) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      try {
        await supabase.auth.getSession();
      } catch {
        // Silent fail: avoid interrupting users with transient auth/network noise.
      } finally {
        inFlightRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void tick();
      }
    };

    const handleFocus = () => void tick();
    const handleOnline = () => void tick();

    const interval = window.setInterval(() => {
      void tick();
    }, KEEP_ALIVE_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    // Prime once on mount in case user sits on a page without navigation.
    void tick();

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
}
