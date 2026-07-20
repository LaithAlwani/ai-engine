"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { errorText } from "@/lib/errors";
import { Logo } from "@/components/layout/logo";

function ResetForm() {
  const { signIn } = useAuthActions();
  const resetPassword = useAction(api.passwordReset.resetPassword);
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const linkValid = token !== "";

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setPending(true);
    try {
      const { email } = await resetPassword({ token, newPassword });
      // Password changed — sign the user straight in with it.
      await signIn("password", { email, password: newPassword, flow: "signIn" });
      router.push("/dashboard");
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  }

  if (!linkValid) {
    return (
      <>
        <h1 className="mt-10 font-display text-3xl text-bone">Invalid link</h1>
        <p className="mt-2 text-sm text-muted">
          This password reset link is incomplete or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="mt-8 inline-block text-sm text-ember transition-colors hover:text-flare"
        >
          Request a new link →
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-10 font-display text-3xl text-bone">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter a new password for your account. You&rsquo;ll be signed in right after.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password"
          className="h-12 rounded-lg border border-line-strong bg-surface px-4 text-sm text-bone placeholder:text-faint focus-visible:border-ember"
        />
        <input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Confirm new password"
          className="h-12 rounded-lg border border-line-strong bg-surface px-4 text-sm text-bone placeholder:text-faint focus-visible:border-ember"
        />
        {error && <p className="text-sm text-ember-deep">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 inline-flex h-12 items-center justify-center rounded-full bg-ember font-medium text-[#160b04] transition-colors hover:bg-flare disabled:opacity-60"
        >
          {pending ? "Saving…" : "Set new password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Logo />
        <Suspense fallback={<p className="mt-10 text-sm text-faint">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
