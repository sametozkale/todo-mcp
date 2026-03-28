import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** HeroUI: compile with the app bundle to avoid webpack chunk/runtime mismatches in dev. */
  transpilePackages: ["@heroui/react", "@heroui/styles"],
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
    ],
  },
};

export default nextConfig;
