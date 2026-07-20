# AI Engine — Multi-Tenant AI Platform

> Living plan doc — the source of truth for this initiative. Update it at the end of every phase/step: check off completed items, note deviations, keep it in sync with reality.

## Progress log
- **2026-07-19** — Greenfield kickoff. Plan reoriented from a migration plan to a **build-from-zero multi-tenant platform**; no anchor/dogfood tenant, no data migration. Phase M (AI Engine landing page) is first. This file created and committed.
- **2026-07-19** — **Phase M shipped.** AI Engine landing page built ("Molten Engine" direction, `frontend-design` skill): hero with a live self-demonstrating assistant, platform tools, how-it-works, pricing tiers, FAQ, contact; `/services` + `/plans/[slug]`; direction-aware scroll navbar. Locked domain/deploy decision (1 repo → 1 Vercel project → many domains, `proxy.ts` hostname routing) + marketing performance guardrails.
- **2026-07-20** — **Phase 0 shipped.** Convex + Convex Auth (Password) live; multi-tenant schema (`businesses`, `memberships`, `staff`, `platformAdmins`, `auditLog` + authTables, all `by_business_*`/`by_user_business` indexes); `convex/lib/authz.ts` (`requireMember`, `requirePlatformAdmin`, role hierarchy); onboarding action (owner membership + default calendar + hashed embed key); `proxy.ts` auth gate (`/dashboard`→`/signin` verified); `(app)` route group with Convex providers scoped out of marketing (marketing stays `○ Static`); sign-in + minimal dashboard harness. **Verified:** 4 `convex-test` isolation tests green (`npm test`). Seed the first operator with `npx convex run platform:seedAdmin '{"email":"…"}'`.

## Build status
- [x] **Phase M — Landing page** — "Molten Engine" marketing site: hero with a live self-demonstrating assistant, platform-tools grid, how-it-works + embed snippet, pricing tiers, FAQ, contact; `/services` + `/plans/[slug]`; direction-aware scroll navbar + progress line. Marketing stays `○ Static`.
- [x] **Phase 0 — Tenancy foundation + auth** — Convex + Convex Auth (Password); multi-tenant schema (`businesses`, `memberships`, `staff`, `platformAdmins`, `auditLog` + authTables); `convex/lib/authz.ts` (`requireMember`, `requirePlatformAdmin`); onboarding action (owner membership + default calendar + hashed embed key); `proxy.ts` auth gate; `(app)` route group (Convex providers scoped out of marketing); sign-in + minimal dashboard. **4/4 isolation tests green.**
- [x] **Phase 1 — Knowledge, Chat, Dashboard** — dashboard shell `/dashboard/[businessSlug]` + business switcher + branding + Team page; per-tenant `knowledge`; per-tenant Leo prompt + real tool-use chat.
- [ ] **Phase 2 — Booking, Leads, Email, SMS** — per-employee booking + assignment + per-employee Google OAuth; leads CRM; per-tenant email; Twilio SMS; cron fan-out.
- [ ] **Widget** — `public/widget.js` + `app/embed` + tenant-scoped `/api/chat`,`/api/book` + durable rate limit.
- [ ] **Platform portal** — cross-tenant support portal (`app/platform/*`) + audit log.
- [ ] **Phase 3** — AI Employees, white-label, tiers, analytics.

## Context

**AI Engine** is a greenfield multi-tenant AI platform (Next.js 16 / React 19 / Convex). Businesses sign up, connect their knowledge, and embed an AI assistant that **chats, books, and captures leads** on their own site — "paste one snippet." The platform ships a set of reusable, **tenant-scoped tools built once and shared by every business** ("never build the same feature twice"): AI Chat, Business Knowledge, Dashboard, Booking, Leads, Email, SMS, Analytics — plus per-business white-label branding and revenue tiers.

Auth is **Convex Auth** (multi-user); SMS is **Twilio**; delivery is an **embeddable widget** businesses paste on their own site. It is multi-tenant **from row zero** — every domain table is partitioned by `businessId` from the first deploy, there is no single-tenant phase, and there is no data migration. **Onboarding a business is the one and only path in:** the first client comes through the same funnel as the hundredth. The in-app AI assistant is referred to as **"Leo"** (a per-tenant persona, not a fixed brand).

