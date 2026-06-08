---
name: Digizelle
description: Liquid-Glass identity for a digital-inclusion mentorship platform — frosted violet glass that warms what's behind it.
colors:
  electric-violet: "#7301FF"
  violet-light: "#A34BF5"
  violet-soft: "#C28BFA"
  aurora-pink: "#F46FB1"
  midnight-navy: "#24325F"
  navy-light: "#3A4A82"
  ink: "#1A1F3A"
  ink-soft: "#545B7A"
  ink-muted: "#8B91AD"
  canvas: "#FFFFFF"
  night-canvas: "#0A0820"
  night-header: "#14102A"
  night-panel: "#1A1240"
typography:
  display:
    fontFamily: "Signika, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
    fontSize: "clamp(2.125rem, 1.2rem + 4.6vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Signika, -apple-system, sans-serif"
    fontSize: "clamp(1.625rem, 1.1rem + 2.6vw, 3.125rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Signika, -apple-system, sans-serif"
    fontSize: "clamp(1.25rem, 1.05rem + 1vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Signika, -apple-system, sans-serif"
    fontSize: "clamp(0.9375rem, 0.9rem + 0.2vw, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Signika, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  stat:
    fontFamily: "Signika, -apple-system, sans-serif"
    fontSize: "clamp(1.875rem, 1.2rem + 3.4vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "32px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "28px"
  section: "64px"
  hero: "96px"
components:
  button-primary:
    backgroundColor: "{colors.electric-violet}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
  button-primary-lg:
    backgroundColor: "{colors.electric-violet}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    padding: "18px 34px"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
  button-outline:
    textColor: "{colors.electric-violet}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
  button-dark:
    backgroundColor: "{colors.midnight-navy}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
  card:
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "28px"
  card-feature:
    backgroundColor: "{colors.electric-violet}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "28px"
  chip:
    textColor: "{colors.electric-violet}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 18px"
  eyebrow:
    textColor: "{colors.electric-violet}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
---

# Design System: Digizelle

## 1. Overview

**Creative North Star: "The Encouraging Lens"**

Glass in Digizelle is a lens, not wallpaper. It is the rare, cared-for material — used on the header, on one focal hero panel, on a modal — where a soft frosted pane and a quiet bevel say *something here is special*. Everywhere else the page is calm and clear: clean white surfaces, a hairline border, generous space, a near-white canvas. Warmth comes from the brand violet used as a deliberate accent and from Signika's friendly letterforms, not from drenching every card in gradient. This is the visual answer to a real problem: an audience of young women often intimidated by tech needs an interface that feels welcoming and credible at once — never sterile, never childish, and never busy.

The system is **tactile and confident, but restrained**. Interactive cards lift gently on hover, the primary button carries one soft violet glow, mascots float and tilt, and motion uses a single liquid easing curve so the whole product moves like one substance. Density is generous: large headings (Signika at 700), roomy 28px card padding, 64–96px section rhythm. It is unmistakably premium — and the premium signal comes from restraint and finish, not from maxing every effect at once. The calm is the trust signal for a nonprofit courting partners and safeguarding sensitive mentorship data; the warmth keeps it human.

This system explicitly rejects four things. It is **not childish or edu-cutesy** (no primary-colour blocks, no comic type, the mascots stay sophisticated). It is **not crypto/AI-hype** (the aurora is a whisper, not neon-on-black; glass reads Apple-calm, not casino). It is **not generic AI slop** (no cream-and-serif editorial cliché, no eyebrow above every section, no endless identical icon-cards). And even in the logged-in app it is **not cold corporate SaaS** (no navy-and-gray Bootstrap admin, the warm brand follows the user from landing page into dashboard with no seam).

**Key Characteristics:**
- Clean solid surfaces by default; true glass reserved for chrome (header, modals) and rare hero focal points.
- One typeface (Signika) carrying the whole hierarchy through weight, not font-mixing.
- A calm near-white canvas; brand colour lands as accent (buttons, solid-violet emphasis, occasional drench bands), never as wallpaper.
- A single signature easing curve (`cubic-bezier(0.16, 1, 0.3, 1)`) across every transition.
- First-class dark theme via a `body.dz-theme-dark` cascade, deep `#0A0820` night canvas.
- Pill geometry for actions; soft 12–32px radii for surfaces.

## 2. Colors

A warm-cool duet: an electric violet leads, an aurora pink answers, a midnight navy grounds, all read against a true-white canvas (or a deep violet-black at night). A secondary near-monochrome shadcn baseline (`--background`/`--foreground` HSL, neutral-9) lives underneath for unstyled shadcn primitives, but the brand layer below is canonical and should win on every designed surface.

