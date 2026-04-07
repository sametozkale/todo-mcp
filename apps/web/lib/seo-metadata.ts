import type { Metadata } from "next";

export const socialImage = {
  url: "/metadata-yalp.png",
  width: 1200,
  height: 630,
  alt: "Yalp AI - Manage your to-dos from Cursor, Claude & more",
} as const;

export function withSocialImage(metadata: Metadata): Metadata {
  const openGraph = (metadata.openGraph ?? {}) as NonNullable<Metadata["openGraph"]>;
  const twitter = (metadata.twitter ?? {}) as NonNullable<Metadata["twitter"]>;

  return {
    ...metadata,
    openGraph: {
      ...openGraph,
      images: openGraph.images ?? [socialImage],
    },
    twitter: {
      ...twitter,
      images: twitter.images ?? [socialImage.url],
    },
  };
}
