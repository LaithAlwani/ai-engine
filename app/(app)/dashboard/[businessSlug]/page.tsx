"use client";

import { useBusiness } from "@/components/dashboard/business-context";
import { WidgetKeyCard } from "@/components/dashboard/widget-key-card";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-xs uppercase tracking-wider text-bone-dim">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/50 p-5">
      <div className="font-display text-3xl text-bone">{value}</div>
      <div className="mt-1 font-mono text-xs uppercase tracking-wider text-faint">
        {label}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const b = useBusiness();

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-4xl text-bone">{b.name}</h1>
      <p className="mt-1 font-mono text-xs text-faint">/{b.slug}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Badge>{b.tier}</Badge>
        <Badge>{b.status}</Badge>
        <Badge>you: {b.role}</Badge>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Conversations" value="—" />
        <Stat label="Leads" value="—" />
        <Stat label="Bookings" value="—" />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        This is {b.name}&rsquo;s dashboard. Set up branding, add your team, and
        connect your knowledge from the sidebar — metrics light up here once your
        assistant goes live.
      </p>

      <div className="mt-8">
        <WidgetKeyCard />
      </div>
    </div>
  );
}
