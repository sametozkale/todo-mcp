"use client";

import { useState } from "react";
import { SliderButton } from "slider-nav-button/react";
import "slider-nav-button/styles.css";

type TestimonialItem = {
  quote: string;
  name: string;
  role: string;
};

type TestimonialsCarouselProps = {
  items: readonly TestimonialItem[];
};

export function TestimonialsCarousel({ items }: TestimonialsCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (items.length === 0) return null;

  const active = items[activeIndex]!;
  const prev = () => setActiveIndex((current) => (current - 1 + items.length) % items.length);
  const next = () => setActiveIndex((current) => (current + 1) % items.length);

  return (
    <div className="mx-auto w-full max-w-[400px]">
      <figure className="rounded-2xl border border-[#ebebeb] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <blockquote className="font-title text-[14px] leading-[22px] tracking-[-0.01em] text-[#3f4552]">
          &ldquo;{active.quote}&rdquo;
        </blockquote>
        <figcaption className="mt-3 border-t border-[#f2f3f7] pt-3">
          <p className="font-title text-[13px] font-medium tracking-[-0.24px] text-[#181925]">
            {active.name}
          </p>
          <p className="font-title text-[12px] tracking-[-0.18px] text-[#7b8190]">{active.role}</p>
        </figcaption>
      </figure>

      <div className="mt-3 flex items-center justify-center">
        <SliderButton onPrev={prev} onNext={next} size="sm" />
      </div>
    </div>
  );
}
