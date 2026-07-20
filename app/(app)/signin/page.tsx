"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Logo } from "@/components/layout/logo";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signUp");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
      router.push("/dashboard");
    } catch {
      setError(
        flow === "signUp"
          ? "Couldn't create the account — try a different email."
          : "Wrong email or password.",
      );
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Logo />

        <h1 className="mt-10 font-display text-3xl text-bone">
          {flow === "signUp" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {flow === "signUp"
            ? "Start building your AI assistant in minutes."
            : "Sign in to your AI Engine dashboard."}
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
          <input
            name="password"
            type="password"
            required
            autoComplete={flow === "signUp" ? "new-password" : "current-password"}
            placeholder="Password"
            className="h-12 rounded-lg border border-line-strong bg-surface px-4 text-sm text-bone placeholder:text-faint focus-visible:border-ember"
          />

          {error && <p className="text-sm text-ember-deep">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex h-12 items-center justify-center rounded-full bg-ember font-medium text-[#160b04] transition-colors hover:bg-flare disabled:opacity-60"
          >
            {pending
              ? "One moment…"
              : flow === "signUp"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => {
            setFlow(flow === "signUp" ? "signIn" : "signUp");
            setError(null);
          }}
          className="mt-6 text-sm text-muted transition-colors hover:text-bone"
        >
          {flow === "signUp"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