## Guiding architecture

1. **Three identity planes (keep strictly separate).**
   - **Platform plane** — the operator's super-admins who can see/assist *every* business (cross-tenant support portal). Authorized by `requirePlatformAdmin`, audited.
   - **Dashboard plane** — a business's own logged-in members (owner/admin/staff), scoped to their `businessId` by membership. Authorized by `requireMember`.
   - **Public/widget plane** — unauthenticated; authorized by a **per-business embed API key + origin allow-list**, never by user identity.
   Conflating these is the #1 security risk.
2. **`businessId` is the partition key on every domain table** — designed in from the first schema. No query runs without it; every index is `by_business_*` (e.g. `by_business_start`). Tables are **per-business by design** — nothing is a singleton (`settings` is one row per business, not a global).
3. **Staff/provider is a sub-dimension below `businessId`.** A business has many **employees**, each a bookable resource with their own availability + calendar. Booking tables (`bookings`, `availabilityRules`, `googleTokens`, `googleBusy`) carry a `staffId`; slot generation is per-employee; managers see all schedules, an employee sees their own. A business with one shared calendar uses a `staffId:null` default row.
4. **Templates ≠ tenants.** GroomHub/YardFlow are JSON blueprints that clone into a `businesses` row + child rows on onboarding.

### Repo structure (separation + marketing performance, one codebase, no duplication)
Use App Router **route groups** so bundles stay separate while logic is shared once:
- `app/(marketing)/*` — the AI Engine public marketing/landing site. Its own layout; static/ISR where possible → **stays fast, never pulls in dashboard code.**
- `app/dashboard/[businessSlug]/(dash)/*` — the SaaS dashboard: business switcher + branding + **staff/team management**.
- `app/platform/*` — the operator's cross-tenant **support portal** (super-admin only): list/inspect/assist every client business.
- `app/embed/*` + `public/widget.js` — the embeddable widget surface (iframe).
- `app/api/*` — tenant-scoped tool APIs (`/api/chat`, `/api/book`, `/api/sms`, `/api/event`).
- Shared tools live once in `convex/*` (tenant-scoped) and `lib/*` — imported where needed, tree-shaken per route group. **That's the no-duplication guarantee.**

### Domains & deployment (one project, many domains)
**One repo → one Vercel project → many domains.** Not a separate project per surface — route groups already give bundle isolation (marketing never loads dashboard code), so splitting the repo would only fork the design system and double the build/env setup for no gain.
- **`domain.com`** → the `(marketing)` group (public site).
- **`app.domain.com`** → the `dashboard` + `platform` groups (the authed app), for a clean mental model and stronger cookie/security isolation between the public site and the app.
- **Customer widget** loads on the *customer's own* domain via `<script src>` pointing back at this same project (`public/widget.js` → `app/embed` + `app/api/*`).
- All domains attach to the same Vercel deployment; `proxy.ts` reads the `Host` header and rewrites each hostname to its route group. Path-based (`domain.com/dashboard`) stays possible — the split is config, not architecture.

### Marketing performance guardrails (hold through every phase)
Project size must **never** leak into the landing page's bundle. Per-route code splitting + static prerender already decouple them; these four rules keep it that way:
1. **Root `app/layout.tsx` stays minimal** — fonts + `globals.css` only. No app-wide data/auth providers here.
2. **Auth/Convex providers live in the `dashboard`/`platform` group layouts**, never root — so the marketing group never ships the Convex client or Auth runtime.
3. **No marketing component imports from `convex/` or `app/dashboard/`.** Marketing reads only static content (Phase M) or its own tenant's public data via a lightweight server fetch — it never pulls tool modules.
4. **`proxy.ts` matcher excludes static assets** so the edge hostname check never runs on `_next/*`, images, or fonts.
Marketing pages stay `○ Static` (CDN-served, fixed-size HTML) regardless of how large the backend grows.

