# Product

## Register

brand

> Digizelle is a dual-register product. The **default is `brand`** — the public vitrine (`/`, `/mentora` landing, `/about`, `/programs`, `/events`, `/blog`, `/projects`, `/team`) where design IS the product and conversion + credibility are the job. The logged-in SaaS surfaces (Mentora dashboards, community feed, `/mentora/admin`, onboarding, settings, sessions, messages) are **product** register and should be treated as such per-task. The non-negotiable: a user must never feel a seam crossing from the marketing site into the app — one brand, two faces.

## Users

Three audiences, one coherent product (nonprofit, association loi 1901, digital inclusion for young people — especially young women — in Île-de-France and beyond):

- **Mentees (jeunes apprenantes)** — often beginners entering tech, sometimes intimidated by the field. Context: looking for a mentor, following sessions, leveling up, engaging in community. Job: *"find someone who believes in me and a concrete path forward."*
- **Mentors (bénévoles)** — working professionals giving time to 1–5 mentees. Context: busy, fitting mentoring around a job. Job: *"help effectively without admin friction — manage my availability, sessions, and mentees fast."*
- **Partners & visitors** — funders, schools, sponsors, prospective members evaluating the association. Context: a few minutes on the public site. Job: *"decide whether this organization is credible and worth backing/joining."*

## Product Purpose

Digizelle combines a premium public vitrine, 1:1 mentorship (**Mentora**), a UGC community, and an admin back-office in a single Next.js application. It exists to lower the barrier into tech for an under-represented audience by pairing them with mentors and a supportive community.

Success looks like: a visitor trusts the org within seconds of the landing page; a mentee completes onboarding and gets matched without feeling lost; a mentor runs their mentorships with near-zero friction; and partners see an organization whose craft matches its mission.

## Brand Personality

**Encouraging · premium · alive** — underpinned by trustworthy.

- **Encouraging & warm**: supportive and human; a beginner should feel they belong, not that they're being tested. Reassuring over clever. Copy speaks *with* the user (French, `tu`-adjacent warmth), never down to them.
- **Premium & polished**: the craft (the Liquid-Glass system, motion, attention to detail) signals quality to funders and safety to families. This is a nonprofit that does not look scrappy.
- **Playful & alive**: 3D mascots, orbital badges, aurora gradients, and purposeful motion give the product character. Delight is part of the build, not decoration bolted on.
- **Trustworthy & serious (underpinning)**: it handles mentorship (including minors) and sensitive data under RGPD. Privacy, safety, and credibility are load-bearing — the playfulness never undercuts them.

Voice: warm, specific, French-first, concrete. No buzzwords, no hype.

## Anti-references

What this must explicitly NOT look like:

- **Childish / edu-cutesy.** No primary-color blocks, comic typefaces, or kiddie e-learning energy. The mascots stay sophisticated and characterful, never babyish. Friendly ≠ childish.
- **Crypto / AI-hype.** No neon-on-black, no aggressive gradients everywhere, no casino energy, no hype copy. The glass should read Apple-calm and considered, not loud. (Note: the brand's signature aurora/violet glass is deliberate and earns its place — the ban is on *generic* neon hype, not the committed identity.)
- **Generic AI slop.** No cream-and-serif editorial cliché, no tiny uppercase eyebrow above every section, no endless identical icon+heading+text card grids, no gradient-text on every heading. The established brand uses its violet wordmark gradient and one named eyebrow style as deliberate identity; new work must not multiply these into reflexive scaffolding.
- (Lower priority, still avoid) **Cold corporate SaaS** — navy-and-gray Bootstrap admin. Even product-register app screens carry the warm brand, not a soulless template.

## Design Principles

1. **One product, two faces.** Public vitrine and logged-in app are the same brand. No seam, no jarring shift in type, color, motion, or voice when a mentee crosses from `/mentora` into `/mentora/dashboard`.
2. **Belonging before features.** The primary user is often a nervous beginner. Reduce intimidation first: clear next steps, encouraging copy, generous empty/first-run states. Make people feel capable, then show the depth.
3. **Premium earns trust.** For a nonprofit courting partners and safeguarding sensitive mentorship data, polish is not vanity — it is the credibility and safety signal. Ship finished, not scrappy.
4. **Delight with restraint.** Mascots, glass, and motion carry personality, but never at the cost of legibility, performance, or accessibility. Playful, never childish; rich, never noisy.
5. **Inclusive by construction.** Accessibility is the thesis, not a final checklist. A digital-inclusion product that excludes anyone fails its own mission — design for keyboard, reduced motion, color-blindness, and low confidence from the first pixel.

## Accessibility & Inclusion

- **Target: WCAG 2.2 AA + inclusive extras.** This is a hard floor, justified by the inclusion mission.
- Body text ≥ 4.5:1, large/bold text ≥ 3:1, placeholders held to body contrast (watch the glass surfaces — translucent backgrounds make muted ink fail; verify against the actual rendered backdrop, not the token).
- Full keyboard navigation; visible `:focus-visible` rings (already systematized via `--brand-violet` outline) on every interactive element.
- `prefers-reduced-motion: reduce` alternative for every animation (the aurora, mascot float/tilt, orbital badges, GSAP footer, reveals) — crossfade or instant, never blank.
- Color-blind-safe state encoding: never rely on hue alone for status (mentorship status, moderation states, validation) — pair with icon, shape, or text.
- Semantic markup, real labels, standalone link text; the glass/blur effects must never trap content behind a class-gated reveal that fails on headless/hidden renders.
