import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMemberBySlug } from "./lib/authz";
import { appError } from "./lib/errors";

// -----------------------------------------------------------------------------
// Per-staff weekly availability. Phase 2.2's slot generator reads these rules
// (minus existing bookings, and later minus Google-busy) to produce open slots.
// -----------------------------------------------------------------------------

export const availabilityValidator = v.object({
  timezone: v.string(),
  slotMinutes: v.number(),
  week: v.array(
    v.object({
      intervals: v.array(v.object({ start: v.number(), end: v.number() })),
    }),
  ),
});

/** The availability rule for one staff member (null if not set up yet). */
export const get = query({
  args: { slug: v.string(), staffId: v.id("staff") },
  handler: async (ctx, args) => {
    const { business } = await requireMemberBySlug(ctx, args.slug);
    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.businessId !== business._id) {
      appError("NOT_FOUND", "That staff member no longer exists.");
    }
    return await ctx.db
      .query("availabilityRules")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .unique();
  },
});

export const update = mutation({
  args: {
    slug: v.string(),
    staffId: v.id("staff"),
    availability: availabilityValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { business } = await requireMemberBySlug(ctx, args.slug, "admin");
    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.businessId !== business._id) {
      appError("NOT_FOUND", "That staff member no longer exists.");
    }

    // Basic sanity: 7 days, valid intervals.
    if (args.availability.week.length !== 7) {
      appError("INVALID_INPUT", "Availability must cover all 7 days.");
    }
    for (const day of args.availability.week) {
      for (const iv of day.intervals) {
        if (iv.start < 0 || iv.end > 1440 || iv.start >= iv.end) {
          appError("INVALID_INPUT", "Each time range must be valid and within a day.");
        }
      }
    }

    const existing = await ctx.db
      .query("availabilityRules")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args.availability);
    } else {
      await ctx.db.insert("availabilityRules", {
        businessId: business._id,
        staffId: args.staffId,
        ...args.availability,
      });
    }
    return null;
  },
});