### Modular tool architecture (every tool is its own module)
The platform is a set of **self-contained, pluggable tool modules** so a new tool can be added by dropping in one module — no edits scattered across the codebase ("never build twice", and easy to extend).
- **One module per tool** — each of `chat`, `booking`, `leads`, `email`, `sms`, `invoicing`, `analytics`, `knowledge` owns its Convex file(s) (`convex/<tool>.ts`, `"use node"` side-effects split into `convex/<tool>Node.ts`), its `lib/<tool>/*` client helpers, its dashboard page, and its schema tables. No tool reaches into another tool's internals — they interact only through exported functions.
- **Consistent module contract** — every tool exposes the same shape: tenant-scoped Convex `queries/mutations/actions` that all take `businessId` (+ `staffId` where relevant) and start with an authz call (`requireMember`/`resolveTenantByKey`). A tool never derives tenant from anything but its arguments/request context.
- **Shared tool registry for the AI** — the AI's callable tools (`check_availability`, `book_call`, `create_lead`, `send_followup`, …) live in one registry (`lib/ai/tools/*`), each entry declaring its JSON schema + a tenant-scoped handler that dispatches into the owning module. Adding an AI capability = adding one registry entry, nothing else.
- **AI Employees compose modules** (Phase 3) — an employee is just a named subset of registry tools + a persona; it adds no new primitives.

