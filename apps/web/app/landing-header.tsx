import Link from "next/link";
import Image from "next/image";

export function LandingHeader() {
  return (
    <header className="pointer-events-auto fixed top-6 left-1/2 z-20 -translate-x-1/2">
      <nav className="inline-flex h-12 flex-col items-start gap-[10px] rounded-full bg-[#14141f] p-2 pl-3 shadow-[0_1px_4px_0_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)] backdrop-blur-[8px] sm:pl-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            aria-label="Home"
            className="inline-flex h-6 w-5 shrink-0 items-center justify-center rounded-sm no-underline outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
          >
            <Image
              src="/to-do-mcp-logo-white-48.svg"
              alt=""
              aria-hidden
              width={20}
              height={24}
              className="h-full w-full object-contain"
              priority
            />
          </Link>

          <Link
            href="/why-i-built"
            className="hidden font-title text-[14px] leading-5 font-medium tracking-[-0.32px] text-[#bbbcc3] no-underline transition hover:text-white sm:inline"
          >
            Story
          </Link>
          <Link
            href="/roadmap"
            className="hidden font-title text-[14px] leading-5 font-medium tracking-[-0.32px] text-[#bbbcc3] no-underline transition hover:text-white sm:inline"
          >
            Roadmap
          </Link>

          <div className="flex items-center gap-[6px]">
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-full bg-white/8 px-3 py-[7px] font-title text-[14px] leading-[18px] font-medium tracking-[-0.32px] text-[#d4d5da] no-underline transition hover:bg-white/12 hover:text-white sm:h-8"
            >
              Login
            </Link>

            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-full bg-[#00b5e9] px-3 py-[7px] font-title text-[14px] leading-[18px] font-medium tracking-[-0.32px] text-white no-underline shadow-[0_1px_1px_0_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)] transition hover:bg-[#09abda] sm:h-8"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
