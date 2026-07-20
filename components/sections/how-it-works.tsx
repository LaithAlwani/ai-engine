import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { steps, embedSnippet } from "@/lib/site-config";

export function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-20 border-y border-line bg-ink-2">
      {/* Diagonal ember seam cutting across the band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -inset-x-40 top-1/2 h-px -translate-y-1/2 -rotate-3 bg-linear-to-r from-transparent via-ember/30 to-transparent" />
      </div>

      <div className="shell section relative">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              From nothing to <span className="text-molten">live</span> in three
              steps.
            </>
          }
          lead="No developers, no training data, no migration. Connect what you know, paste one line, and the engine starts working."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_1fr_1fr_1.15fr]">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={0.08 * i}>
              <div className="relative h-full rounded-xl border border-line bg-surface/50 p-6">
                <span className="font-mono text-sm text-ember">{step.n}</span>
                <span
                  aria-hidden
                  className="ml-3 align-middle font-mono text-xs text-faint"
                >
                  / 03
                </span>
                <h3 className="mt-4 text-xl text-bone">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}

          {/* The snippet — the whole promise, in one card */}
          <Reveal delay={0.24}>
            <div className="h-full overflow-hidden rounded-xl border border-ember/25 bg-[#0a0806]">
              <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-faint/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-faint/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-faint/50" />
                <span className="ml-2 font-mono text-[0.7rem] text-faint">
                  index.html
                </span>
              </div>
              <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.78rem] leading-relaxed text-bone-dim">
                <code>
                  {embedSnippet.split("\n").map((line, li) => (
                    <div key={li}>
                      <span className="mr-3 select-none text-faint/60">
                        {li + 1}
                      </span>
                      <span
                        className={
                          line.includes("data-embed-key")
                            ? "text-flare"
                            : "text-bone-dim"
                        }
                      >
                        {line}
                      </span>
                    </div>
                  ))}
                </code>
              </pre>
              <div className="border-t border-line px-4 py-3">
                <p className="font-mono text-[0.7rem] text-ember">
                  ● assistant mounted — answering in 60s
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
