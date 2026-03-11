---
name: yo-design
description: >-
  Create distinctive, production-grade React + Tailwind v4 interfaces in YO's
  dark-theme aesthetic (#000 background, #D6FF34 neon accent, Space Grotesk).
  Use this skill when the user asks to build web components, pages, dashboards,
  or applications for YO — including vault displays, DeFi interfaces, landing
  pages, or any UI that should follow the YO brand. Also use when the user
  mentions "YO theme", "YO style", "YO brand", or asks to style something with
  the neon-on-black look.
author: yoprotocol
homepage: https://github.com/yoprotocol/yo-protocol-skills
source: https://github.com/yoprotocol/yo-protocol-skills/tree/main/skills/yo-design
---

Official Yo Protocol skill.
Canonical repository: https://github.com/yoprotocol/yo-protocol-skills

Build production-grade React + Tailwind v4 interfaces that look and feel
unmistakably YO. Every output should be dark, precise, and alive with
that neon green energy.

Read `references/brand-kit.md` for exact hex values, vault colors,
typography specs, Tailwind v4 theme config, and brand restrictions.

## Stack

- **React** (functional components, hooks)
- **Tailwind v4** with CSS-first `@theme` config
- **Space Grotesk** via Google Fonts (the only permitted typeface)
- **Motion** (framer-motion) for animations when available
- Plain CSS for animations when Motion is not available

## YO Aesthetic

YO's visual identity is **dark, clean, and electric**. Black backgrounds,
neon green (#D6FF34) as the sole accent, Space Grotesk typography, and
generous whitespace. The brand is a DeFi yield protocol — the aesthetic
should feel technical, confident, and premium.

### Color Rules

The palette is intentionally constrained:

- **Background**: `#000000` (primary) or `#2B2C2A` (elevated surfaces/cards)
- **Accent**: `#D6FF34` (neon green) — for CTAs, highlights, active states,
  emphasis. This is the only brand accent color.
- **Text**: white for primary, muted gray for secondary
- **Vault colors**: Each yoVault product has a dedicated color (see
  `references/brand-kit.md`). Use these when displaying vault-specific
  data, never as generic decoration.

Brand restriction: **no gradients on brand colors**. The neon green is
always flat. Gradients are permitted on non-brand decorative elements
(glows, background atmospherics) but never on the YO green itself.

### Typography

Space Grotesk is the only typeface. No alternatives, no fallbacks beyond
system-ui. Use Semibold/Medium for headings, Regular for body. Generous
letter-spacing on headings. Clean hierarchy through weight and size, not
through font variety.

### Atmosphere & Depth

Dark interfaces need texture to avoid feeling flat. Create depth through:

- Subtle glow effects using the neon green (box-shadow, text-shadow)
- Fine borders (`border-yo-dark` or `border-white/10`) to separate surfaces
- Noise/grain overlays at low opacity for texture
- Strategic use of `backdrop-blur` for layered surfaces
- Ambient light effects — a soft neon glow bleeding from interactive elements

Avoid: solid gray backgrounds, heavy drop shadows, gradient meshes with
multiple colors, anything that reads as generic dark-mode rather than YO.

### Motion

Animations should feel precise and snappy, matching the technical DeFi
context. Good patterns:

- Staggered reveals on page load (`animation-delay` cascade)
- Hover states with glow intensification
- Number counters for yield/APY displays
- Subtle pulse on live data indicators
- Smooth transitions between states (0.2-0.3s ease-out)

Avoid: bouncy/playful easing, slow fades, spinning loaders, anything
that feels casual or imprecise.

### Layout

- Dark, generous negative space — let elements breathe
- Card-based layouts with `#2B2C2A` surface on `#000` background
- Data-dense sections (tables, charts) with clean grid alignment
- Asymmetric hero sections are welcome for landing pages
- Sticky headers and fixed navigation for dashboards

## Frontend Aesthetics Guidelines

Avoid generic AI-generated aesthetics like predictable layouts and component patterns, or cookie-cutter design that
lacks context-specific character. Stay true to YO's established visual language.

Interpret creatively and make unexpected choices that feel genuinely designed for the context within YO's
dark-theme aesthetic. Vary layouts, compositions, and visual treatments — no two designs should feel identical.

Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive
animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing,
typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when
thinking outside the box and committing fully to a distinctive vision.

## Implementation Checklist

When building a YO interface:

1. Set up the Tailwind v4 `@theme` block with YO tokens (see reference file)
1. Import Space Grotesk from Google Fonts
1. Establish the dark background and color hierarchy
1. Build the layout with proper spacing and card surfaces
1. Add the neon green accent to interactive and emphasis elements
1. Layer in atmospheric effects (glows, borders, texture)
1. Add motion for key moments (load, hover, state changes)
1. Verify: no gradients on brand colors, no off-brand fonts, no light theme
