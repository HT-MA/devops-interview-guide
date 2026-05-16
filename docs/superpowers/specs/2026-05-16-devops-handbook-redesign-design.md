# DevOps Handbook Redesign — Design Spec

## Overview

Complete visual and content redesign of the DevOps Interview Handbook Docusaurus site. The project is a Chinese/English bilingual interview preparation resource covering Linux, Docker, Kubernetes, CI/CD, Monitoring, SRE, scenarios, and Terraform.

## Design Direction: Editorial × Terminal

A hybrid aesthetic combining dark-mode magazine editorial design with subtle terminal/CLI motifs. Warm, not cold — orange/amber accents replace the previous purple gradient scheme.

### Rationale

| Factor | Decision |
|--------|----------|
| Audience | DevOps/SRE engineers — they live in terminals and docs |
| Differentiation | Avoid generic "AI startup" purple gradients, generic Inter font |
| Mood | Dark, confident, technical, premium |
| Key reference | Stripe docs × magazine editorial layout |

## Design System

### Color Palette

```
Bg primary:     #0a0a0b (near-black, warm)
Bg surface:     rgba(255,255,255,0.02-0.06) layered
Text primary:   #ffffff
Text secondary: rgba(255,255,255,0.5-0.55)
Text tertiary:  rgba(255,255,255,0.25-0.35)
Accent:         #ff6b35 (orange) — CTAs, highlights
Accent amber:   #f59e0b — terminal prompts, secondary highlights
Green:          #22c55e — terminal output, success states
Border:         rgba(255,255,255,0.06-0.1)
```

Module card accent colors (consistent with content categories):
- Linux: #ff6b35 (orange)
- Docker: #00a2ff (blue)
- K8s: #6f4cff (purple)
- CI/CD: #10b981 (green)
- Monitoring: #f59e0b (amber)
- SRE: #a855f7 (violet)
- Scenarios: #06b6d4 (cyan)
- Terraform: #14b8a6 (teal)

### Typography

| Role | Font | Weights |
|------|------|---------|
| Headings | Plus Jakarta Sans | 700, 800, 900 |
| Body | DM Sans | 400, 500, 600 |
| Code/Terminal | JetBrains Mono | 400, 500 |
| Base | 16px, line-height 1.6 | |

Explicitly avoids: Inter, Roboto, Arial, system-ui as primary fonts.

### Effects
- Border-radius: 6-10px for cards, 8px for buttons
- Subtle backdrop blur on navbar
- No heavy box-shadows — use thin borders to define surfaces
- Transition timing: 0.2-0.3s cubic-bezier

## Page Layouts

### Homepage

**Navigation bar:**
- Transparent/dark with backdrop blur
- Logo mark (orange gradient "D") + "DevOps Handbook" text
- Nav links: Modules, Scenarios, SRE, About
- GitHub icon on right

**Hero section (2-column):**
- Left: Tagline (`// devops-interview-guide`), bold headline ("Master Your DevOps Interview"), description, 2 CTAs (Start Learning, GitHub), terminal command strip at bottom
- Right: Terminal panel mockup showing `ls -la modules/` with folder listings
- Stats bar below hero: 4-column (1000+ Questions, 10 Modules, 50+ Scenarios, Free/Open Source)

**Core Modules section:**
- Section header + 8 module cards in 4-column grid
- Each card: colored icon box, title, description, topic tags
- Cards have subtle border, hover lift effect

**Learning Path section:**
- 3-step horizontal layout (Master Fundamentals → Practice Scenarios → Ace Interview)
- Numbered step markers in monospace

**CTA section:**
- Orange-tinted background card
- Headline + description + 2 CTAs
- Centered layout

**Footer:**
- Minimal: copyright + "Built with Docusaurus · Open Source"

### Content Pages (Documentation)

**Layout:** 2-column (sidebar + content)
- Sidebar: dark panel with module navigation and sub-page tree
- Active item highlighted with accent color

**Content area:**
- Breadcrumb in monospace (e.g. `Linux / CPU Analysis`)
- Page title (large, bold)
- Difficulty badge (Beginner/Intermediate/Advanced) with color coding
- Body text at readable measure (max ~660px width)
- Tables: dark bordered, subtle header row
- Admonitions/tips: bordered callout with icon
- Code blocks: dark background, syntax highlighted

### Responsive Behavior

- Mobile: single-column, stacked cards
- Tablet: 2-column card grid, adjusted padding
- Desktop: full layout as designed

## Files to Modify

- `docusaurus.config.ts` — update fonts, navbar title, tagline
- `src/css/custom.css` — complete color system, typography, global styles
- `src/pages/index.tsx` — full homepage rewrite
- `src/pages/index.module.css` — homepage styles
- `src/theme/DocPaginator/index.tsx` — optional polish
- `src/theme/DocPaginator/styles.module.css` — optional polish

## Out of Scope (for this pass)
- Content restructuring (changing actual markdown docs)
- Adding new features (search, blog, etc.)
- Theme component overrides beyond DocPaginator
