import Link from "next/link";

// The AI Engine mark: a machined ring with a molten core — the engine running hot.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 ${className}`}
      aria-label="AI Engine home"
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
          <defs>
            <radialGradient id="core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFB347" />
              <stop offset="55%" stopColor="#FF5C1A" />
              <stop offset="100%" stopColor="#E0431E" />
            </radialGradient>
          </defs>
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="none"
            stroke="rgba(236,228,216,0.25)"
            strokeWidth="1.5"
          />
          {/* machined ticks */}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1="16"
              y1="3.5"
              x2="16"
              y2="6"
              stroke="rgba(236,228,216,0.35)"
              strokeWidth="1"
              transform={`rotate(${i * 30} 16 16)`}
            />
          ))}
          <circle
            cx="16"
            cy="16"
            r="5"
            fill="url(#core)"
            className="origin-center transition-transform duration-500 group-hover:scale-110"
          />
        </svg>
      </span>
      <span className="font-display text-[1.35rem] leading-none tracking-tight text-bone">
        AI&nbsp;Engine
      </span>
    </Link>
  );
}
