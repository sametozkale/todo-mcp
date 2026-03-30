"use client";

import { useState } from "react";
import { TypingAnimation } from "@/components/ui/typing-animation";

const intro =
  "I lost focus 12 times yesterday.\n"
  + "Not because of Slack.\n"
  + "Because of my todo app.\n"
  + "\n"
  + "It started with one question.\n"
  + "Why do I have to leave my flow just to remember something?\n"
  + "\n"
  + "I spend hours in Cursor.\n"
  + "I think with Claude.\n"
  + "I build.\n"
  + "I design.\n"
  + "I research.\n"
  + "\n"
  + "Then a thought lands.\n"
  + "The next product step.\n"
  + "A quick note.\n"
  + "Milk for later.\n"
  + "\n"
  + "And suddenly I have to open another app.\n"
  + "Create a task.\n"
  + "Come back.\n"
  + "\n"
  + "Focus broken.\n"
  + "\n"
  + "That is why I built Yalp.\n"
  + "Minimal.\n"
  + "Fast.\n"
  + "Modern.\n"
  + "\n"
  + "Create todos from Cursor.\n"
  + "Create todos from Claude.\n"
  + "Create todos from any MCP-enabled tool.\n"
  + "\n"
  + "See them instantly in your app.\n"
  + "Stay in flow.\n"
  + "\n"
  + "If you use Cursor, Claude, or similar tools,\n"
  + "you have probably felt this too.\n"
  + "Managing your todos through MCP,\n"
  + "feels more natural than you expect.";

const RESERVED_LINES = intro.split("\n").length;
// Text uses `leading-6` (= 24px). Reserve space upfront to prevent footer layout shift.
const RESERVED_TEXT_HEIGHT_PX = RESERVED_LINES * 24;
// Reserve CTA space too (32px margin + ~44px button height).
const RESERVED_CTA_HEIGHT_PX = 32 + 44;

export function WhyIBuiltTypedIntro() {
  const [showCta, setShowCta] = useState(false);

  return (
    <div
      className="mx-auto w-full max-w-[400px]"
      style={{ minHeight: RESERVED_TEXT_HEIGHT_PX + RESERVED_CTA_HEIGHT_PX }}
    >
      <TypingAnimation
        as="p"
        startOnView={false}
        showCursor
        cursorStyle="line"
        typeSpeed={55}
        className="w-full whitespace-pre-line text-center font-sans text-[15px] leading-6 text-[#777777]"
        onComplete={() => setShowCta(true)}
      >
        {intro}
      </TypingAnimation>

      {showCta ? (
        <div className="mt-8 flex w-full justify-center">
          <a
            href="https://samet.works"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center justify-center rounded-full bg-[#00b5e9] px-4 py-[11px] font-title text-sm leading-[18px] font-medium tracking-[-0.32px] text-white no-underline shadow-[0px_1px_1px_0px_rgba(0,0,0,0.08),0px_0px_0px_1px_rgba(0,0,0,0.05)] transition hover:bg-[#09abda]"
          >
            Meet with me
          </a>
        </div>
      ) : null}
    </div>
  );
}

