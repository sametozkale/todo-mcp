import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

import { LandingMacDownloadButton } from "@/components/landing-mac-download-button";
import { TestimonialsCarousel } from "@/components/testimonials-carousel";
import { FREE_LIMITS } from "@/lib/subscription";
import { LandingPlansPaperSection } from "./landing-plans-paper-section";

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

/** Common questions visitors ask about Yalp — copy matches product behavior where possible. */
const FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: "What is Yalp?",
    a: "Yalp is a focused workspace for todos and notes, with a full web UI and an MCP server so tools like Cursor and Claude Desktop can list, add, and complete tasks in your real account, without copy-pasting between chat and a separate app.",
  },
  {
    q: "What is MCP, and why would I use it?",
    a: "MCP (Model Context Protocol) is a standard way for AI apps to connect to data and tools. With Yalp’s MCP integration, your assistant can work with the same todo lists you see in the browser, using your permissions, instead of juggling snippets or fake demo lists. Notes live in the web app today; MCP covers todos.",
  },
  {
    q: "Do I need a credit card for the free plan?",
    a: "No. You can sign up and use the free tier without entering payment details. You only pay if you choose a Pro plan at checkout.",
  },
  {
    q: "What are the free limits, and what happens if I reach them?",
    a: `Free accounts can have up to ${FREE_LIMITS.allListTodos} active todos across all lists, plus ${FREE_LIMITS.extraLists} custom list beyond Today with up to ${FREE_LIMITS.extraListTodos} active todos in that list. Notes follow the same shape on the free tier: up to ${FREE_LIMITS.allListNotes} active notes across all folders, plus ${FREE_LIMITS.extraNoteLists} custom folder with up to ${FREE_LIMITS.extraListNotes} active notes in that folder. If you need more, upgrade to Pro for unlimited todos, lists, notes, and folders, or complete work to stay within the free caps.`,
  },
  {
    q: "Can I use Yalp without Cursor or Claude?",
    a: "Yes. The web app is a full client on its own. You can manage todos, lists, notes, and folders in the browser. MCP is optional and for when you want your AI tools wired into your todo lists.",
  },
  {
    q: "Will my todos and notes be used to train public AI models?",
    a: "Your todos and notes are tied to your account and are there to help you work, not to be sold to advertisers or mixed into public model training. Use Yalp for your own productivity; we don’t monetize your content that way.",
  },
  {
    q: "How does billing and cancellation work for Pro?",
    a: "Pro checkout runs through Stripe. For Monthly and Yearly plans you can manage or cancel from your account; you’re not locked in beyond the period you’ve paid for. Lifetime is a one-time purchase with no renewals.",
  },
  {
    q: "Does Yalp only work with Cursor and Claude?",
    a: "Those are the examples we show most often, but any MCP-capable client that can connect to Yalp’s server can use the same tools, including today’s stack and tomorrow’s, as long as they speak MCP.",
  },
];

const TESTIMONIALS: readonly { quote: string; name: string; role: string }[] = [
  {
    quote:
      "Yalp is the first todo app that actually fits how I work with AI. I can brainstorm in Cursor, and my real tasks are already there without copy-pasting anything.",
    name: "Merve Cankiz Coruh",
    role: "Product Manager",
  },
  {
    quote:
      "I expected another simple list app, but the MCP flow changed everything. It feels like my assistant and my planning system are finally in the same place.",
    name: "Daniel Brooks",
    role: "Indie Developer",
  },
  {
    quote:
      "The biggest value for me is focus. Yalp keeps the UI clean, but still gives me powerful automation through integrations when I need it.",
    name: "Aisha Khan",
    role: "Operations Lead",
  },
];

export function LandingPricingFooterPaper() {
  return (
    <div className="mt-24 flex w-full max-w-[640px] flex-col items-stretch px-1">
      <LandingPlansPaperSection />

      <section
        className="mt-24 flex flex-col items-center gap-6"
        aria-labelledby="landing-testimonials-heading"
      >
        <div className="flex items-center gap-2 rounded-xl bg-[#F7F7F7] px-3 py-[6.5px]">
          <span className="font-title text-[12px] font-medium leading-[1.5] text-[#777777]">
            TESTIMONIALS
          </span>
        </div>
        <h2
          id="landing-testimonials-heading"
          className="mx-auto w-full max-w-[400px] text-center font-title text-[36px] font-medium leading-[44px] tracking-[-0.64px] text-[#181925]"
        >
          What our users say
        </h2>
        <p className="-mt-2 w-full max-w-[440px] text-center font-title text-[16px] font-normal leading-6 tracking-[-0.32px] text-[#777777]">
          What early users say after moving
          <br />
          their daily workflow to Yalp.
        </p>

        <TestimonialsCarousel items={TESTIMONIALS} />
      </section>

      <section
        className="mt-24 flex flex-col items-center gap-6"
        aria-labelledby="landing-faq-heading"
      >
        <h2
          id="landing-faq-heading"
          className="mx-auto w-full max-w-[400px] text-center font-title text-[36px] font-medium leading-[44px] tracking-[-0.64px] text-[#181925]"
        >
          FAQ
        </h2>
        <p className="-mt-2 w-full max-w-[400px] text-center font-title text-[16px] font-normal leading-6 tracking-[-0.32px] text-[#777777]">
          Straight answers to what people usually ask
          <br />
          before trying Yalp.
        </p>

        <div className="mx-auto flex w-full max-w-[400px] flex-col rounded-2xl border border-[#ebebeb] bg-[#fafafa]/80 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group border-b border-[#ececf2] bg-white px-4 py-0 last:border-b-0 [&[open]]:shadow-[inset_0_1px_0_0_rgba(0,181,233,0.06)] first:rounded-t-[14px] last:rounded-b-[14px]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 font-title text-[15px] font-medium leading-snug tracking-[-0.02em] text-[#181925] select-none [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 pr-2">{item.q}</span>
                <ChevronDown
                  className="size-[18px] shrink-0 text-[#9a9aa8] transition-transform duration-200 ease-out group-open:rotate-180"
                  strokeWidth={2}
                  aria-hidden
                />
              </summary>
              <p className="border-t border-[#f4f4f8] px-0 pb-4 pt-3 font-title text-[14px] leading-[21px] tracking-[-0.01em] text-[#5c5c66]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <footer
        className="mt-[112px] border-t border-[#ececf2] pt-10 pb-2"
        aria-label="Site footer"
      >
        <nav aria-label="Footer" className="mx-auto w-full max-w-[640px]">
          {/* Top row: branding + 3 columns of links */}
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

          {/* Bottom row: legal */}
          <p className="mt-[80px] text-center font-title text-[12px] leading-4 text-[#a4a4ae]">
            Yalp AI © 2026. All rights reserved.
          </p>
        </nav>
      </footer>
    </div>
  );
}
