"use client";

import * as React from "react";

type AsTag =
  | "article"
  | "div"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "li"
  | "p"
  | "section"
  | "span";

type CursorStyle = "line" | "block" | "underscore";

export type TypingAnimationProps = {
  children?: string;
  words?: string[];
  className?: string;
  /** Duration for each character (ms per character). */
  duration?: number;
  typeSpeed?: number;
  delay?: number;
  as?: AsTag;
  startOnView?: boolean;
  showCursor?: boolean;
  blinkCursor?: boolean;
  cursorStyle?: CursorStyle;
  onComplete?: () => void;
};

const CURSOR_MAP: Record<CursorStyle, string> = {
  line: "|",
  block: "▌",
  underscore: "_",
};

function useInView<T extends HTMLElement>(enabled: boolean) {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(!enabled);

  React.useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, inView };
}

export function TypingAnimation({
  children,
  words,
  className,
  duration = 100,
  typeSpeed,
  delay = 0,
  as: As = "h1",
  startOnView = true,
  showCursor = true,
  blinkCursor = true,
  cursorStyle = "underscore",
  onComplete,
}: TypingAnimationProps) {
  const fullText = React.useMemo(() => {
    if (typeof children === "string") return children;
    if (Array.isArray(words) && words.length > 0) return words[0] ?? "";
    return "";
  }, [children, words]);
  const effectiveTypeSpeed = typeSpeed ?? duration;

  const { ref, inView } = useInView<HTMLDivElement>(startOnView);
  const [text, setText] = React.useState("");
  const [showCaret, setShowCaret] = React.useState(true);
  const [started, setStarted] = React.useState(!startOnView);
  const hasCompletedRef = React.useRef(false);

  const cursor = CURSOR_MAP[cursorStyle];

  React.useEffect(() => {
    if (!showCursor || !blinkCursor) return;
    const id = window.setInterval(() => setShowCaret((v) => !v), 500);
    return () => window.clearInterval(id);
  }, [showCursor, blinkCursor]);

  React.useEffect(() => {
    if (!inView) return;
    if (!started) {
      const initial = window.setTimeout(() => setStarted(true), delay);
      return () => window.clearTimeout(initial);
    }
    if (text.length >= fullText.length) return;
    const timer = window.setTimeout(() => {
      setText(fullText.slice(0, text.length + 1));
    }, effectiveTypeSpeed);

    return () => window.clearTimeout(timer);
  }, [delay, effectiveTypeSpeed, fullText, inView, started, text.length]);

  React.useEffect(() => {
    if (!onComplete) return;
    if (!started) return;
    if (!inView) return;
    if (hasCompletedRef.current) return;
    if (fullText.length === 0) return;
    if (text.length < fullText.length) return;
    hasCompletedRef.current = true;
    onComplete();
  }, [fullText.length, inView, onComplete, started, text.length]);

  return (
    <div ref={ref} className="inline-block w-full">
      <As className={className}>
        {text}
        {showCursor ? (
          <span aria-hidden className={blinkCursor ? "" : "opacity-100"}>
            {showCaret ? cursor : "\u00A0"}
          </span>
        ) : null}
      </As>
    </div>
  );
}

