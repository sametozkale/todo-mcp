import type { Metadata } from "next";
import Script from "next/script";
import { inter, openRunde } from "./fonts";
import { Providers } from "./providers";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";
import { SiteAnalytics } from "@/components/seo/site-analytics";
import { socialImage } from "@/lib/seo-metadata";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getSiteUrl();
const siteName = "Yalp";

/** Hotjar: load in root layout with beforeInteractive so the snippet exists in initial HTML (Hotjar site verification). */
const hotjarId = (process.env.NEXT_PUBLIC_HOTJAR_ID ?? "6687281").trim();
const hotjarVersion = (process.env.NEXT_PUBLIC_HOTJAR_SNIPPET_VERSION ?? "6").trim();
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
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: defaultDescription,
    images: [socialImage.url],
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
        {hotjarId ? (
          <Script id="hotjar-init" strategy="beforeInteractive">
            {`
(function(h,o,t,j,a,r){
  h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
  h._hjSettings={hjid:${hotjarId},hjsv:${hotjarVersion}};
  a=o.getElementsByTagName('head')[0];
  r=o.createElement('script');r.async=1;
  r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
  a.appendChild(r);
})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `}
          </Script>
        ) : null}
        <OrganizationJsonLd />
        <SiteAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
