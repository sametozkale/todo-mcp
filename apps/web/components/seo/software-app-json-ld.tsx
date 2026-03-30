import { getSiteUrl } from "@/lib/site-url";

export function SoftwareApplicationJsonLd() {
  const url = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Yalp",
    description:
      "A focused todo app with MCP integration to capture and manage tasks from Cursor, Claude, and the web app.",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    potentialAction: {
      "@type": "UseAction",
      target: `${url}/signup`,
      name: "Create account and start managing todos",
    },
    url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
