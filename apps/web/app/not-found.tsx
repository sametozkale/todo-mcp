import type { Metadata } from "next";
import Link from "next/link";
import { withSocialImage } from "@/lib/seo-metadata";

export const metadata: Metadata = withSocialImage({
  title: "Page not found",
  description: "This page does not exist or has been moved.",
  robots: { index: false, follow: true },
});

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#fafafa] p-6 text-center">
      <h1 className="font-title text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-sm text-sm text-muted">
        The link may be broken or the page was removed. Head back to the home page to continue.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background no-underline transition-opacity hover:opacity-90"
      >
        Back to home
      </Link>
    </main>
  );
}
