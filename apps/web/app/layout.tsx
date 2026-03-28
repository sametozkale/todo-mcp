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
    icon: [{ url: "/to-do-mcp-logo.png", type: "image/png" }],
    shortcut: [{ url: "/to-do-mcp-logo.png", type: "image/png" }],
    apple: [{ url: "/to-do-mcp-logo.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: siteName,
    description: defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: defaultDescription,
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
    <html lang="en" className="light" data-theme="light">
      <body
        className={`${inter.variable} ${openRunde.variable} light bg-[#fafafa] text-foreground font-sans antialiased`}
      >
        <OrganizationJsonLd />
        <SiteAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
