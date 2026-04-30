import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { withSocialImage } from "@/lib/seo-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { LandingMacDownloadButton } from "@/components/landing-mac-download-button";
import { LandingHeader } from "../landing-header";
import { LandingHeroBlock } from "../landing-hero-block";

const title = "Students — Yalp";
const description = "Student support at Yalp: apply for free lifetime usage.";

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

const studentEmailSubject = "Yalp for students";
const studentEmailBody = [
  "Hi Samet,",
  "",
  "I am a student and I would like to apply for Yalp's student free lifetime offer.",
  "",
  "School name:",
  "Department:",
  "LinkedIn URL:",
  "",
  "Thank you!",
].join("\n");

const studentEmailHref = `mailto:ozkalesamet@gmail.com?subject=${encodeURIComponent(studentEmailSubject)}&body=${encodeURIComponent(studentEmailBody)}`;

export const metadata: Metadata = withSocialImage({
  title,
  description,
  alternates: { canonical: `${getSiteUrl()}/students` },
  openGraph: {
    title,
    description,
    url: `${getSiteUrl()}/students`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
});

export default function StudentsPage() {
  return (
    <div className="relative min-h-dvh bg-white antialiased">
      <div className="fixed inset-0 -z-10 bg-white" aria-hidden />
      <LandingHeader />

      <main className="mx-auto w-full max-w-6xl bg-white px-6 pb-24 sm:px-8 lg:px-12">
        <LandingHeroBlock
          topSpacingClassName="mt-[168px] sm:mt-[168px]"
          pillLabel="Students"
          pillOnlyLabel
          title={
            <>
              Yalp for
              <br />
              Students
            </>
          }
          description={
            <>
              Supporting students matters a lot to me.
              <br />
              I want students to be able to use Yalp for free.
            </>
          }
          ctaLabel="Email to apply"
          ctaHref={studentEmailHref}
          hideMacDownloadButton
        />

        <section className="mx-auto mt-[96px] w-full max-w-[400px] rounded-2xl border border-[#ebebeb] bg-white p-6 sm:p-8">
          <div className="space-y-4 font-title text-[15px] leading-[24px] tracking-[-0.01em] text-[#3f4552]">
            <p>
              If you email me your school name, department, and LinkedIn URL, I will share a
              discount code that gives you free lifetime usage.
            </p>
            <p>I will send the code by replying to your email.</p>
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
