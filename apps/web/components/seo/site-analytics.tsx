"use client";

import Script from "next/script";

const gaId = process.env.NEXT_PUBLIC_GA_ID;

/** Loads GA4 when NEXT_PUBLIC_GA_ID is set; ensure cookie consent where required. Hotjar loads in `app/layout.tsx`. */
export function SiteAnalytics() {
  if (!gaId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
