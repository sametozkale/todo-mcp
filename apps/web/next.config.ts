import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * HeroUI + framer-motion: compile with the app bundle to avoid webpack chunk/runtime
   * mismatches in dev (e.g. "__webpack_modules__[moduleId] is not a function" after HMR).
   */
  transpilePackages: ["@heroui/react", "@heroui/styles", "framer-motion"],
  /**
   * Do not include @heroui/react here while also using transpilePackages for HeroUI —
   * the combination can produce flaky module shapes in webpack dev.
   */
  experimental: {
    // lucide-react supports import narrowing. @hugeicons/react only exposes "." exports —
    // enabling it here caused dev/runtime "__webpack_modules__[moduleId] is not a function".
    optimizePackageImports: ["lucide-react"],
  },
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
    ],
  },
};

export default nextConfig;
