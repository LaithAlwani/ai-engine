// -----------------------------------------------------------------------------
// Pure slot math. Availability is stored as minutes-from-midnight in a staff's
// timezone; bookings are UTC. These helpers bridge the two (DST-aware via Intl)
// so slot generation and booking validation agree. No Convex imports — usable
// from both queries and mutations.
// -----------------------------------------------------------------------------

export type Interval = { start: number; end: number };
export type Week = { intervals: Interval[] }[];
export type AvailabilityRule = {
  timezone: string;
  slotMinutes: number;
  week: Week;
};
export type Span = { start: number; end: number };

export const DAY_MS = 86_400_000;

/** Minutes east of UTC for `tz` at the instant `utcMs`. */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const m: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") m[p.type] = Number(p.value);
  }
  const hour = m.hour === 24 ? 0 : m.hour;
  const asUTC = Date.UTC(m.year, m.month - 1, m.day, hour, m.minute, m.second);
  return Math.round((asUTC - utcMs) / 60_000);
}

/** UTC ms for a wall-clock time (minutes-from-midnight on y/mo/d) in `tz`. */
export function wallToUtc(
  y: number,
  mo: number,
  d: number,
  minutes: number,
  tz: string,
): number {
  const h = Math.floor(minutes / 60);
  const mi = minutes % 60;
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const off = tzOffsetMinutes(guess, tz);
    const corrected = naive - off * 60_000;
    if (corrected === guess) break;
    guess = corrected;
  }
  return guess;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The local calendar date + weekday index for a UTC instant in `tz`. */
export function localDate(utcMs: number, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) m[p.type] = p.value;
  return {
    y: Number(m.year),
    mo: Number(m.month),
    d: Number(m.day),
    dow: WD.indexOf(m.weekday),
  };
}

function overlaps(aStart: number, aEnd: number, spans: Span[]): boolean {
  return spans.some((s) => s.start < aEnd && aStart < s.end);
}

/**
 * Open slot start times (UTC ms) for a staff in [fromMs, toMs), excluding times
 * that overlap a busy span. Only slots at or after fromMs.
 */
export function openSlots(
  rule: AvailabilityRule,
  busy: Span[],
  fromMs: number,
  toMs: number,
): number[] {
  const dur = rule.slotMinutes * 60_000;
  const out = new Set<number>();

  // Walk each local day the window can touch (±1 to catch timezone edges).
  for (let cursor = fromMs - DAY_MS; cursor < toMs + DAY_MS; cursor += DAY_MS) {
    const { y, mo, d, dow } = localDate(cursor, rule.timezone);
    const day = rule.week[dow];
    if (!day) continue;
    for (const iv of day.intervals) {
      for (let t = iv.start; t + rule.slotMinutes <= iv.end; t += rule.slotMinutes) {
        const start = wallToUtc(y, mo, d, t, rule.timezone);
        if (start < fromMs || start >= toMs) continue;
        if (!overlaps(start, start + dur, busy)) out.add(start);
      }
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

/** Is `startUtc` a valid, unbooked slot for this staff? (booking-time guard) */
export function isOpenSlot(
  rule: AvailabilityRule,
  busy: Span[],
  startUtc: number,
): boolean {
  const { y, mo, d, dow } = localDate(startUtc, rule.timezone);
  const day = rule.week[dow];
  if (!day) return false;

  const midnight = wallToUtc(y, mo, d, 0, rule.timezone);
  const localMin = Math.round((startUtc - midnight) / 60_000);
  const fits = day.intervals.some(
    (iv) =>
      localMin >= iv.start &&
      localMin + rule.slotMinutes <= iv.end &&
      (localMin - iv.start) % rule.slotMinutes === 0,
  );
  if (!fits) return false;
  return !overlaps(startUtc, startUtc + rule.slotMinutes * 60_000, busy);
}
