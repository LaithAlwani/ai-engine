"use node";

import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildSystemPrompt } from "./lib/leoPrompt";
import { appError } from "./lib/errors";

// Per-tenant assistant reply. Node runtime so the Anthropic SDK works. Knowledge-
// grounded Q&A for Phase 1 — no booking/lead tools yet (those arrive in Phase 2).
// Model defaults to claude-haiku-4-5 (fast/cheap for a customer chat, per plan);
// override per business via aiSettings.model.

const messageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
});

export const reply = action({
  args: { slug: v.string(), messages: v.array(messageValidator) },
  returns: v.object({ reply: v.string() }),
  handler: async (ctx, args): Promise<{ reply: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      appError(
        "CONFIG",
        "The assistant isn't configured yet — set ANTHROPIC_API_KEY on the Convex deployment.",
      );
    }

    const business = await ctx.runQuery(internal.assistantContext.get, {
      slug: args.slug,
    });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: business.aiSettings.model ?? "claude-haiku-4-5",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(business, business.knowledge),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: args.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    return { reply: text || "Sorry, I didn't catch that — could you rephrase?" };
  },
});
