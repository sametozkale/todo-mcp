import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { withSocialImage } from "@/lib/seo-metadata";

const title = "Create a Yalp account";
const description =
  "Sign up for free to organize todos, custom lists, and connect AI clients via MCP. Upgrade anytime for unlimited tasks and lists.";

export const metadata: Metadata = withSocialImage({
  title: "Sign up",
  description,
  alternates: { canonical: "/signup" },
  openGraph: {
    title,
    description,
    url: "/signup",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
});

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <SignupForm nextPath={params.next} />;
}
