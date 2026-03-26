import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up — Yalp",
  description: "Create a new Yalp account.",
};

export default function SignupPage() {
  return <SignupForm />;
}
