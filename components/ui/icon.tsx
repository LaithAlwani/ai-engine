import type { IconName } from "@/lib/types";

// Line icons, 1.5px stroke, machined feel. currentColor so they inherit context.
const paths: Record<IconName, React.ReactNode> = {
  chat: (
    <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" />
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="1.5" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
    </>
  ),
  leads: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20c0-3 2.5-5 5-5s5 2 5 5M16 8h5M18.5 5.5v5" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  chart: (
    <path d="M4 20V4M4 20h16M8 20v-6M12.5 20V9M17 20v-9" />
  ),
  employees: (
    <>
      <circle cx="8" cy="8" r="2.6" />
      <circle cx="16.5" cy="9" r="2.2" />
      <path d="M3.5 19c0-2.7 2-4.5 4.5-4.5s4.5 1.8 4.5 4.5M14 19c.2-2 1.3-3.4 3-3.8" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 2-2 0-1.4 1.2-2 2.4-2H18a2.5 2.5 0 0 0 2.5-2.5C20.5 7.6 16.7 3.5 12 3.5Z" />
      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  bolt: <path d="M13 3 5 13h5l-1 8 8-11h-5z" />,
  shield: (
    <>
      <path d="M12 3.5 5 6v5c0 4.5 3 7.5 7 9.5 4-2 7-5 7-9.5V6z" />
      <path d="m9 12 2 2 4-4.5" />
    </>
  ),
  plug: (
    <path d="M9 3v5M15 3v5M6 8h12v2a6 6 0 0 1-12 0zM12 16v5" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.4 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.4-3.8-8.5S9.5 5.9 12 3.5Z" />
    </>
  ),
  spark: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  ),
};

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
