"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

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
const LINE_STEP_MS = 420;

export function WhyIBuiltTypedIntro() {
  const lines = useMemo(() => intro.split("\n"), []);
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisibleLineCount((count) => {
        if (count >= lines.length) {
          window.clearInterval(id);
          return count;
        }
        return count + 1;
      });
    }, LINE_STEP_MS);

    return () => window.clearInterval(id);
  }, [lines.length]);

  useEffect(() => {
    if (visibleLineCount >= lines.length) {
      setShowCta(true);
    }
  }, [lines.length, visibleLineCount]);

  return (
    <div
      className="mx-auto w-full max-w-[400px]"
      style={{ minHeight: RESERVED_TEXT_HEIGHT_PX + RESERVED_CTA_HEIGHT_PX }}
    >
      <p className="w-full text-center font-sans text-[15px] leading-6 text-[#777777]">
        {lines.slice(0, visibleLineCount).map((line, index) => (
          <motion.span
            key={`${index}-${line}`}
            className="block whitespace-pre-line"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
          >
            {line === "" ? "\u00A0" : line}
          </motion.span>
        ))}
      </p>

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

