# YO Brand Tokens

Source: https://docs.yo.xyz/integrations/brand-kit

## Core Palette

| Token        | Hex       | Usage                          |
| ------------ | --------- | ------------------------------ |
| `--yo-neon`  | `#D6FF34` | Primary accent, CTAs, emphasis |
| `--yo-black` | `#000000` | Primary background             |
| `--yo-dark`  | `#2B2C2A` | Cards, surfaces, elevated bg   |
| `--yo-white` | `#FFFFFF` | Primary text on dark           |
| `--yo-muted` | `#A0A0A0` | Secondary text, captions       |

## Vault Product Colors

Each yoVault has a dedicated color. Use these when displaying
vault-specific data, charts, or product sections:

| Vault  | Token       | Hex       | Name             |
| ------ | ----------- | --------- | ---------------- |
| yoETH  | `--yo-eth`  | `#2B2C2A` | Electric Blue    |
| yoUSD  | `--yo-usd`  | `#00FF8B` | Neon Green       |
| yoBTC  | `--yo-btc`  | `#FFAF4F` | Lightning Orange |
| yoEUR  | `--yo-eur`  | `#4E6FFF` | Brussels Blue    |
| yoGOLD | `--yo-gold` | `#FFBF00` | Yield Yellow     |
| yoSOL  | `--yo-sol`  | `#DA6AFF` | IBRL Purple      |

## Typography

- **Primary font**: Space Grotesk (headings, subheadings, body)
- **Fallback**: system-ui, sans-serif (code environments only)
- **Weights**: Medium/Semibold for titles, Regular for body
- **Style**: Generous whitespace, clean hierarchy
- **Forbidden**: serif, script, or stylistic substitutes

### Tailwind v4 Font Setup

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

@theme {
  --font-sans: 'Space Grotesk', system-ui, sans-serif;
}
```

## Tailwind v4 Theme Config

```css
@theme {
  /* Core */
  --color-yo-neon: #D6FF34;
  --color-yo-black: #000000;
  --color-yo-dark: #2B2C2A;

  /* Vault colors */
  --color-yo-usd: #00FF8B;
  --color-yo-btc: #FFAF4F;
  --color-yo-eur: #4E6FFF;
  --color-yo-gold: #FFBF00;
  --color-yo-sol: #DA6AFF;

  /* Typography */
  --font-sans: 'Space Grotesk', system-ui, sans-serif;
}
```

This gives you classes like `bg-yo-neon`, `text-yo-btc`,
`font-sans`, etc.

## Logo Rules

### Two Official Variants Only

1. Neon background (`#D6FF34`) + black wordmark
1. Black background (`#2B2C2A`) + neon wordmark

### Spacing

Minimum clearance around logo: half the wordmark height.

## Brand Restrictions

These are hard rules from the brand kit — not style preferences:

- **No gradients** on logos or brand colors
- **No mascots**, characters, or fictional elements
- **No AI-generated logo variants**
- **No color modifications** or tinting of brand colors
- **No dual-tone overlays** or recolored variants
