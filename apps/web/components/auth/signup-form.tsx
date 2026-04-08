"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Button,
  FieldError,
  Input,
  Label,
  Surface,
  TextField,
} from "@heroui/react";
import { signInWithGoogleAction, signupAction, type AuthActionState } from "@/app/(auth)/actions";
import { GoogleIcon } from "@/components/auth/google-icon";
import { ToDoMcpLogo } from "@/components/brand/to-do-mcp-logo";
import { toast } from "@/lib/app-toast";

type SignupFormProps = {
  nextPath?: string;
};

export function SignupForm({ nextPath }: SignupFormProps) {
  const [state, formAction, isPending] = useActionState(signupAction, null as AuthActionState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [confirmTyping, setConfirmTyping] = useState(false);

  // Track whether user has edited fields since last submit,
  // so we don't keep showing stale server errors.
  const submitCounterRef = useRef(0);
  const [editCounter, setEditCounter] = useState(0);
  const lastSubmitEditCounterRef = useRef(0);

  const visibleError = useMemo(() => {
    if (!state) return undefined;
    const editedSinceSubmit = editCounter !== lastSubmitEditCounterRef.current;
    return editedSinceSubmit ? undefined : state.error;
  }, [state, editCounter]);

  useEffect(() => {
    if (!visibleError) return;
    toast.danger(visibleError, { timeout: 4500 });
  }, [visibleError]);

  useEffect(() => {
    if (!state?.success) return;
    toast.success("Check your inbox and confirm your email to finish signing up.", {
      timeout: 5000,
    });
  }, [state?.success]);

  useEffect(() => {
    if (!state?.fields) return;
    if (typeof state.fields.name === "string") setName(state.fields.name);
    if (typeof state.fields.email === "string") setEmail(state.fields.email);
  }, [state?.fields]);

  const handleSubmit = () => {
    submitCounterRef.current += 1;
    lastSubmitEditCounterRef.current = editCounter;
  };

  useEffect(() => {
    if (!confirmTouched) return;
    setConfirmTyping(true);
    const id = window.setTimeout(() => setConfirmTyping(false), 500);
    return () => window.clearTimeout(id);
  }, [confirmPassword, confirmTouched]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const showPasswordMismatch =
    confirmTouched && !confirmTyping && confirmPassword.length > 0 && !passwordsMatch;

  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <div className="w-full max-w-md pt-12">
        <ToDoMcpLogo className="mx-auto block h-6 w-6 max-w-none" />
      </div>
      <div className="mt-8 w-full max-w-md">
        <Surface
          variant="tertiary"
          className="w-full rounded-[32px] border border-[#f4f4f4] !bg-white p-8 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)]"
        >
          <form action={formAction} className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div>
              <div className="space-y-2">
                <h1 className="font-title text-xl font-semibold text-foreground">Create account</h1>
                <p className="text-sm text-muted">Get started with Yalp in a few quick fields.</p>
              </div>
            </div>
            {state?.success && (
              <p className="text-sm text-muted" role="status">
                {state.success}
              </p>
            )}
            {visibleError && (
              <p className="text-sm text-[color:var(--color-danger)]" role="alert">
                {visibleError}
              </p>
            )}
            <TextField
              name="name"
              type="text"
              isRequired
              onChange={(v) => {
                setName(String(v));
                setEditCounter((c) => c + 1);
              }}
            >
              <Label>Name</Label>
              <Input placeholder="Your name" fullWidth value={name} />
              <FieldError />
            </TextField>
            <TextField
              name="email"
              type="email"
              isRequired
              isInvalid={!!state?.fieldErrors?.email}
              onChange={(v) => {
                setEmail(String(v));
                setEditCounter((c) => c + 1);
              }}
            >
              <Label>Email</Label>
              <Input placeholder="you@example.com" fullWidth value={email} />
              {state?.fieldErrors?.email ? (
                <FieldError>{state.fieldErrors.email}</FieldError>
              ) : (
                <FieldError />
              )}
            </TextField>
            <TextField
              name="password"
              type={showPassword ? "text" : "password"}
              isRequired
              isInvalid={!!state?.fieldErrors?.password}
              onChange={(v) => {
                setPassword(String(v));
                setEditCounter((c) => c + 1);
              }}
            >
              <Label>Password</Label>
              <div className="relative">
                <Input
                  placeholder="At least 8 characters"
                  fullWidth
                  value={password}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 z-10 inline-flex items-center text-muted transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {state?.fieldErrors?.password ? (
                <FieldError>{state.fieldErrors.password}</FieldError>
              ) : (
                <FieldError />
              )}
            </TextField>
            <TextField
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              isRequired
              isInvalid={!!state?.fieldErrors?.confirmPassword || showPasswordMismatch}
              onChange={(v) => {
                setConfirmTouched(true);
                setConfirmPassword(String(v));
                setEditCounter((c) => c + 1);
              }}
            >
              <Label>Confirm password</Label>
              <div className="relative">
                <Input
                  placeholder="Re-enter your password"
                  fullWidth
                  value={confirmPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 z-10 inline-flex items-center text-muted transition-colors hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {state?.fieldErrors?.confirmPassword ? (
                <FieldError>{state.fieldErrors.confirmPassword}</FieldError>
              ) : showPasswordMismatch ? (
                <FieldError>Passwords do not match yet.</FieldError>
              ) : passwordsMatch ? (
                <p className="text-xs text-[#2a8f53]">Passwords match.</p>
              ) : (
                <FieldError />
              )}
            </TextField>
            <Button type="submit" variant="primary" fullWidth isDisabled={isPending}>
              {isPending ? "Creating account…" : "Sign up"}
            </Button>
          </form>
          <div className="mb-6 mt-6 flex items-center gap-3 text-xs text-[#979797]">
            <div className="h-px flex-1 bg-[#f4f4f4]" />
            <span>or</span>
            <div className="h-px flex-1 bg-[#f4f4f4]" />
          </div>
          <form action={signInWithGoogleAction}>
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <Button type="submit" variant="secondary" fullWidth>
              <span className="inline-flex items-center gap-2.5">
                <GoogleIcon className="size-3.5" />
                <span>Continue with Google</span>
              </span>
            </Button>
          </form>
        </Surface>
      </div>
      <p className="mt-8 w-full max-w-md shrink-0 pb-12 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