### Coding standards (apply throughout)
- **Match conventions consistently across the codebase** — the same variable/function naming (camelCase fns, `by_business_*` index naming), spacing/formatting, and a terse, purposeful comment style (comment *why*, not *what*). Read a neighbouring file before writing.
- **No legacy or outdated packages.** Use current APIs only — Next 16 (`proxy.ts`, async `cookies()/params`), Convex 1.39+ single-arg db ops, current `@convex-dev/auth` + official `@convex-dev/twilio` component. Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` and `convex/_generated/ai/guidelines.md` before writing, and heed deprecation notices. If a dependency is outdated, **update the package** rather than work around it.
- **No dead/duplicated code** — never leave two code paths for the same job; delete a path the moment its replacement is verified.

---

## PHASE M — AI Engine Landing Page (do FIRST)

**Goal:** build the platform's public marketing/landing site (`app/(marketing)/*`) that **leads with the AI Engine platform** — AI chat, booking, lead capture, embeddable widget, AI employees, tiered pricing. It is **static-first with no backend dependency** (pricing can wire to Convex `plans` later; it ships fine standalone), which makes it the natural first deliverable and the brand/design anchor for everything after.

**Prerequisite — install the `frontend-design` skill** (not currently installed):
`npx skills add https://github.com/anthropics/claude-code --skill frontend-design` → lands at `.claude/skills/frontend-design`.
**Do the design thinking (purpose, tone, constraints, differentiation) with this skill BEFORE writing any component.**

### Sections (new render order)
1. **Hero** — eyebrow (AI platform), headline/sub leading with the value prop ("Deploy an AI assistant that chats, books, and captures leads on your site — paste one snippet"), CTAs → "See how it works" (`/#how`) and "Book a demo" (`/book`). Carries the **live-AI hero motif** (below).
2. **PlatformTools** — the tool grid (Chat, Booking, Leads, Email/SMS, Analytics, AI Employees, White-label), reframing capabilities.
3. **HowItWorks / WidgetDemo** — the "paste one `<script>` → your AI assistant goes live" story (a stylized embed snippet + a "try it" pointer to the Leo launcher). Sets up the widget phase.
4. **Pricing/Tiers teaser** — the platform tiers (Starter / Professional / Enterprise) as primary, with a link to `/services`. Static now; wire to Convex `plans` later.
5. **SelectedWork / Proof** — social proof / outcomes.
6. **WhyChooseUs** — value props framed as platform outcomes.
7. **Process** — onboarding story ("connect knowledge → embed → go live").
8. **FAQ** + **ContactSection** — platform + tiers Q&As; contact prefill (`?service=`, `?package=`).

### Pricing pages
- `app/services/page.tsx` — lead with platform tiers (primary grid, highlight Professional).
- `app/plans/[slug]/page.tsx` — per-slug SEO map for the tier slugs (`starter`/`professional`/`enterprise`); Convex `plans.getPublic` with static fallback (once Convex exists) — until then, static.

### Chrome, SEO, metadata
- `components/layout/{site-header,mobile-menu,site-footer}.tsx` — nav (Home / Platform (`/#tools`) / How it works (`/#how`) / Pricing (`/services`) / Contact) with scroll-spy + "Book a demo" CTA; footer sitemap + socials.
- Metadata/OG in `app/(marketing)/page.tsx`, `app/services/page.tsx`, `app/layout.tsx` for AI-platform positioning.

### Design direction — apply the `frontend-design` skill
Distinctive, production-grade, not cookie-cutter. Design thinking before coding:
- **Purpose** — convert SMB owners/operators to adopt the AI Engine: make "paste one snippet → an AI assistant that chats, books, and captures leads goes live on your site" feel inevitable and premium.
- **Tone** — **"technical luxury / editorial-dark"**: confident, kinetic, high-contrast, with the AI "engine" as a living motif. Memorable, still on-brand.
- **Constraints** — Next 16 + Tailwind v4 CSS-first `@theme` tokens, `motion/react`, a `components/ui/*` primitive set. Establish the token system (brand accent + `ink` core) here.
- **Differentiation (the signature element)** — a **live AI motif woven into the hero**: the assistant visibly "typing"/answering (tie to the Leo surface) or a kinetic "engine" visual, so the product demonstrates itself above the fold.

Execution principles from the skill:
- **Typography** — a **characterful display font** for headlines + a clean body face; move off Geist/Inter defaults for headings (avoid overused picks like Space Grotesk). Load via `next/font`; keep body legible.
- **Motion** — one orchestrated page-load with **staggered reveals**, scroll-triggered section transitions, tasteful hover surprises. Respect a reduced-motion block.
- **Spatial composition** — **asymmetry, overlap, diagonal flow, grid-breaking** accents; balance negative space with controlled density.
- **Visual details** — layered transparencies, gradients, subtle texture/grid, glow accents.
- **Anti-patterns to avoid** — generic fonts, predictable three-column-everything layouts, flat AI-default palettes, uniform card grids with no focal hierarchy.

**No backend/schema changes in Phase M.** Verify: `npm run build` green; home + `/services` + `/plans/[slug]` render the AI-Engine positioning; marketing stays static-first (fast first paint).

---

## PHASE 0 — Tenancy Foundation + Auth (load-bearing; ship before any feature)

**Convex Auth** (`labs.convex.dev/auth`): `npm i @convex-dev/auth @auth/core`, `npx @convex-dev/auth`; add `convex/auth.ts` (Password + optional Google), `convex/auth.config.ts`, spread `...authTables` into `convex/schema.ts` (managed `users`). Next side: `ConvexAuthNextjsServerProvider`, gate the authed surface with `convexAuthNextjsMiddleware`. Functions read the caller via `getAuthUserId(ctx)`. **Hostname routing in `proxy.ts`** — rewrite `app.domain.com/*` to the `dashboard`/`platform` groups and `domain.com/*` to `(marketing)`, all from this one Vercel project (see Domains & deployment); the auth gate applies on the `app.` host. **Convex Auth from the start — no legacy HMAC/`ADMIN_WRITE_KEY` ever exists.**

**New tables:**
- `businesses` — `slug`(unique), `name`, `status`, `domains: string[]` (widget allow-list), `embedKeyHash` + `embedKeyPrefix`, `branding{logoStorageId?,primaryColor,accentColor,chatIcon,position,assistantName,welcomeMsg,tone}`, `aiSettings{persona,model?,guardrails?}`, `tier`, `templateId?`. Indexes: `by_slug`, `by_embedKeyPrefix`, `by_domain`.
- `memberships` — `userId`, `businessId`, `role:"owner"|"admin"|"staff"`. Indexes `by_user`, `by_business`, `by_user_business`. (A user may belong to many businesses.) `owner`/`admin` = **manager** (sees all staff); `staff` = employee (sees own).
- `staff` — `businessId`, `userId?` (optional link to a login account — null = manager-managed resource with a calendar but no login), `name`, `email?`, `title`, `bookable:boolean`, `serviceIds?:string[]`, `active`, `order`. Indexes `by_business`, `by_business_active`, `by_user`.
- `platformAdmins` — `userId`, `role:"support"|"superadmin"`, `createdAt`. Index `by_user`. The allow-list of operators who can access the cross-tenant support portal. (Seed the platform owner as `superadmin`.)
- `auditLog` — `actorUserId`, `scope:"platform"|"business"`, `businessId?`, `action`, `targetId?`, `meta`, `ts`. Index `by_business_ts`, `by_actor_ts`. Records platform-admin cross-tenant actions (and sensitive business actions).

**Every domain table carries a required `businessId` from creation** — `settings` (per-business, not a singleton), `plans`, `projects`, `bookings`, `availabilityRules`, `blackoutDates`, `googleTokens`, `googleBusy`, `clients`, `invoices`, plus `knowledge`, `leads`, `events`. Booking tables (`bookings`, `availabilityRules`, `googleTokens`, `googleBusy`) also carry **`staffId`** (a `staffId:null`/business-default row is the fallback for a single shared calendar). Indexes are `by_business_*` / `by_staff_*` by design: `bookings.by_business_staff_start`, `availabilityRules.by_staff`, `googleTokens.by_staff`, `googleBusy.by_staff_start`.

**Authorization** — `convex/lib/authz.ts`:
- `requireMember(ctx, businessId, minRole?)` — dashboard functions: `getAuthUserId` → load membership `by_user_business` → throw if absent/below role.
- `resolveTenantByKey(ctx, embedKey, origin)` — widget/public: look up `businesses` by `embedKeyPrefix`, verify hash, check `origin ∈ domains[]`.
- `requirePlatformAdmin(ctx, minRole?)` — platform/support functions: `getAuthUserId` → check `platformAdmins by_user`; grants cross-tenant read (and, for `superadmin`, assist/act-as) regardless of membership. Every call writes an `auditLog` row.
- `requireCapability(ctx, businessId, cap)` — tier gating (Phase 3).
- **Employee visibility helper** — dashboard booking queries take the caller's membership: a manager (`owner`/`admin`) may pass any `staffId` (or none = all); a `staff` member is forced to their own linked `staffId`.

**Onboarding flow (the only path in):** creating a business inserts the `businesses` row + owner `memberships` + a default `staffId:null` calendar, and generates a hashed **embed key**. Seed the platform owner into `platformAdmins` (script/seed). Server actions pass `businessId` (from the logged-in user's active business, e.g. `/dashboard/[businessSlug]`) and rely on Convex Auth forwarding identity.

**Public/widget tenant resolution:** embed key (widget) → business slug (first-party) → `Origin` cross-check against `domains[]`.

**Verify:** sign up two businesses via Convex Auth; user A (member of biz 1) cannot read/write biz 2's data (membership scoping); `npx convex run` cross-tenant read attempts throw.

---

## PHASE 1 — Foundation: Knowledge, Chat, Dashboard

- **Per-tenant knowledge** — `knowledge` table (`businessId`, company, services[], pricing, hours, locations[], faq[], policies[]). `lib/get-knowledge.ts`/`lib/use-knowledge.ts` take `businessId`. Dashboard **Knowledge editor** built fresh (form patterns shared with `settings`/`pricing`). `lib/site-config.ts` is only a **template blueprint + marketing content** — never read by the AI at runtime.
- **Per-tenant Leo prompt** — `lib/leo-prompt.ts buildLeoSystemBlocks(business, knowledge)`: inject `branding.assistantName`/`tone`/`welcomeMsg` + the tenant knowledge block; use `sortedJSON` + ephemeral `cache_control` (cached per-business).
- **Real Anthropic tool-use from day one** (no sentinels). Shared **tool registry** — `check_availability`, `book_call`, `create_lead`, `send_followup` — each handler tenant-scoped (takes resolved `businessId` from request context, never from the model), dispatching into Convex fns (`api.slots.*`, `api.bookings.book`, `api.leads.create`). (`claude-haiku-4-5` supports tool use.)
- **Dashboard shell** at `app/dashboard/[businessSlug]/(dash)/*` built fresh + business switcher + branding page + a **Team page** (managers invite employees via Convex Auth, assign `role`, mark bookable, set services; add login-less bookable staff; each employee gets their own calendar-connect action).

---

## PHASE 2 — Automation: Booking, Leads, Email, SMS

- **Booking tenant- + employee-aware** — `convex/bookings.ts|slots.ts|availability.ts` take `businessId` **and `staffId`**; use the `by_business_staff_*` indexes (double-booking-safety + tokenized reschedule/cancel, per employee).
  - **Slot generation per employee** — `slots.ts` computes availability from that staff's `availabilityRules` + their `googleBusy` + existing bookings. One shared calendar uses the `staffId:null` default row.
  - **Assignment = pick or auto** — the booking widget/AI can request a specific `staffId`, or `"any"` → an `assignStaff(businessId, serviceId, startUtc)` helper picks among bookable, service-matching, free employees by **round-robin / least-busy**. The chosen `staffId` is written on the booking.
  - **Manager vs employee views** — dashboard booking calendar: managers see all employees (grouped/color-coded); a `staff` user sees only their own via the visibility helper.
  - **Per-employee Google OAuth (key risk):** each employee connects **their own** calendar. Thread **both `businessId` and `staffId`** through a **signed `state`** param in `convex/http.ts` `/google/connect`→`/google/callback`→`exchangeAndStore`; `authedCalendar(ctx, businessId, staffId)` loads that employee's `googleTokens`. One global redirect URI; `state` carries tenant + staff. Connect page lives per-employee in the dashboard.
- **Leads CRM** — `leads` table (`businessId`, name/email/phone/message, `source`, `status` pipeline, `assignedTo?`, `followUpAt?`, notes[]). `api.leads.create` called by the `create_lead` tool + `app/actions/booking.ts` + `app/actions/contact.ts`. Dashboard kanban; promote lead → `clients`.
- **Email per tenant** — `lib/mailer.ts` + `lib/booking-emails.ts` per-tenant sender identity; `emails/*` take branding props. Starter tier uses a shared platform sender; Pro+ custom domain (SPF/DKIM onboarding step).
- **SMS via Twilio** — official `@convex-dev/twilio` component (`convex/convex.config.ts` `app.use(twilio)`, webhook routes in `http.ts`). Per-tenant number/config; `"use node"` `sendSms(businessId,to,body)`; inbound webhook resolves tenant by destination number (validate signatures). Booking events fan out to email + SMS.
- **Cron fan-out** — `convex/crons.ts syncBusy` and the Vercel `app/api/cron/recurring-invoices/route.ts` are orchestrators that iterate `businesses` and schedule per-business (→ per-staff) work (Convex `scheduler` fan-out; loop-with-`businessId` for the Vercel route). Add a reminders/follow-ups cron.

---

## Embeddable Widget (cross-cutting; build after Phase 0)

- **`public/widget.js`** — the `<script>` businesses paste; reads `data-embed-key`, fetches branding via public `getWidgetConfig(embedKey, origin)`, injects a floating bubble, mounts an **iframe** → `app/embed/page.tsx` (renders `components/leo/*`, themed).
- **Tenant-scoped `app/api/chat/route.ts` + `app/api/book/route.ts`**: resolve tenant via embed key + `Origin`; set `Access-Control-Allow-Origin` to the specific origin **only if ∈ `domains[]`** (never `*`), handle preflight; build per-tenant prompt + dispatch tool calls. Embed page sets CSP `frame-ancestors` to allowed domains.
- **Embed key** generated at business creation, stored **hashed**; dashboard shows/rotates (rotation invalidates immediately).
- **Durable per-tenant rate limiting** (Convex rate-limiter component or Upstash), keyed by `businessId` + IP; also enforces tier message quotas.

## Analytics (Phase 2–3)
`events` table (`businessId`, `type:"pageview"|"chat"|"lead"|"booking"|"conversion"`, sessionId?, meta, ts; indexes `by_business_ts`, `by_business_type_ts`). Captured from widget (`/api/event`) + server-side on lead/booking. Daily rollups via per-business cron fan-out → `dailyRollups` table for fast charts. Per-business analytics dashboard.

## PHASE 3 — AI Employees + White-Label + Tiers
- **AI Employees = compositions** (no new primitives): a named bundle of shared tools + persona per business (Receptionist = availability+book+lead; Sales = lead+follow-up; Review = post-booking SMS/email). All dispatch into the same tenant-scoped functions.
- **White-label** — `businesses.branding` flows to widget (via `getWidgetConfig`), emails, and invoice PDFs (`lib/invoice-pdf*.ts`).
- **Tiers** — static `TIERS` capability map (`smsEnabled`, `customDomainEmail`, `maxAIEmployees`, `aiMessagesPerMonth`, …) enforced server-side via `requireCapability`.

## Platform Support Portal (cross-tenant, operators only; buildable after Phase 0)

A separate top-level surface at `app/platform/*`, gated by `requirePlatformAdmin` (not per-business membership), so operators can see and assist every client:
- **Businesses index** — all `businesses` with tier, status, owner, member/staff counts, connected-calendar + widget-embed health, last activity.
- **Business detail** — drill into one client: members/staff, knowledge, plans, bookings, leads, invoices, analytics rollups. Reuses the same tenant-scoped queries the dashboard uses, just authorized via `requirePlatformAdmin` instead of `requireMember`.
- **Assist / act-as** (superadmin) — optionally impersonate a business to fix config on the owner's behalf; every action writes an `auditLog` row (`scope:"platform"`). Impersonation is time-boxed and banner-flagged in the UI.
- **Platform-wide metrics** — total businesses, MRR by tier, aggregate usage.
- Convex side: `convex/platform.ts` — every query/mutation starts with `await requirePlatformAdmin(ctx)` and iterates across `businesses` (the only place cross-tenant reads are allowed). Seed the platform owner into `platformAdmins` at setup.

---

## Biggest risks
1. **Per-employee Google OAuth** — sign/verify **both `businessId` and `staffId`** in OAuth `state` (prevents CSRF + connecting a calendar to the wrong tenant *or the wrong employee*). `googleBusy` cron fans out per **staff**, not just per business.
2. **Cron fan-out** — orchestrate per-business → per-staff; schedule small jobs, don't run one giant loop.
3. **Widget security** — never reflect `Origin:*`; allow-list per business; hash + rotate embed keys; CSP `frame-ancestors`; durable per-tenant rate limit.
4. **Platform-admin blast radius** — `requirePlatformAdmin` bypasses tenant isolation, so it's the highest-privilege path: keep the `platformAdmins` allow-list tiny, audit every action, time-box impersonation, banner-flag act-as. A bug here leaks *all* tenants.
5. **Employee visibility leak** — a `staff` user must never see other employees' bookings/leads; enforce the forced-`staffId` visibility helper server-side in every dashboard booking query, never trust a client-supplied `staffId`.

## Recommended build order (each step ships)
0. **PHASE M — AI Engine landing page** (`app/(marketing)/*`), static-first. **Done first.** Install the `frontend-design` skill (`npx skills add https://github.com/anthropics/claude-code --skill frontend-design`), do the design thinking with it, then build. Commit `plan.md` as part of this first step.
1. Convex Auth + multi-tenant schema (all tables `businessId`-required) + `convex/lib/authz.ts` + business-onboarding mutation.
2. Dashboard shell `app/dashboard/[businessSlug]/(dash)/*` + business switcher + branding + **Team/staff** page.
3. Per-tenant Knowledge + per-tenant Leo prompt + **real tool-use** chat (shared tool registry).
4. Booking tenant+employee-aware + assignment (round-robin/least-busy) + **per-employee Google OAuth** + manager/employee views.
5. Leads CRM + per-tenant Email + Twilio SMS + cron fan-out (per business → per staff).
6. Embeddable widget + tenant-scoped `/api/chat`,`/api/book` + durable rate limit.
7. Platform Support Portal (cross-tenant) + audit log.
8. Analytics, AI Employees, white-label, tiers.

## Critical files
**Phase M (landing page):** `app/(marketing)/{layout,page}.tsx` + `components/sections/{hero,platform-tools,how-it-works,pricing-teaser,selected-work,why-choose-us,process,faq,contact-section}.tsx`; `app/services/page.tsx` + `app/plans/[slug]/page.tsx` (tiers); `components/layout/{site-header,mobile-menu,site-footer}.tsx`; `app/globals.css` (`@theme` tokens) + `components/ui/*`; `lib/{site-config,types,faq}.ts` (marketing content). Install `.claude/skills/frontend-design` first.

**Platform (Phases 0–3):**
- `convex/schema.ts` — `businesses`/`memberships`/`staff`/`platformAdmins`/`auditLog`/`knowledge`/`leads`/`events` + all domain tables with required `businessId` + `staffId` on `bookings`/`availabilityRules`/`googleTokens`/`googleBusy` + `...authTables`, all `by_business_*`/`by_staff_*` indexes.
- `convex/lib/authz.ts` — `requireMember`, `resolveTenantByKey`, `requirePlatformAdmin`, `requireCapability`, employee-visibility helper.
- `convex/bookings.ts` / `convex/slots.ts` / `convex/availability.ts` — `businessId` + `staffId`; per-employee slot generation + `assignStaff` round-robin/least-busy.
- `lib/leo-prompt.ts` — per-tenant prompt + persona + tool-use.
- `app/api/chat/route.ts` — tenant-scoped chat (CORS/origin allow-list + tool dispatch); `app/api/book/route.ts`.
- `convex/google.ts` + `convex/http.ts` — `businessId` **+ `staffId`** through OAuth `state`; per-employee tokens; Convex Auth + Twilio routes.
- New: `convex/auth.ts`, `convex/auth.config.ts`, `convex/staff.ts`, `convex/platform.ts`, `convex/leads.ts`, `convex/analytics.ts`, `convex/sms.ts`, `public/widget.js`, `app/embed/*`, `app/dashboard/[businessSlug]/(dash)/*` (incl. Team page), `app/platform/*`.

## Verification (per phase)
- **Phase M:** `npm run build` green; home + `/services` + `/plans/[slug]` render the AI-Engine positioning; marketing stays static-first (fast first paint).
- **Phase 0 (isolation):** sign up two businesses (A, B) via Convex Auth; confirm a member of A cannot read/write B's data (membership scoping); `/dashboard/[slug]` books/edits end-to-end for each. `npx convex run` cross-tenant read attempts throw.
- **Phase 1:** edit business A's knowledge → Leo answers from Convex (not `site-config`); business B with different knowledge/persona answers differently; tool-use `check_availability`/`book_call` books through the engine.
- **Phase 2 (staff):** a business with 2+ employees — each connects their *own* Google Calendar (via `state` carrying `businessId`+`staffId`); the widget shows per-employee slots; "any available" round-robins; a manager sees both employees' calendars while an employee sees only their own; a booking assigned to employee A never blocks employee B; a login-less bookable staff can still be booked by the manager.
- **Phase 2 (tenants):** two businesses each connect their own calendar; a booking on A never appears on B; leads persist to the CRM; SMS reminder sends via Twilio; recurring-invoice + free/busy crons fan out per business → per staff.
- **Platform portal:** a `platformAdmins` user opens `/platform`, lists all businesses, drills into one to view its bookings/leads/invoices; a non-platform user gets 403; an act-as session writes `auditLog` rows and shows the impersonation banner.
- **Widget:** paste `widget.js` (with a business's embed key) on a separate localhost origin listed in `domains[]` → chat/book works; the same key from a non-listed origin is rejected (CORS + `frame-ancestors`); rotating the key breaks the old embed.
- **Phase 3:** tier gating blocks SMS on Starter server-side; white-label branding shows the tenant's logo/colors/assistant name in widget + emails + PDF.
- Run `npm run build` + `npx convex deploy` green before each phase ships.
