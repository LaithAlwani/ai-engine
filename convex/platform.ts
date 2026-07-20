import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requirePlatformAdmin } from "./lib/authz";
import { appError } from "./lib/errors";

// -----------------------------------------------------------------------------
// Platform plane — cross-tenant, operators only. Every read starts with
// requirePlatformAdmin; this is the only place cross-tenant reads are allowed.
// -----------------------------------------------------------------------------

/**
 * Seed the first operator. Chicken-and-egg: the first platform admin can't be
 * created by a platform admin, so this is an INTERNAL mutation run once from the
 * CLI after the owner signs up:
 *   npx convex run platform:seedAdmin '{"email":"you@domain.com"}'
 */
export const seedAdmin = internalMutation({
  args: {
    email: v.string(),
    role: v.optional(v.union(v.literal("support"), v.literal("superadmin"))),
  },
  returns: v.id("platformAdmins"),
  handler: async (ctx, args) => {
    const role = args.role ?? "superadmin";
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) {
      appError("NOT_FOUND", `No user with email ${args.email} — sign up first.`);
    }

    const existing = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { role });
      return existing._id;
    }
    return await ctx.db.insert("platformAdmins", {
      userId: user._id,
      role,
      createdAt: Date.now(),
    });
  },
});

/** Every business on the platform — the support-portal index. */
export const listBusinesses = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    return await ctx.db.query("businesses").collect();
  },
});
