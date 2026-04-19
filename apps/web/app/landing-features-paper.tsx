import {
  Globe,
  Laptop,
  Layers,
  Plug,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";

type Feature = {
  icon: typeof Zap;
  title: string;
  description: string;
};

/** Feature list layout and type scale adapted from Paper selection (450×688 frame). */
const features: Feature[] = [
  {
    icon: Plug,
    title: "Built on MCP",
    description: "Powered by MCP, the standard for connecting tools and data.",
  },
  {
    icon: Zap,
    title: "Capture in seconds",
    description: "Add tasks from Cursor, Claude, or the web app without breaking your flow.",
  },
  {
    icon: RefreshCw,
    title: "Every list stays in sync",
    description: "Your lists and todos stay consistent across MCP clients and the web app.",
  },
  {
    icon: Layers,
    title: "Organize with clarity",
    description: "Keep priorities, lists, and due dates clear so nothing gets lost.",
  },
  {
    icon: Shield,
    title: "Private by default",
    description: "Your tasks belong to your account. No ads. No selling your data.",
  },
  {
    icon: Globe,
    title: "Full web app",
    description: "Manage your list in the browser with the same sync.",
  },
  {
    icon: Laptop,
    title: "Native macOS app",
    description: "Use Yalp in a dedicated Mac app window with the same synced account.",
  },
];

export function LandingFeaturesPaper() {
  return (
    <section
      className="mt-36 mb-7 w-full max-w-[450px] px-1"
      aria-label="Yalp product features"
    >
      <div className="mx-auto flex w-full max-w-[400px] flex-col items-stretch gap-6 text-center">
        <div className="mx-auto flex items-center gap-2 rounded-xl bg-[#F7F7F7] px-3 py-[6.5px]">
          <span className="font-title text-[12px] font-medium leading-[1.5] text-[#777777]">
            FEATURES
          </span>
        </div>

        <h2 className="w-full text-center font-title text-[36px] font-medium leading-[44px] tracking-[-0.64px] text-[#181925]">
          Simplified features
        </h2>

        <p className="-mt-2 w-full text-center font-title text-[16px] font-normal leading-6 tracking-[-0.32px] text-[#777777]">
          Capture fast, stay in sync, and
          <br />
          connect when you need more power.
        </p>

        <div
          className="h-px w-full bg-[#f4f4f4]"
          aria-hidden
        />

        <ul className="list-none space-y-0 p-0">
          {features.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="mb-7 flex items-start gap-3 last:mb-0 sm:gap-[12px]"
            >
              <Icon
                className="mt-1 size-5 shrink-0 text-[#00b5e9]"
                strokeWidth={1.75}
                aria-hidden
              />
              <div className="min-w-0 text-left">
                <h3 className="font-title text-[18px] leading-[22px] font-medium tracking-[-0.02em] text-[rgba(24,25,37,1)]">
                  {title}
                </h3>
                <p className="mt-1 font-title text-[14px] leading-[20px] font-normal tracking-[-0.01em] text-[#5c5c66]">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
