import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { withSocialImage } from "@/lib/seo-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { LandingMacDownloadButton } from "@/components/landing-mac-download-button";
import { LandingHeader } from "../landing-header";
import { LandingHeroBlock } from "../landing-hero-block";

const title = "Roadmap — Yalp";
const description = "Upcoming features and integrations for Yalp.";

export const metadata: Metadata = withSocialImage({
  title,
  description,
  alternates: { canonical: `${getSiteUrl()}/roadmap` },
  openGraph: {
    title,
    description,
    url: `${getSiteUrl()}/roadmap`,
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

const ROADMAP_ITEMS = [
  {
    title: "WhatsApp Bot",
    description: "Create and complete todos from WhatsApp messages, synced to your Yalp lists.",
    iconSrc: "/landing-brand-whatsapp.svg",
    iconAlt: "WhatsApp",
  },
  {
    title: "Telegram Bot",
    description: "Create and complete todos from Telegram messages, synced to your Yalp lists.",
    iconSrc: "/landing-brand-telegram.svg",
    iconAlt: "Telegram",
  },
  {
    title: "Chrome Extension",
    description: "Capture and manage todos directly from your browser.",
    iconSrc: "https://www.google.com/chrome/static/images/favicons/favicon-96x96.png",
    iconAlt: "Chrome",
  },
  {
    title: "Widgets",
    description:
      "Build your own widgets page so you can see what matters most.",
    iconSrc: "/to-do-mcp-logo-black-48.svg",
    iconAlt: "Yalp widgets",
  },
  {
    title: "Gmail Integration",
    description: "Turn emails into todos (and back) without breaking your flow.",
    iconSrc: "https://www.gstatic.com/images/branding/product/1x/gmail_48dp.png",
    iconAlt: "Gmail",
  },
  {
    title: "Google Calendar Integration",
    description: "Convert calendar events into tasks and schedule tasks back into your calendar.",
    iconSrc: "https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png",
    iconAlt: "Google Calendar",
  },
  {
    title: "Voice Input",
    description: "Dictate todos by voice; synced to your Yalp lists.",
    iconSrc: "/landing-icon-voice.svg",
    iconAlt: "Voice Input",
  },
] as const;

export default function RoadmapPage() {
  return (
    <div className="relative min-h-dvh bg-white antialiased">
      <div className="fixed inset-0 -z-10 bg-white" aria-hidden />
      <LandingHeader />

      <main className="mx-auto w-full max-w-6xl bg-white px-6 pb-24 sm:px-8 lg:px-12">
        <LandingHeroBlock
          topSpacingClassName="mt-[168px] sm:mt-[168px]"
          pillLabel="Roadmap"
          pillOnlyLabel
          title={
            <>
              What’s next
              <br />
              for Yalp
            </>
          }
          description={
            <>
              Bots, inbox-to-todo, and calendar sync.
              <br />
              Built to keep you in flow.
            </>
          }
          ctaLabel="Get updates"
          ctaHref="/signup"
          hideMacDownloadButton
        />

        <div className="mt-[96px] mx-auto w-full max-w-[640px]">
          <h2 className="font-title text-center text-[22px] leading-[26px] font-medium tracking-[-0.02em] text-[#181925]">
            Roadmap
          </h2>
          <p className="mt-2 text-center font-title text-[14px] leading-[20px] tracking-[-0.01em] text-[#777777]">
            A short list of what we’re building next.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {ROADMAP_ITEMS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#ebebeb] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <Image
                    src={item.iconSrc}
                    alt={item.iconAlt}
                    width={22}
                    height={22}
                    className="mt-0.5 h-[22px] w-[22px] shrink-0 object-contain"
                  />
                  <div className="min-w-0">
                    <p className="font-title text-[15px] font-medium leading-snug tracking-[-0.02em] text-[#181925]">
                      {item.title}
                    </p>
                    <p className="mt-1 font-title text-[14px] leading-[21px] tracking-[-0.01em] text-[#5c5c66]">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                <p className="max-w-[14rem] font-title text-[12px] leading-4 tracking-[-0.24px] text-[#5c5c66]">
                  Manage todos and notes in the browser,
                  <br />
                  with MCP for Cursor, Claude, and more.
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
