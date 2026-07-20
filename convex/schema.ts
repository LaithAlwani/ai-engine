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
    embedKey: v.optional(v.string()), // full publishable key, revealed behind a password gate
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

  // Per-tenant business knowledge — the assistant's source of truth. One row
  // per business; edited in the dashboard, injected into the Leo system prompt.
  knowledge: defineTable({
    businessId: v.id("businesses"),
    about: v.string(),
    services: v.array(
      v.object({ name: v.string(), description: v.optional(v.string()) }),
    ),
    pricing: v.string(),
    hours: v.string(),
    locations: v.array(
      v.object({
        name: v.optional(v.string()),
        address: v.string(),
        phone: v.optional(v.string()),
      }),
    ),
    faq: v.array(v.object({ q: v.string(), a: v.string() })),
    policies: v.string(),
  }).index("by_business", ["businessId"]),

  // Single-use, hashed password-reset tokens (custom flow so the reset LINK
  // works cross-device — the built-in flow binds the code to the requesting
  // browser via a verifier, which an email link can't carry).
  passwordResetTokens: defineTable({
    userId: v.id("users"),
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_user", ["userId"]),

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
