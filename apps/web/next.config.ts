import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * HeroUI + framer-motion: compile with the app bundle to avoid webpack chunk/runtime
   * mismatches in dev (e.g. "__webpack_modules__[moduleId] is not a function" after HMR).
   */
  transpilePackages: [
    "@heroui/react",
    "@heroui/styles",
    "framer-motion",
    "sonner",
    /** Drag-and-drop: prebundle with app to reduce Webpack chunk/runtime drift in dev. */
    "@dnd-kit/core",
    "@dnd-kit/sortable",
    "@dnd-kit/utilities",
    "@dnd-kit/modifiers",
  ],
  /**
   * Avoid `experimental.optimizePackageImports` here: with Webpack it has triggered
   * `__webpack_modules__[moduleId] is not a function` (HMR / prod) together with
   * `transpilePackages` and HeroUI. Use named `lucide-react` imports; optional dev
   * bundler: `pnpm dev:turbo`.
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "heroui-assets.nyc3.cdn.digitaloceanspaces.com",
        pathname: "/avatars/**",
      },
      {
        protocol: "https",
        hostname: "www.cursor.com",
        pathname: "/favicon.ico",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/simple-icons/simple-icons/**",
      },
      {
        protocol: "https",
        hostname: "windsurf.com",
        pathname: "/favicon.ico",
      },
      {
        protocol: "https",
        hostname: "code.visualstudio.com",
        pathname: "/favicon.ico",
      },
      {
        protocol: "https",
        hostname: "www.whatsapp.com",
        pathname: "/favicon.ico",
      },
      {
        protocol: "https",
        hostname: "telegram.org",
        pathname: "/img/**",
      },
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/chrome/static/images/favicons/**",
      },
    ],
  },
};

export default nextConfig;
