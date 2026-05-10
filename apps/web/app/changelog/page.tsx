import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { withSocialImage } from "@/lib/seo-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { LandingMacDownloadButton } from "@/components/landing-mac-download-button";
import { LandingHeader } from "../landing-header";
import { LandingHeroBlock } from "../landing-hero-block";
import { ChangelogTimeline } from "./changelog-timeline";

const title = "Changelog — Yalp";
const description = "Product updates, releases, and what shipped in Yalp.";

export const metadata: Metadata = withSocialImage({
  title,
  description,
  alternates: { canonical: `${getSiteUrl()}/changelog` },
  openGraph: {
    title,
    description,
    url: `${getSiteUrl()}/changelog`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
});

const FOOTER_COLUMN_1_LINKS = [
  { href: "/why-i-built", label: "Why I built" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/changelog", label: "Changelog" },
  { href: "/login", label: "Login" },
] as const;

const FOOTER_COLUMN_3_LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/students", label: "Students" },
  { href: "mailto:ozkalesamet@gmail.com", label: "Support" },
] as const;

export default function ChangelogPage() {
  return (
    <div className="relative min-h-dvh bg-white antialiased">
      <div className="fixed inset-0 -z-10 bg-white" aria-hidden />
      <LandingHeader />

      <main className="mx-auto w-full max-w-6xl bg-white px-6 pb-24 sm:px-8 lg:px-12">
        <LandingHeroBlock
          topSpacingClassName="mt-[168px] sm:mt-[168px]"
          pillLabel="CHANGELOG"
          pillOnlyLabel
          title={
            <>
              What we shipped
            </>
          }
          description={
            <>
              Release notes and product updates, newest first.
              <br />
              Subscribe by checking back here or following along on the site.
            </>
          }
          ctaLabel="Create your account"
          ctaHref="/signup"
          hideMacDownloadButton
        />

        <div className="mt-[96px]">
          <ChangelogTimeline />
        </div>
      </main>

      <div className="px-6 pb-24 sm:px-8 lg:px-12">
        <footer
          className="mx-auto mt-16 w-full max-w-[640px] border-t border-[#ececf2] pt-10 pb-2"
          aria-label="Site footer"
        >
          <nav aria-label="Footer" className="mx-auto w-full max-w-[640px]">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-3">
                <div className="inline-flex h-5 w-5 items-center justify-center">
                  <Image
                    src="/to-do-mcp-logo-black-48.svg"
                    alt="Yalp logo"
                    width={20}
                    height={20}
                    className="h-5 w-5 object-contain"
                  />
                </div>
                <span className="font-title text-[14px] font-medium tracking-[-0.32px] text-[#181925]">
                  Yalp AI
                </span>
                <p className="font-title text-[12px] leading-4 tracking-[-0.24px] text-[#5c5c66]">
                  Manage todos from Cursor, Claude, and more.
                </p>
                <LandingMacDownloadButton variant="footer" />
              </div>

              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10">
                <ul className="space-y-2.5">
                  {FOOTER_COLUMN_1_LINKS.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="font-title text-[13px] font-medium tracking-[-0.24px] text-[#5c5c66] no-underline transition hover:text-[#181925]"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>

                <ul className="space-y-2.5">
                  {FOOTER_COLUMN_3_LINKS.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="font-title text-[13px] font-medium tracking-[-0.24px] text-[#5c5c66] no-underline transition hover:text-[#181925]"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-[80px] text-center font-title text-[12px] leading-4 text-[#a4a4ae]">
              Yalp AI © 2026. All rights reserved.
            </p>
          </nav>
        </footer>
      </div>
    </div>
  );
}
