"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface AnimatedBeamProps {
  className?: string;
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  /**
   * Forces the beam to be horizontally flat (startY = endY) so curvature=0
   * produces a perfectly horizontal straight line.
   */
  flattenY?: boolean;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  repeat?: number;
  repeatDelay?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}

export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  flattenY = false,
  reverse,
  duration = 5,
  delay = 0,
  pathColor = "gray",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#ffaa40",
  gradientStopColor = "#9c40ff",
  repeat = Infinity,
  repeatDelay = 0,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}: AnimatedBeamProps) {
  const id = useId().replace(/:/g, "");
  const glowId = `${id}-glow`;
  const [pathD, setPathD] = useState("");
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  const gradientForward = {
    x1: ["10%", "110%"],
    x2: ["0%", "100%"],
    y1: ["0%", "0%"],
    y2: ["0%", "0%"],
  };

  const gradientBackward = {
    x1: ["90%", "-10%"],
    x2: ["100%", "0%"],
    y1: ["0%", "0%"],
    y2: ["0%", "0%"],
  };

  // Ensures the bright gradient "core" animates from `fromRef` to `toRef`
  // (independent of whether those nodes are positioned left or right).
  const [gradientReverse, setGradientReverse] = useState(false);

  const updatePath = useCallback(() => {
    if (!containerRef.current || !fromRef.current || !toRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const rectA = fromRef.current.getBoundingClientRect();
    const rectB = toRef.current.getBoundingClientRect();

    const svgWidth = Math.max(1, containerRect.width);
    const svgHeight = Math.max(1, containerRect.height);
    setSvgDimensions({ width: svgWidth, height: svgHeight });

    const startX =
      rectA.left - containerRect.left + rectA.width / 2 + startXOffset;
    const startY =
      rectA.top - containerRect.top + rectA.height / 2 + startYOffset;
    const endX =
      rectB.left - containerRect.left + rectB.width / 2 + endXOffset;
    const endY = rectB.top - containerRect.top + rectB.height / 2 + endYOffset;

    // Auto-direction: if `fromRef` is to the right of `toRef`, flip gradient direction.
    const autoReverse = startX > endX;
    // If `reverse` is provided, override deterministically.
    const shouldReverse = typeof reverse === "boolean" ? reverse : autoReverse;
    setGradientReverse(shouldReverse);

    const startYFlattened = flattenY ? endY : startY;
    const controlY = startYFlattened - curvature;
    const d = `M ${startX},${startYFlattened} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`;
    setPathD(d);
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    flattenY,
    reverse,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ]);

  useLayoutEffect(() => {
    updatePath();
    const raf = requestAnimationFrame(() => updatePath());

    const ro = new ResizeObserver(updatePath);
    if (containerRef.current) ro.observe(containerRef.current);
    if (fromRef.current) ro.observe(fromRef.current);
    if (toRef.current) ro.observe(toRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [updatePath, containerRef, fromRef, toRef]);

  useEffect(() => {
    window.addEventListener("scroll", updatePath, { passive: true });
    window.addEventListener("resize", updatePath, { passive: true });
    return () => {
      window.removeEventListener("scroll", updatePath);
      window.removeEventListener("resize", updatePath);
    };
  }, [updatePath]);

  /** Icons/images can shift layout after first paint — remeasure so paths stay aligned. */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => updatePath());
    });
    return () => cancelAnimationFrame(id);
  }, [updatePath]);

  const w = svgDimensions.width;
  const h = svgDimensions.height;

  return (
    <svg
      fill="none"
      width={w}
      height={h}
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute top-0 left-0 z-0 transform-gpu",
        className,
      )}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter
          id={glowId}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <motion.linearGradient
          key={`${id}-${gradientReverse ? "rev" : "fwd"}`}
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={{
            x1: "0%",
            x2: "0%",
            y1: "0%",
            y2: "0%",
          }}
          animate={{
            x1: (gradientReverse ? gradientBackward : gradientForward).x1,
            x2: (gradientReverse ? gradientBackward : gradientForward).x2,
            y1: (gradientReverse ? gradientBackward : gradientForward).y1,
            y2: (gradientReverse ? gradientBackward : gradientForward).y2,
          }}
          transition={{
            delay,
            duration,
            ease: [0.16, 1, 0.3, 1],
            repeat,
            repeatDelay,
            repeatType: "loop",
          }}
        >
          <stop stopColor={gradientStopColor} stopOpacity="0" />
          <stop stopColor={gradientStopColor} />
          <stop offset="32.5%" stopColor={gradientStartColor} />
          <stop offset="100%" stopColor={gradientStartColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d={pathD}
        strokeWidth={pathWidth}
        stroke={`url(#${id})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter={`url(#${glowId})`}
      />
    </svg>
  );
}
