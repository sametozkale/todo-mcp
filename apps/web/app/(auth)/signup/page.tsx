import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up — Flowdo",
  description: "Create a new Flowdo account.",
};

export default function SignupPage() {
  return <SignupForm />;
}
