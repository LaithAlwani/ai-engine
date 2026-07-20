import { v } from "convex/values";
import {
  action,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireMemberBySlug, isManager } from "./lib/authz";
import { appError } from "./lib/errors";
import { randomHex } from "./lib/keys";
import { DAY_MS, isOpenSlot, type Span } from "./lib/slots";

// -----------------------------------------------------------------------------
// Booking engine. `book` (action) mints a cancel token, then `create` (a single
// transaction) assigns a staff member if needed, re-validates the slot against
// live bookings, and inserts — so two racing bookings can't take the same slot.
// -----------------------------------------------------------------------------

const customerArgs = {
  customerName: v.string(),
  customerEmail: v.string(),
  customerPhone: v.optional(v.string()),
  note: v.optional(v.string()),
};

async function ruleAndBusy(
  ctx: MutationCtx,
  staffId: Id<"staff">,
  start: number,
  excludeId?: Id<"bookings">,
): Promise<{ rule: Doc<"availabilityRules"> | null; busy: Span[] }> {
  const rule = await ctx.db
    .query("availabilityRules")
    .withIndex("by_staff", (q) => q.eq("staffId", staffId))
    .unique();
  const rows = await ctx.db
    .query("bookings")
    .withIndex("by_staff_start", (q) =>
      q.eq("staffId", staffId).gte("start", start - DAY_MS).lt("start", start + DAY_MS),
    )
    .collect();
  const busy = rows
    .filter((b) => b.status === "confirmed" && b._id !== excludeId)
    .map((b) => ({ start: b.start, end: b.end }));
  return { rule, busy };
}

/**
 * Employee visibility: managers (owner/admin) see all bookings; a `staff` member
 * sees only bookings for the staff row(s) linked to their account. Enforced
 * server-side in every booking read/write.
 */
async function bookingScope(ctx: QueryCtx, slug: string) {
  const { business, userId, membership } = await requireMemberBySlug(ctx, slug);
  const manager = isManager(membership.role);
  let allowed: Set<string> | null = null;
  if (!manager) {
    const mine = await ctx.db
      .query("staff")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    allowed = new Set(
      mine.filter((s) => s.businessId === business._id).map((s) => s._id),
    );
  }
  return { business, manager, allowed };
}

function canManageBooking(
  manager: boolean,
  allowed: Set<string> | null,
  staffId: Id<"staff">,
) {
  return manager || (allowed?.has(staffId) ?? false);
}

/** Round-robin / least-busy pick among staff who are free at `start`. */
async function assignStaff(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  start: number,
): Promise<{ staffId: Id<"staff">; rule: Doc<"availabilityRules"> } | null> {
  const staff = (
    await ctx.db
      .query("staff")
      .withIndex("by_business_active", (q) =>
        q.eq("businessId", businessId).eq("active", true),
      )
      .collect()
  ).filter((s) => s.bookable);

  const candidates: {
    staffId: Id<"staff">;
    rule: Doc<"availabilityRules">;
    load: number;
  }[] = [];

  for (const s of staff) {
    const { rule, busy } = await ruleAndBusy(ctx, s._id, start);
    if (!rule || !isOpenSlot(rule, busy, start)) continue;
    candidates.push({ staffId: s._id, rule, load: busy.length });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.load - b.load);
  return { staffId: candidates[0].staffId, rule: candidates[0].rule };
}

export const create = internalMutation({
  args: {
    slug: v.string(),
    staffId: v.union(v.id("staff"), v.literal("any")),
    start: v.number(),
    source: v.union(
      v.literal("dashboard"),
      v.literal("assistant"),
      v.literal("widget"),
    ),
    cancelToken: v.string(),
    ...customerArgs,
  },
  returns: v.object({
    bookingId: v.id("bookings"),
    staffId: v.id("staff"),
    start: v.number(),
    end: v.number(),
  }),
  handler: async (ctx, args) => {
    const { business } = await requireMemberBySlug(ctx, args.slug);

    let staffId: Id<"staff">;
    let rule: Doc<"availabilityRules">;

    if (args.staffId === "any") {
      const picked = await assignStaff(ctx, business._id, args.start);
      if (!picked) {
        appError("CONFLICT", "No one is available at that time.");
      }
      staffId = picked.staffId;
      rule = picked.rule;
    } else {
      const staff = await ctx.db.get(args.staffId);
      if (!staff || staff.businessId !== business._id) {
        appError("NOT_FOUND", "That staff member no longer exists.");
      }
      if (!staff.bookable || !staff.active) {
        appError("CONFLICT", "That staff member isn't bookable.");
      }
      const { rule: r, busy } = await ruleAndBusy(ctx, staff._id, args.start);
      if (!r) appError("CONFLICT", "That staff member has no availability set.");
      // Double-booking safety: re-check against live bookings inside the txn.
      if (!isOpenSlot(r, busy, args.start)) {
        appError("CONFLICT", "That time isn't available — it may have just been taken.");
      }
      staffId = staff._id;
      rule = r;
    }

    const end = args.start + rule.slotMinutes * 60_000;
    const bookingId = await ctx.db.insert("bookings", {
      businessId: business._id,
      staffId,
      start: args.start,
      end,
      status: "confirmed",
      customerName: args.customerName.trim(),
      customerEmail: args.customerEmail.trim(),
      customerPhone: args.customerPhone?.trim() || undefined,
      note: args.note?.trim() || undefined,
      cancelToken: args.cancelToken,
      source: args.source,
    });

    return { bookingId, staffId, start: args.start, end };
  },
});

