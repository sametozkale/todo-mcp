"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  FieldError,
  Input,
  Label,
  Surface,
  TextField,
} from "@heroui/react";
import { signupAction, type AuthActionState } from "@/app/(auth)/actions";

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, null as AuthActionState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
    if (!state?.fields) return;
    if (typeof state.fields.name === "string") setName(state.fields.name);
    if (typeof state.fields.email === "string") setEmail(state.fields.email);
  }, [state?.fields]);

  const handleSubmit = () => {
    submitCounterRef.current += 1;
    lastSubmitEditCounterRef.current = editCounter;
  };

  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <div className="flex w-full max-w-md flex-1 flex-col justify-center">
        <Surface
          variant="tertiary"
          className="w-full rounded-[32px] border border-[#f4f4f4] !bg-white p-8 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)]"
        >
          <form action={formAction} className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <h1 className="font-title text-xl font-semibold text-foreground">Create account</h1>
              <p className="text-sm text-muted">Get started with Yalp in a few quick fields.</p>
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
              type="password"
              isRequired
              isInvalid={!!state?.fieldErrors?.password}
              onChange={(v) => {
                setPassword(String(v));
                setEditCounter((c) => c + 1);
              }}
            >
              <Label>Password</Label>
              <Input placeholder="At least 8 characters" fullWidth value={password} />
              {state?.fieldErrors?.password ? (
                <FieldError>{state.fieldErrors.password}</FieldError>
              ) : (
                <FieldError />
              )}
            </TextField>
            <TextField
              name="confirmPassword"
              type="password"
              isRequired
              isInvalid={!!state?.fieldErrors?.confirmPassword}
              onChange={(v) => {
                setConfirmPassword(String(v));
                setEditCounter((c) => c + 1);
              }}
            >
              <Label>Confirm password</Label>
              <Input placeholder="Re-enter your password" fullWidth value={confirmPassword} />
              {state?.fieldErrors?.confirmPassword ? (
                <FieldError>{state.fieldErrors.confirmPassword}</FieldError>
              ) : (
                <FieldError />
              )}
            </TextField>
            <Button type="submit" variant="primary" fullWidth isDisabled={isPending}>
              {isPending ? "Creating account…" : "Sign up"}
            </Button>
          </form>
        </Surface>
      </div>
      <p className="w-full max-w-md shrink-0 pb-12 text-center text-sm text-muted">
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
