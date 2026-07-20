import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// -----------------------------------------------------------------------------
// AI Engine — multi-tenant schema, partitioned by businessId from row zero.
// Phase 0 defines the tenancy core + Convex-Auth-managed tables. Each domain
// tool (booking, leads, knowledge, …) adds its own tables in its own phase,
// always carrying a required `businessId` (+ `staffId` where relevant).
// -----------------------------------------------------------------------------

export const roleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("staff"),
);

export const tierValidator = v.union(
  v.literal("starter"),
  v.literal("professional"),
  v.literal("enterprise"),
);

export default defineSchema({
  // Convex Auth managed tables (users, authAccounts, authSessions, …).
  ...authTables,

  // A tenant. Every domain row points back here via `businessId`.
  businesses: defineTable({
    slug: v.string(), // unique, URL-safe
    name: v.string(),
    status: v.union(
      v.literal("trial"),
      v.literal("active"),
      v.literal("suspended"),
    ),
    tier: tierValidator,
    // Widget security: origin allow-list + hashed embed key (never stored raw).
    domains: v.array(v.string()),
    embedKeyHash: v.string(),
    embedKeyPrefix: v.string(), // fast lookup; the secret half is hashed
    branding: v.object({
      logoStorageId: v.optional(v.id("_storage")),
      primaryColor: v.string(),
      accentColor: v.string(),
      chatIcon: v.optional(v.string()),
      position: v.union(v.literal("left"), v.literal("right")),
      assistantName: v.string(),
      welcomeMsg: v.string(),
      tone: v.string(),
    }),
    aiSettings: v.object({
      persona: v.string(),
      model: v.optional(v.string()),
      guardrails: v.optional(v.string()),
    }),
    templateId: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_embedKeyPrefix", ["embedKeyPrefix"]),

  // A user's role within a business. A user may belong to many businesses.
  // owner/admin = manager (sees all staff); staff = employee (sees own).
  memberships: defineTable({
    userId: v.id("users"),
    businessId: v.id("businesses"),
    role: roleValidator,
  })
    .index("by_user", ["userId"])
    .index("by_business", ["businessId"])
    .index("by_user_business", ["userId", "businessId"]),

  // A bookable resource. `userId` optional — a login-less staff member is a
  // manager-managed calendar with no account.
  staff: defineTable({
    businessId: v.id("businesses"),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.optional(v.string()),
    title: v.optional(v.string()),
    bookable: v.boolean(),
    serviceIds: v.optional(v.array(v.string())),
    active: v.boolean(),
    order: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_active", ["businessId", "active"])
    .index("by_user", ["userId"]),

  // Operators allowed into the cross-tenant support portal. Kept tiny.
  platformAdmins: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("support"), v.literal("superadmin")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Audit trail for platform-admin cross-tenant actions + sensitive business ops.
  auditLog: defineTable({
    actorUserId: v.id("users"),
    scope: v.union(v.literal("platform"), v.literal("business")),
    businessId: v.optional(v.id("businesses")),
    action: v.string(),
    targetId: v.optional(v.string()),
    meta: v.optional(v.any()),
    ts: v.number(),
  })
    .index("by_business_ts", ["businessId", "ts"])
    .index("by_actor_ts", ["actorUserId", "ts"]),
});
