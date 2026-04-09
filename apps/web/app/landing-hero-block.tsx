import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingRotatingTool } from "@/components/landing-rotating-tool";

type LandingHeroBlockProps = {
  className?: string;
  /** Controls the top spacing (margin-top) for the hero section. */
  topSpacingClassName?: string;
  pillLabel?: string;
  pillOnlyLabel?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  hideCta?: boolean;
};

export function LandingHeroBlock({
  className,
  topSpacingClassName = "mt-[144px] sm:mt-[136px]",
  pillLabel = "Introducing Yalp AI",
  pillOnlyLabel = false,
  title,
  description,
  ctaLabel = "Get started for free",
  ctaHref = "/signup",
  hideCta = false,
}: LandingHeroBlockProps) {
  return (
    <section
      className={[
        "mx-auto flex w-full max-w-[760px] flex-col items-center gap-6 text-center",
        topSpacingClassName,
        className ?? "",
      ].join(" ")}
    >
      <Link
        href="/why-i-built"
        className="inline-flex max-w-full items-center gap-2 rounded-[99px] bg-[#f7f7f7] px-3 py-[6.5px] no-underline"
      >
        <span className="font-title text-xs font-medium text-[#777]">{pillLabel}</span>
        {pillOnlyLabel ? null : (
          <>
            <span className="h-1 w-1 rounded-[2px] bg-[#ccc]" aria-hidden />
            <span className="text-xs text-[#979797]">Read more</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#979797]" aria-hidden />
          </>
        )}
      </Link>

      <div className="flex w-full flex-col items-center gap-4">
        <h1 className="w-full text-balance font-title text-[40px] leading-[46px] font-medium tracking-[-1.2px] text-[rgba(24,25,37,1)] sm:text-5xl sm:leading-[56px] sm:tracking-[-1.6px]">
          {title ?? (
            <>
              Manage your todos
              <br />
              <LandingRotatingTool />
            </>
          )}
        </h1>
        <p className="max-w-[560px] text-pretty font-title text-[15px] leading-6 font-medium tracking-[-0.32px] text-[#777] sm:text-base">
          {description ?? (
            <>
              One list for everything you need to do, and you can drive it
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              from Cursor, Claude Desktop, or any other MCP-ready app.
            </>
          )}
        </p>
      </div>

      {hideCta ? null : (
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center gap-[10px] rounded-full bg-[#00b5e9] px-4 py-[11px] font-title text-sm leading-[18px] font-medium tracking-[-0.32px] text-white no-underline shadow-[0px_1px_1px_0px_rgba(0,0,0,0.08),0px_0px_0px_1px_rgba(0,0,0,0.05)] transition hover:bg-[#09abda]"
        >
          {ctaLabel}
        </Link>
      )}
    </section>
  );
}
