import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import { requireMemberBySlug, isManager } from "./lib/authz";
import { appError } from "./lib/errors";
import { signState, verifyState } from "./lib/googleState";

// A staff row with a linked login → only that employee may connect their own
// calendar (not even an owner). A login-less shared/resource calendar → managers
// connect it (there's no one else to). This prevents owner-on-behalf mistakes.
function calendarManageAllowed(
  role: Doc<"memberships">["role"],
  staffUserId: Id<"users"> | undefined,
  caller: Id<"users">,
): boolean {
  return staffUserId ? staffUserId === caller : isManager(role);
}

// -----------------------------------------------------------------------------
// Per-employee Google Calendar. OAuth code flow with a signed `state` carrying
// businessId + staffId. Tokens are stored per staff; free/busy is synced into
// `googleBusy`, which slot generation subtracts. All fetch — no Node runtime.
// -----------------------------------------------------------------------------

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) appError("CONFIG", `${name} is not set on the Convex deployment.`);
  return val;
}

function redirectUri(): string {
  return `${requireEnv("CONVEX_SITE_URL")}/google/callback`;
}

async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    appError("CONFIG", `Google token exchange failed (${res.status}).`);
  }
  return res.json();
}

async function refreshToken(refresh: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    appError("CONFIG", `Google token refresh failed (${res.status}).`);
  }
  return res.json();
}

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { email?: string };
  return data.email;
}

async function fetchFreeBusy(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<{ start: number; end: number }[]> {
  const res = await fetch(FREEBUSY_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });
  if (!res.ok) {
    appError("CONFIG", `Google free/busy query failed (${res.status}).`);
  }
  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };
  const busy = data.calendars?.[calendarId]?.busy ?? [];
  return busy.map((b) => ({
    start: Date.parse(b.start),
    end: Date.parse(b.end),
  }));
}

// --- Authorization for the dashboard entry points ---------------------------

/** requireMember + the target staff belongs here + (manager or the staff themselves). */
export const assertAccess = internalQuery({
  args: { slug: v.string(), staffId: v.id("staff") },
  returns: v.object({ businessId: v.id("businesses") }),
  handler: async (ctx, args) => {
    const { business, userId, membership } = await requireMemberBySlug(
      ctx,
      args.slug,
    );
    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.businessId !== business._id) {
      appError("NOT_FOUND", "That staff member no longer exists.");
    }
    if (!calendarManageAllowed(membership.role, staff.userId, userId)) {
      appError(
        "FORBIDDEN",
        staff.userId
          ? "Only this staff member can connect their own Google Calendar."
          : "Only an owner or admin can connect a shared calendar.",
      );
    }
    return { businessId: business._id };
  },
});

// --- Connect / disconnect / status ------------------------------------------

export const getAuthUrl = action({
  args: { slug: v.string(), staffId: v.id("staff") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const { businessId } = await ctx.runQuery(internal.google.assertAccess, {
      slug: args.slug,
      staffId: args.staffId,
    });
    const state = await signState(
      requireEnv("GOOGLE_STATE_SECRET"),
      businessId,
      args.staffId,
    );
    const params = new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      // Always show the account chooser + consent, so whoever connects picks the
      // correct Google account (esp. an owner connecting on an employee's behalf)
      // rather than silently linking whoever is already signed in.
      prompt: "select_account consent",
      state,
    });
    return { url: `${AUTH_URL}?${params.toString()}` };
  },
});

export const status = query({
  args: { slug: v.string(), staffId: v.id("staff") },
  handler: async (ctx, args) => {
    const { business, userId, membership } = await requireMemberBySlug(
      ctx,
      args.slug,
    );
    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.businessId !== business._id) {
      return { connected: false, email: null as string | null, canManage: false };
    }
    const tok = await ctx.db
      .query("googleTokens")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .unique();
    return {
      connected: !!tok,
      email: tok?.email ?? null,
      canManage: calendarManageAllowed(membership.role, staff.userId, userId),
      hasLogin: !!staff.userId,
    };
  },
});

export const disconnect = action({
  args: { slug: v.string(), staffId: v.id("staff") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runQuery(internal.google.assertAccess, {
      slug: args.slug,
      staffId: args.staffId,
    });
    await ctx.runMutation(internal.google.removeConnection, {
      staffId: args.staffId,
    });
    return null;
  },
});

export const syncBusy = action({
  args: { slug: v.string(), staffId: v.id("staff") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runQuery(internal.google.assertAccess, {
      slug: args.slug,
      staffId: args.staffId,
    });
    await ctx.runAction(internal.google.syncStaffBusy, {
      staffId: args.staffId,
    });
    return null;
  },
});