export const book = action({
  args: {
    slug: v.string(),
    staffId: v.union(v.id("staff"), v.literal("any")),
    start: v.number(),
    source: v.optional(
      v.union(
        v.literal("dashboard"),
        v.literal("assistant"),
        v.literal("widget"),
      ),
    ),
    ...customerArgs,
  },
  returns: v.object({
    bookingId: v.id("bookings"),
    staffId: v.id("staff"),
    start: v.number(),
    end: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    bookingId: Id<"bookings">;
    staffId: Id<"staff">;
    start: number;
    end: number;
  }> => {
    const cancelToken = randomHex(16);
    return await ctx.runMutation(internal.bookings.create, {
      slug: args.slug,
      staffId: args.staffId,
      start: args.start,
      source: args.source ?? "dashboard",
      cancelToken,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      note: args.note,
    });
  },
});

/** Upcoming confirmed bookings visible to the caller (role-scoped). */
export const listUpcoming = query({
  args: { slug: v.string(), fromMs: v.number() },
  handler: async (ctx, args) => {
    const { business, manager, allowed } = await bookingScope(ctx, args.slug);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_business_start", (q) =>
        q.eq("businessId", business._id).gte("start", args.fromMs),
      )
      .collect();

    return Promise.all(
      rows
        .filter(
          (b) =>
            b.status === "confirmed" &&
            canManageBooking(manager, allowed, b.staffId),
        )
        .sort((a, b) => a.start - b.start)
        .map(async (b) => {
          const staff = await ctx.db.get(b.staffId);
          return {
            _id: b._id,
            staffId: b.staffId,
            start: b.start,
            end: b.end,
            staffName: staff?.name ?? "—",
            customerName: b.customerName,
            customerEmail: b.customerEmail,
            customerPhone: b.customerPhone ?? null,
          };
        }),
    );
  },
});

export const cancel = mutation({
  args: { slug: v.string(), bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { business, manager, allowed } = await bookingScope(ctx, args.slug);
    const bk = await ctx.db.get(args.bookingId);
    if (!bk || bk.businessId !== business._id) {
      appError("NOT_FOUND", "That booking no longer exists.");
    }
    if (!canManageBooking(manager, allowed, bk.staffId)) {
      appError("FORBIDDEN", "You can only manage your own bookings.");
    }
    await ctx.db.patch(args.bookingId, { status: "cancelled" });
    return null;
  },
});

export const reschedule = mutation({
  args: {
    slug: v.string(),
    bookingId: v.id("bookings"),
    newStart: v.number(),
  },
  returns: v.object({ start: v.number(), end: v.number() }),
  handler: async (ctx, args) => {
    const { business, manager, allowed } = await bookingScope(ctx, args.slug);
    const bk = await ctx.db.get(args.bookingId);
    if (!bk || bk.businessId !== business._id) {
      appError("NOT_FOUND", "That booking no longer exists.");
    }
    if (bk.status !== "confirmed") {
      appError("CONFLICT", "This booking isn't active.");
    }
    if (!canManageBooking(manager, allowed, bk.staffId)) {
      appError("FORBIDDEN", "You can only manage your own bookings.");
    }

    // Validate the new slot for the same staff, excluding this booking itself.
    const { rule, busy } = await ruleAndBusy(ctx, bk.staffId, args.newStart, bk._id);
    if (!rule) appError("CONFLICT", "That staff member has no availability set.");
    if (!isOpenSlot(rule, busy, args.newStart)) {
      appError("CONFLICT", "That time isn't available — it may have just been taken.");
    }

    const end = args.newStart + rule.slotMinutes * 60_000;
    await ctx.db.patch(bk._id, { start: args.newStart, end });
    return { start: args.newStart, end };
  },
});
