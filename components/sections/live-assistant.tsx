"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// The signature element: the assistant demonstrates the product on itself —
// answering, offering real slots, booking, and capturing the lead — inside an
// "engine" panel running hot. Everything else on the page stays quiet so this
// is the one thing you remember.

type Step = {
  from: "user" | "ai";
  text: string;
  chips?: string[];
  status?: string; // e.g. "Booking created" — the product doing a real thing
};

const script: Step[] = [
  { from: "user", text: "Any openings this week for a consult?" },
  {
    from: "ai",
    text: "Yes — Thursday 2:00 PM or Friday 10:30 AM are open. Want me to book one?",
    chips: ["Thursday 2:00 PM", "Friday 10:30 AM"],
  },
  { from: "user", text: "Thursday 2:00 PM" },
  {
    from: "ai",
    text: "Booked you in for Thursday at 2:00. What email should the confirmation go to?",
    status: "Booking created",
  },
  { from: "user", text: "sam@brightsmile.co" },
  {
    from: "ai",
    text: "Sent — see you Thursday. Anything else I can help with?",
    status: "Lead captured",
  },
];

type Rendered = Step & { typed: string; done: boolean };

const TYPE_MS = 20;
const READ_MS = 1100;
const LOOP_PAUSE_MS = 2600;

export function LiveAssistant() {
  const reduce = useReducedMotion();
  const [msgs, setMsgs] = useState<Rendered[]>([]);
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Reduced motion: show the full conversation, no animation.
    if (reduce) {
      setMsgs(script.map((s) => ({ ...s, typed: s.text, done: true })));
      return;
    }

    const wait = (ms: number) =>
      new Promise<void>((res) => {
        timers.current.push(setTimeout(res, ms));
      });

    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        setMsgs([]);
        for (const step of script) {
          if (cancelled) return;
          if (step.from === "user") {
            setMsgs((m) => [...m, { ...step, typed: step.text, done: true }]);
            await wait(READ_MS);
          } else {
            // "thinking" beat, then type out
            setTyping(true);
            await wait(650);
            if (cancelled) return;
            setTyping(false);
            setMsgs((m) => [...m, { ...step, typed: "", done: false }]);
            for (let i = 1; i <= step.text.length; i++) {
              if (cancelled) return;
              await wait(TYPE_MS);
              setMsgs((m) => {
                const next = [...m];
                const last = next[next.length - 1];
                if (last) next[next.length - 1] = { ...last, typed: step.text.slice(0, i) };
                return next;
              });
            }
            setMsgs((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last) next[next.length - 1] = { ...last, done: true };
              return next;
            });
            await wait(READ_MS);
          }
        }
        await wait(LOOP_PAUSE_MS);
      }
    };

    run();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reduce]);

  return (
    <div className="relative">
      {/* Ambient engine core — hot behind the glass */}
      <div
        aria-hidden
        className="glow-ember pointer-events-none absolute -inset-8 blur-2xl"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember/20 blur-3xl"
        animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative overflow-hidden rounded-xl border border-line-strong bg-surface/80 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        {/* Panel header — the engine readout */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full bg-ember"
                animate={reduce ? undefined : { scale: [1, 2.4], opacity: [0.7, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ember" />
            </span>
            <span className="font-mono text-xs tracking-wide text-bone-dim">
              assistant · live
            </span>
          </div>
          <span className="font-mono text-[0.7rem] text-faint">brightsmile.co</span>
        </div>

        {/* Transcript */}
        <div className="flex min-h-[19rem] flex-col gap-3 px-5 py-5 sm:min-h-[20rem]">
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={m.from === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div className="max-w-[85%]">
                  <div
                    className={
                      m.from === "user"
                        ? "rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-sm text-bone"
                        : "rounded-2xl rounded-bl-md border border-ember/25 bg-ember-soft px-4 py-2.5 text-sm text-bone"
                    }
                  >
                    {m.typed}
                    {!m.done && m.from === "ai" && (
                      <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-ember" />
                    )}
                  </div>

                  {/* Real slot chips */}
                  {m.done && m.chips && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.chips.map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-line-strong bg-surface px-3 py-1 font-mono text-xs text-bone-dim"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Status pill — the product doing something real */}
                  {m.done && m.status && (
                    <motion.div
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember-soft px-2.5 py-1 text-xs text-flare"
                    >
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m3 8 3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {m.status}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {typing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-ember/25 bg-ember-soft px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-flare"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Composer (decorative) */}
        <div className="border-t border-line px-5 py-3.5">
          <div className="flex items-center gap-3 rounded-full border border-line bg-ink/60 px-4 py-2.5">
            <span className="flex-1 text-sm text-faint">Ask anything…</span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ember text-[#160b04]">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 13V3M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
