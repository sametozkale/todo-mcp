"use client";

import Image from "next/image";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";

import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

/** Bright core (Magic UI–style pulse) and cool edge along the beam */
const beamBright = "#38e0ff";
const beamEdge = "#0284c7";
const HERO_TAB_ROTATE_MS = 5000;

const heroTabs = [
  {
    id: "manage-todos",
    label: "Manage Todos",
    src: "/hero.png",
    alt: "Yalp web app: list tabs, new todo field, and tasks synced from integrations.",
    width: 3810,
    height: 2475,
  },
  {
    id: "create-lists",
    label: "Create Lists",
    src: "/feature-create-lists.png",
    alt: "Yalp modal for creating a new list from the main todo view.",
    width: 1024,
    height: 664,
  },
  {
    id: "sub-todos",
    label: "Subtasks",
    src: "/feature-subtasks.png",
    alt: "Yalp task detail page with a subtasks checklist.",
    width: 1024,
    height: 664,
  },
  {
    id: "notes",
    label: "Notes",
    src: "/hero.png",
    alt: "Yalp Notes workspace in the browser.",
    width: 3810,
    height: 2475,
  },
  {
    id: "mcp-connections",
    label: "MCP Connections",
    src: "/feature-mcp-connections.png",
    alt: "Yalp MCP Connections page for connecting AI clients.",
    width: 1024,
    height: 664,
  },
] as const;

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
  const [activeTab, setActiveTab] = useState(0);
  const [tabProgress, setTabProgress] = useState(0);
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

  useEffect(() => {
    setTabProgress(0);
    const start = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const nextProgress = Math.min((now - start) / HERO_TAB_ROTATE_MS, 1);
      setTabProgress(nextProgress);

      if (nextProgress >= 1) {
        setActiveTab((prev) => (prev + 1) % heroTabs.length);
        return;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab]);

  return (
    <section
      className="mt-10 w-full max-w-[1024px] sm:mt-20"
      aria-label="Integrations: Cursor, Claude, and MCP clients connect to Yalp; web app syncs with Yalp."
    >
      <div
        ref={containerRef}
        className="relative flex min-h-[300px] w-full items-center justify-center overflow-visible px-2 pt-0 pb-4 sm:min-h-[340px] sm:px-6 sm:pt-0 sm:pb-4"
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

      <div className="mt-14 w-full px-2 sm:mt-24 sm:px-6">
        <div
          className="mx-auto mb-4 flex w-fit max-w-full shrink-0 flex-wrap items-center rounded-[99px] border border-[#F7F7F7] bg-white p-1 sm:mb-5"
          role="tablist"
          aria-label="Product feature previews"
        >
          {heroTabs.map((tab, idx) => {
            const isActive = idx === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`feature-tab-panel-${tab.id}`}
                id={`feature-tab-${tab.id}`}
                onClick={() => setActiveTab(idx)}
                className={cn(
                  "relative overflow-hidden rounded-[99px] px-4 py-2 font-title text-[14px] font-medium leading-5 transition-colors",
                  isActive
                    ? "bg-transparent text-[#181925]"
                    : "text-[#666666] hover:text-[#181925]",
                )}
              >
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-[99px] bg-[#F7F7F7]"
                    style={{ width: `${tabProgress * 100}%` }}
                  />
                ) : null}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="overflow-hidden rounded-lg border border-[#eee] bg-white sm:rounded-xl md:rounded-2xl">
          <div
            role="tabpanel"
            id={`feature-tab-panel-${heroTabs[activeTab].id}`}
            aria-labelledby={`feature-tab-${heroTabs[activeTab].id}`}
            className="relative aspect-[3810/2475] w-full"
          >
            {heroTabs.map((tab, idx) => (
              <img
                key={tab.id}
                src={tab.src}
                alt={tab.alt}
                width={tab.width}
                height={tab.height}
                loading={idx === activeTab ? "eager" : "lazy"}
                decoding="async"
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out",
                  idx === activeTab ? "opacity-100" : "opacity-0",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
