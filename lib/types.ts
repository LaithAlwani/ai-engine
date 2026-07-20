// Shared content types for the marketing surface. In Phase 1 these same shapes
// get sourced per-business from Convex; for Phase M they're static seed content.

export type NavItem = { label: string; href: string };

export type Tool = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: IconName;
  /** One tool is the visual focal point of the grid. */
  featured?: boolean;
};

export type ProcessStep = {
  n: string;
  title: string;
  body: string;
};

export type Metric = {
  value: string;
  label: string;
};

export type ValueProp = {
  title: string;
  body: string;
  icon: IconName;
};

export type PlanKind = "platform" | "agency";

export type Plan = {
  slug: string;
  name: string;
  kind: PlanKind;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  featured?: boolean;
  cta: string;
};

export type Faq = { q: string; a: string };

export type IconName =
  | "chat"
  | "calendar"
  | "leads"
  | "mail"
  | "chart"
  | "employees"
  | "palette"
  | "bolt"
  | "shield"
  | "plug"
  | "globe"
  | "spark";
