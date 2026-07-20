import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { modifyAccountCredentials } from "@convex-dev/auth/server";

// -----------------------------------------------------------------------------
// Custom password-reset flow. Unlike Convex Auth's built-in reset (which binds
// the code to the requesting browser via a verifier), this issues a hashed,
// single-use token carried in an email LINK — so it works on any device.
//   request:  requestReset(email)  -> emails a link with a random token
//   complete: resetPassword(token, newPassword) -> changes the password
// -----------------------------------------------------------------------------

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Step 1 — email a reset link. Always resolves (never reveals if the email exists). */
export const requestReset = action({
  args: { email: v.string() },
  returns: v.null(),
  // Explicit return type: this action references same-file internal functions,
  // which otherwise triggers TS circular inference.
  handler: async (ctx, args): Promise<null> => {
    const email = args.email.trim();
    const token = randomToken();
    const tokenHash = await sha256Hex(token);

    const canonicalEmail: string | null = await ctx.runMutation(
      internal.passwordReset.storeToken,
      { email, tokenHash, expiresAt: Date.now() + TOKEN_TTL_MS },
    );
    if (canonicalEmail === null) return null; // no such user — stay silent

    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const url = `${siteUrl}/reset-password?token=${token}`;
    await ctx.runAction(internal.emailNode.sendPasswordResetEmail, {
      to: canonicalEmail,
      url,
    });
    return null;
  },
});

/** Store the token hash against the user, clearing any earlier ones. */
export const storeToken = internalMutation({
  args: { email: v.string(), tokenHash: v.string(), expiresAt: v.number() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (!user || !user.email) return null;

    const existing = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    await ctx.db.insert("passwordResetTokens", {
      userId: user._id,
      email: user.email,
      tokenHash: args.tokenHash,
      expiresAt: args.expiresAt,
    });
    return user.email;
  },
});

/** Step 2 — verify the token and set the new password. Returns the email so the
 *  client can sign the user straight in. */
export const resetPassword = action({
  args: { token: v.string(), newPassword: v.string() },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, args): Promise<{ email: string }> => {
    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const tokenHash = await sha256Hex(args.token);
    const email: string | null = await ctx.runMutation(
      internal.passwordReset.consumeToken,
      { tokenHash },
    );
    if (email === null) {
      throw new Error("This reset link is invalid or has expired.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });
    return { email };
  },
});

/** Look up + delete the token (single use), returning its email if still valid. */
export const consumeToken = internalMutation({
  args: { tokenHash: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (row.expiresAt < Date.now()) return null;
    return row.email;
  },
});
