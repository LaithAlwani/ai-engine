import type { Doc } from "../_generated/dataModel";

// -----------------------------------------------------------------------------
// Per-tenant system prompt for the assistant ("Leo"). Grounded in the business's
// branding + persona, and — when present — its knowledge base (services, hours,
// pricing, FAQs, policies) so the assistant answers from real facts.
// -----------------------------------------------------------------------------

type PromptInput = {
  name: string;
  branding: Doc<"businesses">["branding"];
  aiSettings: Doc<"businesses">["aiSettings"];
};

export type KnowledgeContent = {
  about: string;
  services: { name: string; description?: string }[];
  pricing: string;
  hours: string;
  locations: { name?: string; address: string; phone?: string }[];
  faq: { q: string; a: string }[];
  policies: string;
};

function knowledgeBlock(k: KnowledgeContent): string {
  const parts: string[] = [];
  if (k.about.trim()) parts.push(`About:\n${k.about.trim()}`);
  if (k.services.length) {
    parts.push(
      "Services:\n" +
        k.services
          .map((s) => `- ${s.name}${s.description ? ` — ${s.description}` : ""}`)
          .join("\n"),
    );
  }
  if (k.pricing.trim()) parts.push(`Pricing:\n${k.pricing.trim()}`);
  if (k.hours.trim()) parts.push(`Hours:\n${k.hours.trim()}`);
  if (k.locations.length) {
    parts.push(
      "Locations:\n" +
        k.locations
          .map(
            (l) =>
              `- ${l.name ? `${l.name}: ` : ""}${l.address}${l.phone ? ` (${l.phone})` : ""}`,
          )
          .join("\n"),
    );
  }
  if (k.policies.trim()) parts.push(`Policies:\n${k.policies.trim()}`);
  if (k.faq.length) {
    parts.push(
      "FAQ:\n" + k.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n"),
    );
  }
  return parts.join("\n\n");
}

export function buildSystemPrompt(
  business: PromptInput,
  knowledge?: KnowledgeContent | null,
): string {
  const { branding, aiSettings } = business;
  const block = knowledge ? knowledgeBlock(knowledge) : "";

  return [
    `You are ${branding.assistantName}, the AI assistant for ${business.name}.`,
    aiSettings.persona,
    `Write in this tone: ${branding.tone}.`,
    aiSettings.guardrails ? `Guardrails: ${aiSettings.guardrails}` : "",
    block
      ? `Here is everything you know about ${business.name} — treat it as your source of truth:\n\n${block}`
      : "",
    `Answer only from what you actually know about ${business.name}. If a question is outside your scope or the information above doesn't cover it, say so plainly and offer to connect the visitor with the team — never invent hours, prices, or policies. Keep replies concise, warm, and helpful.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
