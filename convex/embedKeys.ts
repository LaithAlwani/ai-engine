import { v } from "convex/values";
import { Scrypt } from "lucia";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { appError } from "./lib/errors";
import { generateEmbedKey } from "./lib/keys";

// -----------------------------------------------------------------------------
// Embed-key reveal & rotate, gated by the caller's login password. Password
// verification uses the same Scrypt hash Convex Auth stores, checked here in an
// action (CPU-heavy crypto). The full key is publishable but we still gate the
// reveal as requested — friction against a walk-up to an unlocked session.
// -----------------------------------------------------------------------------

async function passwordOk(storedHash: string | null, password: string) {
  if (!storedHash) return false;
  // lucia Scrypt.verify(hash, password)
  return await new Scrypt().verify(storedHash, password);
}

export const reveal = action({
  args: { slug: v.string(), password: v.string() },
  returns: v.object({ key: v.union(v.string(), v.null()) }),
  handler: async (ctx, args): Promise<{ key: string | null }> => {
    const data = await ctx.runQuery(internal.businesses.revealData, {
      slug: args.slug,
    });
    if (!(await passwordOk(data.storedHash, args.password))) {
      appError("INVALID_CREDENTIALS", "Incorrect password.");
    }
    return { key: data.embedKey };
  },
});

export const rotate = action({
  args: { slug: v.string(), password: v.string() },
  returns: v.object({ key: v.string() }),
  handler: async (ctx, args): Promise<{ key: string }> => {
    const data = await ctx.runQuery(internal.businesses.revealData, {
      slug: args.slug,
    });
    if (!(await passwordOk(data.storedHash, args.password))) {
      appError("INVALID_CREDENTIALS", "Incorrect password.");
    }
    const { key, prefix, hash } = await generateEmbedKey();
    await ctx.runMutation(internal.businesses.applyEmbedKeyRotation, {
      businessId: data.businessId,
      embedKey: key,
      embedKeyPrefix: prefix,
      embedKeyHash: hash,
    });
    return { key };
  },
});