### Primary
- **Electric Violet** (#7301FF): The brand's voice. Primary buttons (as a 135° gradient into Violet Light), active nav, links on hover, focus rings, chip text, the aurora's dominant wash, and the violet wordmark gradient. Used with confidence, this is the colour people will remember Digizelle by.
- **Violet Light** (#A34BF5): The gradient partner. Lives at the far end of every violet gradient (buttons, feature cards, bands) and brightens the dark-theme aurora.
- **Violet Soft** (#C28BFA): Dark-theme accent text and eyebrow colour where full violet would vibrate against the night canvas.

### Secondary
- **Aurora Pink** (#F46FB1): The warm counter-light. Bottom-right specular lift on glass, the third aurora gradient, pink chips, and accents that keep the violet from feeling monotone. Never the dominant colour, it is the blush, not the base.

### Tertiary
- **Midnight Navy** (#24325F): The grounding structural colour. The cinematic footer, dark buttons, navy chips, and the deep base of shadow tints. It gives the airy glass something solid to stand on.
- **Navy Light** (#3A4A82): Navy's lighter step for gradients and secondary structural surfaces.

### Neutral
- **Ink** (#1A1F3A): Primary text. A near-black with a navy undertone so it belongs to the palette rather than fighting it. Headings and high-emphasis copy.
- **Ink Soft** (#545B7A): Body and secondary text. Verify against the *rendered* glass backdrop, not the token, before shipping (see the Frosted-Contrast Rule).
- **Ink Muted** (#8B91AD): Labels, captions, stat sub-labels, placeholders. Reserved for large or non-essential text; never primary reading copy on translucent glass.
- **Canvas** (#FFFFFF): The light body. Reads white even though three low-alpha aurora gradients sit on top of it.
- **Night Canvas** (#0A0820), **Night Header** (#14102A), **Night Panel** (#1A1240): The dark-theme stack, body, sticky header, and raised glass panels respectively.

### Named Rules
**The Calm-Canvas Rule.** The page rests on a near-white ground (#FCFBFE), not a coloured wash. Brand colour is rationed: buttons, solid-violet emphasis words, chips, and the occasional full-violet drench band — never an all-over gradient behind every surface. When everything is violet, nothing is.

**The Two-System Rule.** The shadcn HSL neutrals are a baseline for borrowed primitives only. On any Digizelle-designed surface, the brand tokens (`--brand-violet`, `--ink`, the glass tokens) are the source of truth. Do not let neutral-9 grey leak into branded UI.

## 3. Typography

**Display Font:** Signika (with `-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif`)
**Body Font:** Signika (same family)
**Label Font:** Signika (same family)

**Character:** One humanist sans, five weights (300–700), carries the entire system. Signika's slightly condensed, friendly letterforms read warm and modern without tipping into childish, exactly the encouraging-but-credible register the brand needs. Hierarchy comes from weight and scale contrast, not from mixing typefaces.

### Hierarchy
- **Display** (700, clamp 34→76px, line-height 1.04, letter-spacing -0.025em): Hero and page titles. Tight tracking, balanced wrap. The ceiling is 76px, the system never shouts above that.
- **Headline** (700, clamp 26→50px, line-height 1.08, -0.015em): Section titles.
- **Title** (600, clamp 20→30px, line-height 1.2): Card titles, sub-section heads.
- **Body** (400, ~17px, line-height 1.65, colour Ink Soft): Reading copy. Cap measure at 65–75ch.
- **Label** (600, 13px, letter-spacing 0.08em, UPPERCASE): Eyebrows, stat sub-labels, footer column heads. Short strings only (≤4 words).
- **Stat** (700, clamp 30→52px, line-height 1, -0.02em): Big numbers in stat tiles.

### Named Rules
**The One-Family Rule.** Signika does all the work. Do not introduce a second display or body typeface; reach for weight (300 vs 700) and scale before reaching for a new font. A mono fallback is permitted only for code/placeholder fixtures (`'SF Mono', ui-monospace`).

**The Quiet-Caps Rule.** Uppercase is for labels and the single `.dz-eyebrow` style only, tracked at 0.08em, never for sentences or body. One eyebrow style exists as a deliberate brand signature; it is not scaffolding to drop above every section.

## 4. Elevation

Surfaces are **flat and natural**: a solid fill, a single soft *neutral* shadow, a 1px hairline border — no glow, no blur, no bevel. Depth is rationed the same way colour is. **Cards and buttons carry no glass.** Glass (`backdrop-filter`) now survives only on true overlays — modals, popovers, the cookie toast — and as flat translucent tiles on a coloured hero (the programmes band). The old four-part stack — heavy blur + rainbow conic edge + pink specular + violet-glow shadow — is retired; maxed on every card it read as a toy. Audit test: if a resting card glows violet, blurs what's behind it, or shows a rainbow rim, it is over-elevated — flatten it to the hairline-border + soft-shadow default.

### Shadow Vocabulary
- **Card rest** (`border: 1px solid rgba(26,22,48,0.08)` + `box-shadow: 0 1px 2px rgba(26,22,48,0.04), 0 12px 28px -18px rgba(26,22,48,0.16)`): The default solid surface (`.dz-card`).
- **Recessed panel** (`background: #f7f6fb` + hairline + soft shadow): a wrapper that holds inner white cards (app preview, dashboard mock) so they don't go white-on-white.
- **Overlay glass** (`blur(22px) saturate(140%)` + near-solid fill): modals / popovers / toast only — the last sanctioned glass.
- **Interactive lift** (`translateY(-2px)` + a slightly deeper neutral shadow): hover on `.--interactive` surfaces.
- **Primary CTA glow** (`0 6px 18px -6px rgba(115,1,255,0.28)`): one soft violet halo, on the primary button only — the single sanctioned use of a coloured shadow.

### Named Rules
**The No-Glass-On-Components Rule.** Cards and buttons are flat solid surfaces, never frosted glass. `backdrop-filter` is allowed only on true overlays (modal, popover, toast) and on translucent tiles sitting on a coloured hero. If a card or button blurs what's behind it, it's wrong.

**The Lift-On-Intent Rule.** Resting cards do not lift. The `translateY(-2px)` + slightly deeper shadow is reserved for `.--interactive` surfaces (real click targets). Static cards stay grounded so motion stays meaningful.

## 5. Components

Material feel: **tactile and confident.** Components invite the press, glow, lift, and respond on a single liquid curve.

### Buttons
- **Shape:** Full pill (999px). The brand's action geometry.
- **Primary:** 135° gradient Electric Violet → Violet Light, white text, violet glow shadow, weight 600 / 14px / 0.02em. Padding 12px 22px (`-lg` 18px 34px, `-sm` 8px 16px).
- **Hover / Focus:** `translateY(-1px)` + deepened violet glow on hover; `:focus-visible` draws a 2px Electric Violet outline at 2px offset (system-wide).
- **Ghost:** Flat white, 1px hairline border (`rgba(26,22,48,0.12)`), Ink text, no glass. Hover lifts 1px to a faint tint. The quiet action.
- **Outline:** Transparent, 1.5px Electric Violet border + violet text. **Dark:** solid Midnight Navy + white, for footers/dark bands.

### Chips
- **Style:** Pill, violet-tint fill (`rgba(115,1,255,0.10)`), Electric Violet text, hairline violet border. Variants: `--pink` (aurora pink tint), `--navy` (navy tint), `--white` (for coloured backdrops).
- **State:** Static labels/tags; the segmented control (`.dz-seg`) handles selectable states, with the active pill flipping to white fill + violet text + soft shadow.

### Cards / Containers
- **Corner Style:** 24px (`--r-lg`), dropping to 18px on mobile.
- **Background:** Solid white (`#ffffff`) with a hairline border (`rgba(26,22,48,0.08)`) — for every card, including `.dz-lg` / `.dz-glass` (now flat, no blur). **Feature card:** violet gradient + white text, the deliberate accent, used sparingly. **On-colour tile:** flat translucent white on a coloured hero only.
- **Shadow Strategy:** One soft neutral shadow at rest; Interactive lift only with `.--interactive` (see Elevation). No violet glow on cards.
- **Border:** A real 1px hairline. **Nesting cards is prohibited**, and glass-in-glass doubly so.
- **Internal Padding:** 28px (`--r-lg` surfaces), 20px on mobile.

### Inputs / Fields
- **Style:** Translucent white (`rgba(255,255,255,0.65)`) + blur, 1px violet-tint border, 18px radius, 14px 18px padding.
- **Focus:** Border shifts to Electric Violet + a 4px violet glow ring (`0 0 0 4px rgba(115,1,255,0.12)`). Confident, not subtle.
- **Label:** 13px / 600 / Ink Soft. **Placeholder:** must clear body contrast on the glass, not the muted-grey default.

### Navigation
- **Header:** Sticky, solid (opaque white / `#14102A` dark) with a violet-gradient hairline bottom, so scrolling content never bleeds through. Nav links are pill-shaped, Ink Soft, hover/active to violet tint + violet text. Burger menu < 768px opens a right-side sheet.
- **Language / theme switchers:** deliberately *tiny and recessed* — a single current-language label (`FR`/`EN`, click to switch) and a single theme icon (sun/moon, click to flip). No track, no pill, no fill; faint grey (`#9aa0b5`) that re-inks on hover/focus. Two controls, not four. Header utilities must never out-shout the brand actions beside them.
- **App sidebar (`AppShell`):** 260px solid rail, logo + Mentora↔Community switcher + role-based nav + profile card; collapses to burger < 960px.

### Signature: the flat surface (`.dz-card` / `.dz-lg`)
The atom of the system is a solid card: white fill, a 1px hairline, one soft neutral shadow. `.dz-card` and `.dz-lg` (with `--strong` → recessed `#f7f6fb` panel, `--on-color` → flat translucent tile on colour, `--interactive` → 2px hover lift) all resolve to this flat treatment — no blur, no iridescent edge, no specular. Glass survives only in `.dz-modal` / `.dz-popover`. Build new surfaces from `.dz-card`; don't reintroduce the blur or rainbow edge.

### Signature: Mascot 3D
Floating, mouse-tilt mascots (`perspective: 1000px`, idle float, orbital badge satellites). Pure brand delight on desktop; hidden on mobile where they'd overlap content. Sophisticated and characterful, the playfulness lives here, never in the type or colour blocks.

## 6. Do's and Don'ts

### Do:
- **Do** default to solid `.dz-card` surfaces (white, hairline border, one soft shadow). Reach for glass (`.dz-lg`) only for chrome and at most one focal panel per page (the Rare-Lens Rule).
- **Do** keep the page on its calm near-white ground; ration brand colour to buttons, solid-violet emphasis, chips, and the occasional drench band (the Calm-Canvas Rule).
- **Do** carry the warm brand into the logged-in app. A dashboard or admin table is still Digizelle, glass surfaces, violet accents, Signika, not a grey template.
- **Do** drive every transition with the liquid curve `cubic-bezier(0.16, 1, 0.3, 1)`; use the spring `cubic-bezier(0.34, 1.56, 0.64, 1)` only for playful, opt-in moments.
- **Do** verify Ink Soft (#545B7A) and Ink Muted (#8B91AD) hit WCAG 2.2 AA against the *rendered* glass backdrop, not the token; bump toward Ink when close (the Frosted-Contrast Rule).
- **Do** ship a `prefers-reduced-motion: reduce` alternative for every animation, the aurora blobs, mascot float/tilt/orbit, scroll reveals, and the GSAP footer (already wired for `.dz-reveal`; keep new motion to the same standard).
- **Do** keep hierarchy in Signika's weights (300→700); reach for weight and scale before any second typeface (the One-Family Rule).
- **Do** encode status with icon/shape/text as well as colour (mentorship state, moderation, validation), never hue alone.

### Don't:
- **Don't** go childish or edu-cutesy, no primary-colour blocks, comic type, or kiddie-LMS energy. Friendly comes from warmth and the mascots, not from naivety.
- **Don't** drift into crypto/AI-hype, no neon-on-black, no aggressive gradients on every element, no hype copy. The aurora stays a whisper; glass stays Apple-calm.
- **Don't** produce generic AI slop, no cream-and-serif editorial cliché, no tiny uppercase eyebrow above every section, no endless identical icon+heading+text card grids, no gradient-text on headings. The violet wordmark gradient and the one `.dz-eyebrow` are deliberate signatures; do not multiply them into reflexive scaffolding.
- **Don't** let cold corporate SaaS in, even on product-register screens. No navy-and-gray Bootstrap admin; the brand follows the user from `/mentora` into `/mentora/dashboard` with no seam.
- **Don't** put glass, blur, or a coloured wash on every surface, or stack multiple effects (glass + gradient text + glow + aurora) on one element. Maxing every dial at once is exactly what read as amateur: one loud thing per view, the rest calm.
- **Don't** use gradient text on headings; emphasis is solid brand violet. (The wordmark is the only sanctioned gradient.)
- **Don't** nest glass inside glass; the refraction muddies and the depth reads as mud. One lens per layer.
- **Don't** use Ink Muted (#8B91AD) for primary reading copy on translucent surfaces; it fails contrast against the glass.
- **Don't** lift resting cards. The `translateY(-3px)` is reserved for true click targets (`.--interactive`).
- **Don't** let the shadcn neutral-9 baseline leak into branded UI; the brand tokens win on every designed surface (the Two-System Rule).
