import { v } from "convex/values";
import {
  action,
  internalMutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireMember } from "./lib/authz";
import { tierValidator } from "./schema";

// -----------------------------------------------------------------------------
// Businesses — the tenant lifecycle. Onboarding is the ONE path in: create a
// business → owner membership → default calendar slot → hashed embed key.
// The first client comes through the same funnel as the hundredth.
// -----------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Create a business for the signed-in user (who becomes its owner). Generates
 * the embed key here (needs Web Crypto), then provisions rows in one mutation.
 * The full embed key is returned ONCE — only its hash is stored.
 */
export const create = action({
  args: {
    name: v.string(),
    slug: v.string(),
    tier: v.optional(tierValidator),
  },
  returns: v.object({
    businessId: v.id("businesses"),
    slug: v.string(),
    embedKey: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const slug = args.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      throw new Error(
        "Slug must be 2–40 chars: lowercase letters, numbers, and hyphens",
      );
    }

    // ek_<prefix>.<secret> — prefix is stored plaintext for lookup, secret hashed.
    const prefix = randomHex(6);
    const secret = randomHex(18);
    const embedKey = `ek_${prefix}.${secret}`;
    const embedKeyHash = await sha256Hex(secret);

    const businessId: import("./_generated/dataModel").Id<"businesses"> =
      await ctx.runMutation(internal.businesses.provision, {
        name: args.name.trim(),
        slug,
        tier: args.tier ?? "starter",
        embedKeyPrefix: prefix,
        embedKeyHash,
      });

    return { businessId, slug, embedKey };
  },
});

/** Internal: the transactional part of onboarding. Identity flows through ctx. */
export const provision = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    tier: tierValidator,
    embedKeyPrefix: v.string(),
    embedKeyHash: v.string(),
  },
  returns: v.id("businesses"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error(`Slug "${args.slug}" is taken`);

    const businessId = await ctx.db.insert("businesses", {
      name: args.name,
      slug: args.slug,
      status: "trial",
      tier: args.tier,
      domains: [],
      embedKeyPrefix: args.embedKeyPrefix,
      embedKeyHash: args.embedKeyHash,
      branding: {
        primaryColor: "#FF5C1A",
        accentColor: "#FFB347",
        position: "right",
        assistantName: "Assistant",
        welcomeMsg: "Hi! How can I help you today?",
        tone: "friendly, concise, professional",
      },
      aiSettings: {
        persona: `A helpful assistant for ${args.name}.`,
      },
    });

    // Creator is the owner.
    await ctx.db.insert("memberships", {
      userId,
      businessId,
      role: "owner",
    });

    // Default shared calendar: a login-less, staffId:null-style resource so
    // booking works before any employees are added.
    await ctx.db.insert("staff", {
      businessId,
      name: args.name,
      bookable: true,
      active: true,
      order: 0,
    });

    return businessId;
  },
});

/** Businesses the signed-in user belongs to (for the dashboard switcher). */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const rows = await Promise.all(
      memberships.map(async (m) => {
        const business = await ctx.db.get(m.businessId);
        return business ? { ...business, role: m.role } : null;
      }),
    );
    return rows.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/** A single business, gated by membership — the isolation boundary in action. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!business) return null;

    // Throws unless the caller is a member — cross-tenant reads are refused here.
    await requireMember(ctx, business._id);
    return business;
  },
});
