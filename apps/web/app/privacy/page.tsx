import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { withSocialImage } from "@/lib/seo-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { LandingHeader } from "../landing-header";
import { LandingHeroBlock } from "../landing-hero-block";

const title = "Privacy Policy — Yalp";
const description = "How Yalp handles personal data and protects your privacy.";

const FOOTER_COLUMN_1_LINKS = [
  { href: "/why-i-built", label: "Why I built" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/login", label: "Login" },
] as const;

const FOOTER_COLUMN_3_LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
] as const;

export const metadata: Metadata = withSocialImage({
  title,
  description,
  alternates: { canonical: `${getSiteUrl()}/privacy` },
  openGraph: {
    title,
    description,
    url: `${getSiteUrl()}/privacy`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
});

export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-dvh bg-white antialiased">
      <div className="fixed inset-0 -z-10 bg-white" aria-hidden />
      <LandingHeader />

      <main className="mx-auto w-full max-w-6xl bg-white px-6 pb-24 sm:px-8 lg:px-12">
        <LandingHeroBlock
          topSpacingClassName="mt-[168px] sm:mt-[168px]"
          pillLabel="Privacy policy"
          pillOnlyLabel
          title={
            <>
              Privacy Policy
              <br />
              for Yalp
            </>
          }
          description={
            <>
              How we collect, use, and protect your data
              <br />
              when you use Yalp.
            </>
          }
          hideCta
        />

        <section className="mx-auto mt-[96px] w-full max-w-[760px] rounded-2xl border border-[#ebebeb] bg-white p-6 sm:p-8">
          <div className="space-y-7 font-title text-[14px] leading-[22px] tracking-[-0.01em] text-[#5c5c66]">
            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">1. Who We Are</h2>
              <p className="mt-2">
                Yalp is operated by ProducterHQ OÜ, an Estonian private limited company (OÜ). Yalp is a todo
                application with optional MCP integrations that let users manage tasks from AI clients such as Cursor
                and Claude.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                2. Data We Collect
              </h2>
              <p className="mt-2">Depending on how you use Yalp, we process:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Account details (such as email and auth identifiers from Supabase).</li>
                <li>Task content and task metadata (lists, due dates, completion status).</li>
                <li>Connection settings for integrations (for example MCP and OAuth-related records).</li>
                <li>Billing and subscription status from Stripe (we do not store full card numbers).</li>
                <li>Basic technical and usage events used for security, reliability, and product improvement.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                3. Why We Process Data
              </h2>
              <p className="mt-2">We use personal data to:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Provide the core Yalp service and sync your todos across web and integrations.</li>
                <li>Authenticate users and protect accounts.</li>
                <li>Process purchases, manage subscriptions, and prevent payment fraud.</li>
                <li>Maintain platform security, debug incidents, and improve product quality.</li>
                <li>Comply with legal obligations and enforce our Terms of Use.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                4. Legal Bases (EEA/UK)
              </h2>
              <p className="mt-2">
                Where GDPR applies, we rely on contractual necessity (to provide Yalp), legitimate interests (service
                security and improvement), legal obligations, and consent where required.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                5. Processors and Third Parties
              </h2>
              <p className="mt-2">We use service providers to run Yalp, including:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Supabase for authentication and database infrastructure.</li>
                <li>Stripe for checkout, subscription management, and payment operations.</li>
                <li>Hosting and analytics tools needed to run and improve the service.</li>
              </ul>
              <p className="mt-2">
                We share data only as needed for these services, legal compliance, or a lawful request.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                6. International Transfers
              </h2>
              <p className="mt-2">
                Your data may be processed outside your country. Where required, we use appropriate safeguards (such as
                contractual protections) for international transfers.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                7. Retention
              </h2>
              <p className="mt-2">
                We keep personal data only as long as needed for service delivery, legal compliance, and dispute
                resolution. Account and todo data is typically removed or anonymized after account deletion, unless we
                must retain specific records for legal or accounting reasons.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">8. Your Rights</h2>
              <p className="mt-2">Depending on your location, you may have rights to access, correct, delete, or export your data, and to object to or restrict certain processing. You may also have the right to lodge a complaint with your local supervisory authority.</p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">9. Security</h2>
              <p className="mt-2">
                We apply technical and organizational measures to protect personal data. No system is perfectly secure,
                but we continuously work to reduce risk and respond quickly to incidents.
              </p>
            </div>

            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#181925]">
                10. Changes to This Policy
              </h2>
              <p className="mt-2">
                We may update this Privacy Policy from time to time. Material updates will be reflected on this page
                with a new effective date.
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
                  Yalp
                </span>
                <p className="font-title text-[12px] leading-4 tracking-[-0.24px] text-[#5c5c66]">
                  Manage todos from Cursor, Claude, and more.
                </p>
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

            <p className="mt-8 text-center font-title text-[12px] leading-4 text-[#a4a4ae]">
              © {new Date().getFullYear()} Yalp. All rights reserved.
            </p>
          </nav>
        </footer>
      </div>
    </div>
  );
}
