import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMemberBySlug } from "./lib/authz";
import { DAY_MS, openSlots, type Span } from "./lib/slots";

// Open appointment slots for a specific staff member, or the merged set across
// all bookable staff when staffId is "any". Reactive to bookings — a booked slot
// disappears immediately. `fromMs` is passed in (queries can't read the clock).

async function busyFor(
  ctx: QueryCtx,
  staffId: Id<"staff">,
  fromMs: number,
  toMs: number,
): Promise<Span[]> {
  const rows = await ctx.db
    .query("bookings")
    .withIndex("by_staff_start", (q) =>
      q.eq("staffId", staffId).gte("start", fromMs - DAY_MS).lt("start", toMs),
    )
    .collect();
  const bookings = rows
    .filter((b) => b.status === "confirmed")
    .map((b) => ({ start: b.start, end: b.end }));

  // Google Calendar busy times block slots too.
  const gbusy = await ctx.db
    .query("googleBusy")
    .withIndex("by_staff_start", (q) =>
      q.eq("staffId", staffId).gte("start", fromMs - DAY_MS).lt("start", toMs),
    )
    .collect();

  return [...bookings, ...gbusy.map((g) => ({ start: g.start, end: g.end }))];
}

export const getSlots = query({
  args: {
    slug: v.string(),
    staffId: v.union(v.id("staff"), v.literal("any")),
    fromMs: v.number(),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    const { business } = await requireMemberBySlug(ctx, args.slug);
    const toMs = args.fromMs + Math.min(args.days, 60) * DAY_MS;

    let staffList: Doc<"staff">[];
    if (args.staffId === "any") {
      staffList = (
        await ctx.db
          .query("staff")
          .withIndex("by_business_active", (q) =>
            q.eq("businessId", business._id).eq("active", true),
          )
          .collect()
      ).filter((s) => s.bookable);
    } else {
      const s = await ctx.db.get(args.staffId);
      staffList = s && s.businessId === business._id ? [s] : [];
    }

    const merged = new Map<number, { end: number; staffId: Id<"staff"> }>();

    for (const s of staffList) {
      const rule = await ctx.db
        .query("availabilityRules")
        .withIndex("by_staff", (q) => q.eq("staffId", s._id))
        .unique();
      if (!rule) continue;
      const busy = await busyFor(ctx, s._id, args.fromMs, toMs);
      const dur = rule.slotMinutes * 60_000;
      for (const start of openSlots(rule, busy, args.fromMs, toMs)) {
        // "any": first staff to offer a start time wins the slot.
        if (!merged.has(start)) merged.set(start, { end: start + dur, staffId: s._id });
      }
    }

    return Array.from(merged.entries())
      .map(([start, { end, staffId }]) => ({ start, end, staffId }))
      .sort((a, b) => a.start - b.start);
  },
});
