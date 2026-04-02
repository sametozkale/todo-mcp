import type { Metadata } from "next";
import { inter, openRunde } from "./fonts";
import { Providers } from "./providers";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";
import { SiteAnalytics } from "@/components/seo/site-analytics";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getSiteUrl();
const siteName = "Yalp";
const defaultDescription =
  "Yalp is a lightweight todo app with MCP connections for AI tools. Stay focused and get things done.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s — ${siteName}`,
  },
  description: defaultDescription,
  applicationName: siteName,
  icons: {
    icon: [
      {
        url: "/to-do-mcp-logo-black-48.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        url: "/to-do-mcp-logo-white-48.svg",
        type: "image/svg+xml",
        sizes: "any",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    shortcut: [
      {
        url: "/to-do-mcp-logo-black-48.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
    apple: [
      {
        url: "/to-do-mcp-logo-black-48.svg",
        type: "image/svg+xml",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: siteName,
    description: defaultDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Yalp — lightweight todo and MCP connections",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: defaultDescription,
    images: ["/opengraph-image"],
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`light ${inter.variable} ${openRunde.variable}`}
      data-theme="light"
    >
      <body
        className="light bg-[#fafafa] text-foreground font-sans antialiased"
        suppressHydrationWarning
      >
        <OrganizationJsonLd />
        <SiteAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
