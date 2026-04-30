import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { withSocialImage } from "@/lib/seo-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { LandingMacDownloadButton } from "@/components/landing-mac-download-button";
import { LandingHeader } from "../landing-header";
import { LandingHeroBlock } from "../landing-hero-block";

const title = "Terms of Use — Yalp";
const description = "Legal terms for using Yalp web app, APIs, and MCP integrations.";

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

export const metadata: Metadata = withSocialImage({
  title,
  description,
  alternates: { canonical: `${getSiteUrl()}/terms` },
  openGraph: {
    title,
    description,
    url: `${getSiteUrl()}/terms`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
});

export default function TermsOfUsePage() {
  return (
    <div className="relative min-h-dvh bg-white antialiased">
      <div className="fixed inset-0 -z-10 bg-white" aria-hidden />
      <LandingHeader />

      <main className="mx-auto w-full max-w-6xl bg-white px-6 pb-24 sm:px-8 lg:px-12">
        <LandingHeroBlock
          topSpacingClassName="mt-[168px] sm:mt-[168px]"
          pillLabel="Terms of use"
          pillOnlyLabel
          title={
            <>
              Terms of Use
              <br />
              for Yalp
            </>
          }
          description={
            <>
              The rules for using Yalp’s web app,
              <br />
              API, and MCP integrations.
            </>
          }
          hideCta
        />

        <section className="mx-auto mt-[96px] w-full max-w-[760px] rounded-2xl border border-[#ebebeb] bg-white p-6 sm:p-8">
          <div className="space-y-7 font-title text-[14px] leading-[22px] tracking-[-0.01em] text-[#5c5c66]">
            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">1. Operator</h2>
              <p className="mt-2">
                These Terms of Use apply to Yalp, operated by ProducterHQ OÜ (Estonia). By creating an account or
                using the service, you agree to these terms.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                2. Service Description
              </h2>
              <p className="mt-2">
                Yalp is a todo product with a web interface and integrations, including MCP endpoints and OAuth-based
                connections for compatible AI tools. Features can change over time.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">3. Eligibility and Account</h2>
              <p className="mt-2">
                You must provide accurate account information, keep your credentials secure, and use Yalp only for
                lawful purposes. You are responsible for all activity under your account.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">4. Acceptable Use</h2>
              <p className="mt-2">You agree not to:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Abuse, disrupt, or attempt unauthorized access to Yalp systems.</li>
                <li>Reverse engineer the service beyond what is allowed by law.</li>
                <li>Use Yalp to violate law, privacy rights, or intellectual property rights.</li>
                <li>Automate excessive requests that degrade service for others.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                5. MCP and API Responsibilities
              </h2>
              <p className="mt-2">
                If you use Yalp via MCP/API clients, you are responsible for your connected tools, API keys, and
                prompts. Keep credentials secret and rotate them immediately if compromised.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">6. Billing and Plans</h2>
              <p className="mt-2">
                Paid subscriptions are processed by Stripe and may renew automatically unless canceled. Plan limits,
                pricing, and feature availability may change prospectively. Taxes may apply depending on your location.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                7. Intellectual Property
              </h2>
              <p className="mt-2">
                Yalp, including its software, branding, and content (excluding your submitted data), is owned by
                ProducterHQ OÜ and protected by applicable intellectual property laws.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">8. Your Content</h2>
              <p className="mt-2">
                You retain rights to the todo content you submit. You grant us a limited license to host, process, and
                display it solely to provide and improve the service.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">9. Availability and Changes</h2>
              <p className="mt-2">
                We aim for reliable availability but do not guarantee uninterrupted service. We may modify, suspend, or
                discontinue features as needed for security, maintenance, or product evolution.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                10. Warranties and Liability
              </h2>
              <p className="mt-2">
                Yalp is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest extent permitted by law, we
                disclaim implied warranties and are not liable for indirect, incidental, special, consequential, or
                punitive damages.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">11. Termination</h2>
              <p className="mt-2">
                You may stop using Yalp at any time. We may suspend or terminate access for serious or repeated
                violations of these terms or to protect the service and its users.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">12. Governing Law</h2>
              <p className="mt-2">
                These terms are governed by the laws of Estonia, without prejudice to mandatory consumer protections
                applicable in your country of residence.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">13. Changes to Terms</h2>
              <p className="mt-2">
                We may update these Terms of Use. Continued use of Yalp after changes become effective means you accept
                the revised terms.
              </p>
            </div>

            <div className="border-t border-[#ececf2] pt-5 text-[13px] leading-5 text-[#777]">
              Effective date: April 9, 2026.
            </div>
          </div>
        </section>
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
