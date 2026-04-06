"use client";

import type { ReactNode } from "react";
import { SonnerToaster } from "@/components/sonner-toaster";

/**
 * HeroUI v3 uses CSS (`@import "@heroui/styles"`) for theming; there is no root `HeroUIProvider`.
 * Use this client boundary for future client-only providers (e.g. toast region, motion).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SonnerToaster
        position="bottom-right"
        visibleToasts={5}
        closeButton
        toastOptions={{
          duration: 4200,
        }}
      />
    </>
  );
}