// --- Callback completion (called from the /google/callback HTTP route) ------

export const completeConnect = internalAction({
  args: { code: v.string(), state: v.string() },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, args): Promise<{ slug: string }> => {
    const parsed = await verifyState(
      requireEnv("GOOGLE_STATE_SECRET"),
      args.state,
    );
    if (!parsed) {
      appError("INVALID_CREDENTIALS", "Invalid or expired connection request.");
    }

    const tok = await exchangeCode(args.code);
    const email = await fetchEmail(tok.access_token);

    await ctx.runMutation(internal.google.upsertTokens, {
      businessId: parsed.businessId as Id<"businesses">,
      staffId: parsed.staffId as Id<"staff">,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiryMs: Date.now() + (tok.expires_in ?? 3600) * 1000,
      email,
    });

    await ctx.runAction(internal.google.syncStaffBusy, {
      staffId: parsed.staffId as Id<"staff">,
    });

    const slug = await ctx.runQuery(internal.google.slugForStaff, {
      staffId: parsed.staffId as Id<"staff">,
    });
    return { slug };
  },
});

/** Refresh the access token if needed, pull 30 days of free/busy, cache it. */
export const syncStaffBusy = internalAction({
  args: { staffId: v.id("staff") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const tokens = await ctx.runQuery(internal.google.tokensFor, {
      staffId: args.staffId,
    });
    if (!tokens) return null;

    let accessToken = tokens.accessToken;
    if (tokens.expiryMs < Date.now() + 60_000) {
      const refreshed = await refreshToken(tokens.refreshToken);
      accessToken = refreshed.access_token;
      await ctx.runMutation(internal.google.updateAccess, {
        staffId: args.staffId,
        accessToken,
        expiryMs: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      });
    }

    const timeMin = new Date(Date.now()).toISOString();
    const timeMax = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const spans = await fetchFreeBusy(
      accessToken,
      tokens.calendarId,
      timeMin,
      timeMax,
    );

    await ctx.runMutation(internal.google.replaceBusy, {
      businessId: tokens.businessId,
      staffId: args.staffId,
      spans,
    });
    return null;
  },
});

// --- Internal data helpers --------------------------------------------------

export const tokensFor = internalQuery({
  args: { staffId: v.id("staff") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleTokens")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .unique();
  },
});

export const slugForStaff = internalQuery({
  args: { staffId: v.id("staff") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const staff = await ctx.db.get(args.staffId);
    if (!staff) return "";
    const business = await ctx.db.get(staff.businessId);
    return business?.slug ?? "";
  },
});

export const upsertTokens = internalMutation({
  args: {
    businessId: v.id("businesses"),
    staffId: v.id("staff"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiryMs: v.number(),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleTokens")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .unique();
    const refresh = args.refreshToken ?? existing?.refreshToken;
    if (!refresh) {
      appError(
        "CONFIG",
        "Google didn't return a refresh token — reconnect and grant offline access.",
      );
    }
    const doc = {
      businessId: args.businessId,
      staffId: args.staffId,
      accessToken: args.accessToken,
      refreshToken: refresh,
      expiryMs: args.expiryMs,
      email: args.email ?? existing?.email,
      calendarId: existing?.calendarId ?? "primary",
    };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("googleTokens", doc);
    return null;
  },
});

export const updateAccess = internalMutation({
  args: {
    staffId: v.id("staff"),
    accessToken: v.string(),
    expiryMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleTokens")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        expiryMs: args.expiryMs,
      });
    }
    return null;
  },
});

export const replaceBusy = internalMutation({
  args: {
    businessId: v.id("businesses"),
    staffId: v.id("staff"),
    spans: v.array(v.object({ start: v.number(), end: v.number() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("googleBusy")
      .withIndex("by_staff_start", (q) => q.eq("staffId", args.staffId))
      .collect();
    for (const row of old) await ctx.db.delete(row._id);
    for (const span of args.spans) {
      await ctx.db.insert("googleBusy", {
        businessId: args.businessId,
        staffId: args.staffId,
        start: span.start,
        end: span.end,
      });
    }
    return null;
  },
});

export const removeConnection = internalMutation({
  args: { staffId: v.id("staff") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tok = await ctx.db
      .query("googleTokens")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .unique();
    if (tok) await ctx.db.delete(tok._id);
    const busy = await ctx.db
      .query("googleBusy")
      .withIndex("by_staff_start", (q) => q.eq("staffId", args.staffId))
      .collect();
    for (const row of busy) await ctx.db.delete(row._id);
    return null;
  },
});
