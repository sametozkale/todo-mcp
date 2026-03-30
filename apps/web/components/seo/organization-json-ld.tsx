import { getSiteUrl } from "@/lib/site-url";

export function OrganizationJsonLd() {
  const url = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Yalp",
    url,
    logo: `${url}/to-do-mcp-logo-black-48.svg`,
    description:
      "Yalp is a focused todo app with MCP integrations for AI-assisted workflows in tools like Cursor and Claude.",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
