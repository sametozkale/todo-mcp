"use client";

import { useEffect } from "react";
import { toast } from "@heroui/react";
import Link from "next/link";

export default function SubscriptionSuccessPage() {
  useEffect(() => {
    try {
      toast.success("🎉 Welcome to Pro! All limits removed.", { timeout: 4500 });
    } catch {
      /* toast may be unavailable during hard navigation */
    }
    const id = window.setTimeout(() => {
      window.location.replace(`${window.location.origin}/all`);
    }, 150);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <p className="mx-auto max-w-sm px-4 py-8 text-center text-[13px] leading-snug text-muted">
      Taking you back to the app…{" "}
      <Link href="/all" className="font-medium text-foreground underline">
        Continue to All
      </Link>
    </p>
  );
}

