"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Logo } from "@/components/layout/logo";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { BusinessProvider } from "@/components/dashboard/business-context";

export default function BusinessDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const businesses = useQuery(api.businesses.listMine);
  const router = useRouter();
  const { signOut } = useAuthActions();

  // Membership gate: `listMine` only returns businesses the caller belongs to,
  // so a slug we're not a member of simply isn't here → bounce to the picker.
  const current = businesses?.find((b) => b.slug === businessSlug);

  useEffect(() => {
    if (businesses !== undefined && !current) router.replace("/dashboard");
  }, [businesses, current, router]);

  if (businesses === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-faint">
        Loading…
      </div>
    );
  }
  if (!current) return null; // redirecting

  return (
    <BusinessProvider value={current}>
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-faint">/</span>
            <BusinessSwitcher currentSlug={businessSlug} />
          </div>
          <button
            onClick={() => void signOut()}
            className="text-sm text-muted transition-colors hover:text-bone"
          >
            Sign out
          </button>
        </header>

        <div className="flex flex-1">
          <aside className="w-56 shrink-0 border-r border-line p-4">
            <DashboardNav slug={businessSlug} />
          </aside>
          <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </BusinessProvider>
  );
}
