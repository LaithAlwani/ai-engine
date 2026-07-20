"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorText } from "@/lib/errors";
import {
  useBusiness,
  isManagerRole,
} from "@/components/dashboard/business-context";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_OPTIONS = [15, 30, 45, 60, 90];

type Interval = { start: number; end: number };
type Week = { intervals: Interval[] }[];

function emptyWeek(): Week {
  return Array.from({ length: 7 }, () => ({ intervals: [] }));
}
function defaultWeekdays(): Week {
  // Mon–Fri 9:00–17:00 as a friendly starting point.
  return Array.from({ length: 7 }, (_, d) => ({
    intervals: d >= 1 && d <= 5 ? [{ start: 540, end: 1020 }] : [],
  }));
}

function toTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const browserTz =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

export default function SchedulePage() {
  const b = useBusiness();
  const canEdit = isManagerRole(b.role);
  const staff = useQuery(api.staff.list, { slug: b.slug });
  const [selected, setSelected] = useState<Id<"staff"> | null>(null);

  const current = staff?.find((s) => s._id === selected) ?? staff?.[0];
  const staffId = current?._id ?? null;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl text-bone">Schedule</h1>
      <p className="mt-1 text-sm text-muted">
        Weekly availability per staff member. The assistant offers open slots
        from these hours.
      </p>

      {staff === undefined ? (
        <p className="mt-6 text-sm text-faint">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="mt-6 text-sm text-faint">
          Add staff on the Team page first.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {staff.map((s) => (
              <button
                key={s._id}
                onClick={() => setSelected(s._id)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  s._id === staffId
                    ? "border-ember bg-ember-soft text-bone"
                    : "border-line text-bone-dim hover:border-line-strong"
                }`}
              >
                {s.name}
                {!s.bookable && (
                  <span className="ml-1.5 text-xs text-faint">· not bookable</span>
                )}
              </button>
            ))}
          </div>

          {staffId && (
            <AvailabilityEditor
              key={staffId}
              slug={b.slug}
              staffId={staffId}
              canEdit={canEdit}
            />
          )}
        </>
      )}
    </div>
  );
}

function AvailabilityEditor({
  slug,
  staffId,
  canEdit,
}: {
  slug: string;
  staffId: Id<"staff">;
  canEdit: boolean;
}) {
  const stored = useQuery(api.availability.get, { slug, staffId });
  const save = useMutation(api.availability.update);

  const [tz, setTz] = useState<string | null>(null);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [week, setWeek] = useState<Week | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from the loaded rule (once).
  if (week === null && stored !== undefined) {
    if (stored) {
      setTz(stored.timezone);
      setSlotMinutes(stored.slotMinutes);
      setWeek(stored.week);
    } else {
      setTz(browserTz);
      setWeek(defaultWeekdays());
    }
  }

  if (!week || tz === null) {
    return <p className="mt-6 text-sm text-faint">Loading…</p>;
  }

  function setDay(d: number, intervals: Interval[]) {
    setWeek((w) => (w ? w.map((x, i) => (i === d ? { intervals } : x)) : w));
    setSaved(false);
  }

  async function onSave() {
    if (!week) return;
    setError(null);
    setPending(true);
    try {
      await save({
        slug,
        staffId,
        availability: { timezone: tz!, slotMinutes, week },
      });
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      <GoogleCalendar slug={slug} staffId={staffId} />

      <p className="mb-2 text-sm text-bone-dim">Weekly hours</p>
      <fieldset disabled={!canEdit || pending} className="space-y-2">
        {DAYS.map((label, d) => (
          <div
            key={d}
            className="flex flex-wrap items-start gap-3 rounded-lg border border-line px-4 py-3"
          >
            <span className="w-10 shrink-0 pt-1.5 text-sm text-bone-dim">
              {label}
            </span>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {week[d].intervals.length === 0 && (
                <span className="py-1.5 text-sm text-faint">Closed</span>
              )}
              {week[d].intervals.map((iv, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={toTime(iv.start)}
                    onChange={(e) =>
                      setDay(
                        d,
                        week[d].intervals.map((x, j) =>
                          j === i ? { ...x, start: toMins(e.target.value) } : x,
                        ),
                      )
                    }
                    className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-bone focus-visible:border-ember"
                  />
                  <span className="text-faint">–</span>
                  <input
                    type="time"
                    value={toTime(iv.end)}
                    onChange={(e) =>
                      setDay(
                        d,
                        week[d].intervals.map((x, j) =>
                          j === i ? { ...x, end: toMins(e.target.value) } : x,
                        ),
                      )
                    }
                    className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-bone focus-visible:border-ember"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDay(
                        d,
                        week[d].intervals.filter((_, j) => j !== i),
                      )
                    }
                    aria-label="Remove"
                    className="grid h-8 w-8 place-items-center text-muted hover:text-ember-deep"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setDay(d, [
                    ...week[d].intervals,
                    { start: 540, end: 1020 },
                  ])
                }
                className="rounded-full border border-line-strong px-3 py-1 text-xs text-bone-dim hover:border-ember/50 hover:text-bone"
              >
                + Add hours
              </button>
            </div>
          </div>
        ))}
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-bone-dim">
          Slot length
          <select
            disabled={!canEdit}
            value={slotMinutes}
            onChange={(e) => {
              setSlotMinutes(Number(e.target.value));
              setSaved(false);
            }}
            className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-bone"
          >
            {SLOT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-bone-dim">
          Timezone
          <input
            disabled={!canEdit}
            value={tz}
            onChange={(e) => {
              setTz(e.target.value);
              setSaved(false);
            }}
            className="h-9 w-56 rounded-lg border border-line-strong bg-surface px-2 font-mono text-xs text-bone"
          />
        </label>
      </div>

      {canEdit && (
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={pending}
            className="h-11 rounded-full bg-ember px-6 text-sm font-medium text-[#160b04] transition-colors hover:bg-flare disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save availability"}
          </button>
          {saved && <span className="text-sm text-flare">Saved ✓</span>}
          {error && <span className="text-sm text-ember-deep">{error}</span>}
        </div>
      )}
    </div>
  );
}

function GoogleCalendar({
  slug,
  staffId,
}: {
  slug: string;
  staffId: Id<"staff">;
}) {
  const status = useQuery(api.google.status, { slug, staffId });
  const getAuthUrl = useAction(api.google.getAuthUrl);
  const disconnect = useAction(api.google.disconnect);
  const sync = useAction(api.google.syncBusy);
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect">(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  async function connect() {
    setError(null);
    setBusy("connect");
    try {
      const { url } = await getAuthUrl({ slug, staffId });
      window.location.href = url;
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  async function run(
    kind: "sync" | "disconnect",
    fn: () => Promise<unknown>,
  ) {
    setError(null);
    setBusy(kind);
    setSynced(false);
    try {
      await fn();
      if (kind === "sync") setSynced(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-line bg-surface/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-bone">Google Calendar</p>
          <p className="mt-0.5 text-xs text-faint">
            {status === undefined
              ? "…"
              : status.connected
                ? `Connected${status.email ? ` · ${status.email}` : ""} — busy times block slots.`
                : "Not connected — external events won't block slots yet."}
          </p>
        </div>
        {status !== undefined && !status.canManage && !status.connected && (
          <span className="text-xs text-faint">
            {status.hasLogin
              ? "This employee connects their own calendar."
              : "An owner connects this calendar."}
          </span>
        )}
        {status !== undefined && status.canManage && (
          <div className="flex items-center gap-2">
            {status.connected ? (
              <>
                <button
                  onClick={() => run("sync", () => sync({ slug, staffId }))}
                  disabled={busy !== null}
                  className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-bone-dim transition-colors hover:border-ember/50 hover:text-bone disabled:opacity-50"
                >
                  {busy === "sync" ? "Syncing…" : synced ? "Synced ✓" : "Sync now"}
                </button>
                <button
                  onClick={() =>
                    run("disconnect", () => disconnect({ slug, staffId }))
                  }
                  disabled={busy !== null}
                  className="text-sm text-muted transition-colors hover:text-ember-deep disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={connect}
                disabled={busy !== null}
                className="rounded-full bg-ember px-4 py-1.5 text-sm font-medium text-[#160b04] transition-colors hover:bg-flare disabled:opacity-60"
              >
                {busy === "connect" ? "Redirecting…" : "Connect Google Calendar"}
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-ember-deep">{error}</p>}
    </div>
  );
}
