"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Logo } from "@/components/layout/logo";

export default function ForgotPasswordPage() {
  const requestReset = useAction(api.passwordReset.requestReset);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    try {
      await requestReset({ email });
    } catch {
      // Swallow — never reveal whether an account exists.
    } finally {
      // Neutral confirmation either way (no account enumeration).
      setSent(true);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Logo />

        {sent ? (
          <>
            <h1 className="mt-10 font-display text-3xl text-bone">Check your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              If that email is registered, a reset link is on its way. It expires in
              30 minutes.
            </p>
            <Link
              href="/signin"
              className="mt-8 inline-block text-sm text-muted transition-colors hover:text-bone"
            >
              ← Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-10 font-display text-3xl text-bone">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-muted">
              Enter your email and we&rsquo;ll send you a link to set a new password.
            </p>

            <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@business.com"
                className="h-12 rounded-lg border border-line-strong bg-surface px-4 text-sm text-bone placeholder:text-faint focus-visible:border-ember"
              />
              {error && <p className="text-sm text-ember-deep">{error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="mt-1 inline-flex h-12 items-center justify-center rounded-full bg-ember font-medium text-[#160b04] transition-colors hover:bg-flare disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <Link
              href="/signin"
              className="mt-6 inline-block text-sm text-muted transition-colors hover:text-bone"
            >
              ← Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
