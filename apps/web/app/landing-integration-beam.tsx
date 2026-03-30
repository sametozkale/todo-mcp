"use client";

import Image from "next/image";
import { forwardRef, useRef, type ReactNode } from "react";
import { Globe } from "lucide-react";

import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

/** Bright core (Magic UI–style pulse) and cool edge along the beam */
const beamBright = "#38e0ff";
const beamEdge = "#0284c7";

const Circle = forwardRef<
  HTMLDivElement,
  { className?: string; children?: ReactNode; label?: string }
>(({ className, children, label }, ref) => (
  <div className="flex flex-col items-center gap-2">
    <div
      ref={ref}
      className={cn(
        "relative z-10 flex size-[46px] shrink-0 items-center justify-center rounded-full bg-white/85 p-2 shadow-[0_6px_28px_-10px_rgba(0,0,0,0.18),0_1px_0_0_rgba(255,255,255,0.9)_inset] ring-1 ring-black/[0.06] backdrop-blur-md sm:size-[52px] sm:p-2.5",
        className,
      )}
    >
      {children}
    </div>
    {label ? (
      <span className="font-title text-[10px] font-medium tracking-[-0.12px] text-[#6b6b76] sm:text-[11px]">
        {label}
      </span>
    ) : null}
  </div>
));
Circle.displayName = "Circle";

export function LandingIntegrationBeam() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const claudeRef = useRef<HTMLDivElement>(null);
  const mcpRef = useRef<HTMLDivElement>(null);
  const yalpRef = useRef<HTMLDivElement>(null);
  const whatsappRef = useRef<HTMLDivElement>(null);
  const telegramRef = useRef<HTMLDivElement>(null);
  const webRef = useRef<HTMLDivElement>(null);

  const beamCommon = {
    containerRef,
    duration: 3.8,
    pathColor: "#c8c8d4",
    pathWidth: 2,
    pathOpacity: 0.42,
    gradientStartColor: beamBright,
    gradientStopColor: beamEdge,
  } as const;

  return (
    <section
      className="mt-16 w-full max-w-3xl sm:mt-20"
      aria-label="Integrations: Cursor, Claude, and MCP clients connect to Yalp; web app syncs with Yalp."
    >
      <div
        ref={containerRef}
        className="relative flex min-h-[300px] w-full items-center justify-center overflow-visible px-2 py-4 sm:min-h-[340px] sm:px-6 sm:py-4"
      >
        <div className="relative z-10 flex w-full max-w-xl flex-row items-center justify-between gap-3 sm:max-w-2xl sm:gap-8">
          <div className="flex flex-col justify-center gap-4 sm:gap-5">
            <Circle ref={cursorRef} label="Cursor">
              <Image
                src="/landing-brand-cursor.svg"
                alt=""
                width={24}
                height={24}
                className="size-5 object-contain sm:size-6"
                aria-hidden
              />
            </Circle>
            <Circle ref={claudeRef} label="Claude">
              <Image
                src="/landing-brand-claude.svg"
                alt=""
                width={24}
                height={24}
                className="size-5 object-contain sm:size-6"
                aria-hidden
              />
            </Circle>
            <Circle ref={mcpRef} label="MCP & more">
              <Image
                src="/landing-brand-mcp.svg"
                alt=""
                width={24}
                height={24}
                className="size-5 object-contain sm:size-6"
                aria-hidden
              />
            </Circle>
          </div>

          <div className="flex flex-col items-center gap-2.5">
            <div
              ref={yalpRef}
              className="relative z-10 flex size-[72px] shrink-0 items-center justify-center rounded-full bg-white/90 py-4 px-3 shadow-[0_6px_28px_-10px_rgba(0,0,0,0.18),0_1px_0_0_rgba(255,255,255,0.9)_inset] ring-2 ring-black/[0.06] backdrop-blur-md sm:size-[80px] sm:py-4 sm:px-3.5"
            >
              <Image
                src="/to-do-mcp-logo-black-48.svg"
                alt="Yalp"
                width={48}
                height={48}
                className="size-10 object-contain sm:size-11"
              />
            </div>
            <span className="font-title text-xs font-semibold tracking-[-0.24px] text-[#181925]">
              Yalp
            </span>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:gap-5">
            <Circle ref={whatsappRef} label="Whatsapp">
              <Image
                src="/landing-brand-whatsapp.svg"
                alt=""
                width={24}
                height={24}
                className="size-5 object-contain sm:size-6"
                aria-hidden
              />
            </Circle>
            <Circle ref={telegramRef} label="Telegram">
              <Image
                src="/landing-brand-telegram.svg"
                alt=""
                width={24}
                height={24}
                className="size-5 object-contain sm:size-6"
                aria-hidden
              />
            </Circle>
            <Circle ref={webRef} label="Web app">
              <Globe className="size-5 text-[#00b5e9] sm:size-6" strokeWidth={2} />
            </Circle>
          </div>
        </div>

        <AnimatedBeam
          {...beamCommon}
          fromRef={cursorRef}
          toRef={yalpRef}
          curvature={-78}
          endYOffset={-6}
        />
        <AnimatedBeam
          {...beamCommon}
          fromRef={claudeRef}
          toRef={yalpRef}
          curvature={0}
          flattenY
          reverse
          delay={0.35}
        />
        <AnimatedBeam
          {...beamCommon}
          fromRef={mcpRef}
          toRef={yalpRef}
          curvature={78}
          endYOffset={6}
          delay={0.7}
        />
        <AnimatedBeam
          {...beamCommon}
          fromRef={whatsappRef}
          toRef={yalpRef}
          startYOffset={-6}
          curvature={-78}
          delay={0}
        />
        <AnimatedBeam
          {...beamCommon}
          fromRef={telegramRef}
          toRef={yalpRef}
          curvature={0}
          flattenY
          reverse={false}
          delay={0.35}
        />

        <AnimatedBeam
          {...beamCommon}
          fromRef={webRef}
          toRef={yalpRef}
          startYOffset={6}
          curvature={78}
          delay={0.7}
        />
      </div>
    </section>
  );
}
