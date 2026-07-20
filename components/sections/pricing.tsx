import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { plans } from "@/lib/site-config";

export function Pricing({ withHeading = true }: { withHeading?: boolean }) {
  return (
    <section id="pricing" className="section relative scroll-mt-20">
      <div className="shell">
        {withHeading && (
          <SectionHeading
            align="center"
            eyebrow="Pricing"
            title={
              <>
                Pick a tier. <span className="text-molten">Scale</span> when it pays
                off.
              </>
            }
            lead="Every plan starts with a free trial. No setup fees, cancel anytime."
            className="mx-auto"
          />
        )}

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Reveal key={plan.slug} delay={0.07 * i} className="h-full">
              <article
                className={`relative flex h-full flex-col rounded-xl border p-7 ${
                  plan.featured
                    ? "border-ember/50 bg-surface shadow-[0_30px_90px_-40px_rgba(255,92,26,0.5)]"
                    : "border-line bg-surface/50"
                }`}
              >
                {plan.featured && (
                  <>
                    <div className="glow-ember pointer-events-none absolute inset-x-0 -top-10 h-24" />
                    <span className="absolute -top-3 left-7 rounded-full bg-ember px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-[#160b04]">
                      Most popular
                    </span>
                  </>
                )}

                <h3 className="font-display text-2xl text-bone">{plan.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{plan.blurb}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-4xl text-bone">{plan.price}</span>
                  <span className="font-mono text-sm text-faint">{plan.cadence}</span>
                </div>

                <Button
                  href={plan.slug === "enterprise" ? "/book" : "/book"}
                  variant={plan.featured ? "primary" : "ghost"}
                  size="md"
                  className="mt-6 w-full"
                >
                  {plan.cta}
                </Button>

                <ul className="mt-7 space-y-3 border-t border-line pt-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-3 text-sm text-bone-dim">
                      <svg
                        viewBox="0 0 16 16"
                        className="mt-0.5 h-4 w-4 shrink-0 text-ember"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                      >
                        <path d="m3 8 3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/plans/${plan.slug}`}
                  className="mt-6 font-mono text-xs text-faint transition-colors hover:text-ember"
                >
                  View {plan.name} details →
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
