import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

// -----------------------------------------------------------------------------
// Authorization — the single place identity turns into permission. Every
// tenant-scoped function starts with one of these. Three planes, kept separate:
//   - requireMember       → dashboard (per-business membership)
//   - requirePlatformAdmin → cross-tenant support portal (operators only)
// (resolveTenantByKey for the public widget arrives with the widget phase.)
// -----------------------------------------------------------------------------

export type Role = Doc<"memberships">["role"];

// owner/admin are "managers"; staff is an "employee".
const RANK: Record<Role, number> = { staff: 1, admin: 2, owner: 3 };

async function currentUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/**
 * Require the caller to be a member of `businessId` at `minRole` or above.
 * Returns the caller's id + membership so handlers can branch on role.
 */
export async function requireMember(
  ctx: QueryCtx,
  businessId: Id<"businesses">,
  minRole: Role = "staff",
): Promise<{ userId: Id<"users">; membership: Doc<"memberships"> }> {
  const userId = await currentUserId(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_business", (q) =>
      q.eq("userId", userId).eq("businessId", businessId),
    )
    .unique();

  if (!membership) throw new Error("Not a member of this business");
  if (RANK[membership.role] < RANK[minRole]) {
    throw new Error(`Requires ${minRole} role or higher`);
  }
  return { userId, membership };
}

export const isManager = (role: Role) => RANK[role] >= RANK.admin;

/**
 * Require the caller to be a platform operator. `superadmin` gates assist/act-as;
 * `support` gates cross-tenant reads. This path bypasses tenant isolation, so
 * callers must audit every action.
 */
export async function requirePlatformAdmin(
  ctx: QueryCtx,
  minRole: Doc<"platformAdmins">["role"] = "support",
): Promise<{ userId: Id<"users">; admin: Doc<"platformAdmins"> }> {
  const userId = await currentUserId(ctx);
  const admin = await ctx.db
    .query("platformAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (!admin) throw new Error("Not a platform admin");
  if (minRole === "superadmin" && admin.role !== "superadmin") {
    throw new Error("Requires superadmin");
  }
  return { userId, admin };
}
