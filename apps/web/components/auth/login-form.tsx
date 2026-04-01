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
  toast,
} from "@heroui/react";
import { loginAction, signInWithGoogleAction, type AuthActionState } from "@/app/(auth)/actions";

type LoginFormProps = {
  searchParamsError?: string;
  /** Internal path after login (e.g. from ?next=). */
  nextPath?: string;
};

export function LoginForm({ searchParamsError, nextPath }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, null as AuthActionState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [editCounter, setEditCounter] = useState(0);
  const lastSubmitEditCounterRef = useRef(0);

  useEffect(() => {
    if (typeof state?.fields?.email === "string") setEmail(state.fields.email);
  }, [state?.fields?.email]);

  const callbackMessage =
    searchParamsError === "auth"
      ? "Could not complete sign-in. Please try again."
      : undefined;

  const visibleError = useMemo(() => {
    const editedSinceSubmit = editCounter !== lastSubmitEditCounterRef.current;
    if (editedSinceSubmit) return undefined;
    return state?.error ?? callbackMessage;
  }, [state?.error, callbackMessage, editCounter]);

  useEffect(() => {
    if (!visibleError) return;
    toast.danger(visibleError, { timeout: 4500 });
  }, [visibleError]);

  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <div className="flex w-full max-w-md flex-1 flex-col justify-center">
        <Surface
          variant="tertiary"
          className="w-full rounded-[32px] border border-[#f4f4f4] !bg-white p-8 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)]"
        >
          <form
            action={formAction}
            className="flex flex-col gap-6"
            onSubmit={() => {
              lastSubmitEditCounterRef.current = editCounter;
            }}
          >
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <div className="space-y-2">
              <h1 className="font-title text-xl font-semibold text-foreground">Log in</h1>
              <p className="text-sm text-muted">Enter your details to continue to your account.</p>
            </div>
            {visibleError && (
              <p className="text-sm text-[color:var(--color-danger)]" role="alert">
                {visibleError}
              </p>
            )}
            <TextField
              name="email"
              type="email"
              isRequired
              onChange={(v) => {
                setEmail(String(v));
                setEditCounter((c) => c + 1);
              }}
            >
              <Label>Email</Label>
              <Input placeholder="you@example.com" fullWidth value={email} />
              <FieldError />
            </TextField>
            <TextField
              name="password"
              type="password"
              isRequired
              onChange={(v) => {
                setPassword(String(v));
                setEditCounter((c) => c + 1);
              }}
            >
              <Label>Password</Label>
              <Input placeholder="••••••••" fullWidth value={password} />
              <FieldError />
            </TextField>
            <Button type="submit" variant="primary" fullWidth isDisabled={isPending}>
              {isPending ? "Signing in…" : "Log in"}
            </Button>
          </form>
          <div className="mb-6 mt-6 flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-[#ececec]" />
            <span>or</span>
            <div className="h-px flex-1 bg-[#ececec]" />
          </div>
          <form action={signInWithGoogleAction}>
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <Button type="submit" variant="secondary" fullWidth>
              Continue with Google
            </Button>
          </form>
        </Surface>
      </div>
      <p className="w-full max-w-md shrink-0 pb-12 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
