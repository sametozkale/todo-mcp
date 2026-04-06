"use client";

import dynamic from "next/dynamic";

/**
 * Load Sonner only on the client in its own chunk to avoid Webpack runtime/HMR
 * mismatches (`__webpack_modules__[moduleId] is not a function`) with the main bundle.
 */
export const SonnerToaster = dynamic(
  () => import("sonner").then((mod) => mod.Toaster),
  { ssr: false },
);
