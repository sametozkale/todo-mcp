"use client";

import Link from "next/link";
import { buttonVariants, cn } from "@heroui/react";

export function HomeCta() {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
      <Link
        href="/login"
        className={cn(
          buttonVariants({ variant: "secondary", size: "md" }),
          "inline-flex no-underline",
        )}
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className={cn(
          buttonVariants({ variant: "primary", size: "md" }),
          "inline-flex no-underline",
        )}
      >
        Sign up
      </Link>
    </div>
  );
}
