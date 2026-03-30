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
        Log in to Yalp
      </Link>
    </div>
  );
}
