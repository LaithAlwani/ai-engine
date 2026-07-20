import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireMemberBySlug } from "./lib/authz";

// Internal: the tenant data the assistant action needs to build its prompt.
// Membership-gated (dashboard test surface). The public widget will resolve the
// tenant by embed key instead, in the widget phase.
export const get = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const { business } = await requireMemberBySlug(ctx, args.slug);
    const knowledge = await ctx.db
      .query("knowledge")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .unique();
    return {
      name: business.name,
      branding: business.branding,
      aiSettings: business.aiSettings,
      knowledge,
    };
  },
});
