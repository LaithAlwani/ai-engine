import { Reveal } from "@/components/ui/reveal";

// Consistent section header: mono eyebrow + editorial serif title + optional lead.
// The eyebrow number, when present, encodes real order (used only where content
// is a genuine sequence).
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  className = "",
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  align?: "left" | "center";
  className?: string;
}) {
  const alignCls = align === "center" ? "items-center text-center" : "items-start";
  return (
    <div className={`flex flex-col ${alignCls} ${className}`}>
      <Reveal>
        <span className="eyebrow flex items-center gap-2.5">
          <span className="h-px w-6 bg-ember/70" />
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="mt-5 max-w-[18ch] text-4xl leading-[1.05] sm:text-5xl">
          {title}
        </h2>
      </Reveal>
      {lead && (
        <Reveal delay={0.1}>
          <p
            className={`mt-5 max-w-xl text-lg leading-relaxed text-muted ${
              align === "center" ? "mx-auto" : ""
            }`}
          >
            {lead}
          </p>
        </Reveal>
      )}
    </div>
  );
}
