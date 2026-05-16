# Next.js 15 AI Native DevOps Platform — Design Spec

## Goal

Rewrite the Docusaurus-based DevOps Interview Guide as a Next.js 15 AI Native Knowledge Platform. Same content, entirely new frontend architecture.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Header (sticky, blurred, minimal)                        │
├────────┬──────────────────────────────┬──────────────────┤
│        │                              │                  │
│Sidebar │    Content Area              │   AI Sidebar     │
│240px   │    max-w-[820px]             │   288px          │
│        │                              │                  │
│• Tree  │  • Hero Block                │ • Chat Input     │
│• Search│  • TLDR Block                │ • Quick Actions  │
│• Active│  • Architecture Block        │ • AI Summary     │
│  State │  • Interview Focus Block      │ • Related Cmds   │
│        │  • Troubleshooting Block     │ • Learning Path  │
│        │  • Production Advice Block   │                  │
│        │  • Command Block             │                  │
│        │  • Callout Block             │                  │
│        │                              │                  │
└────────┴──────────────────────────────┴──────────────────┘
```

## Design System

- **Dark-first**: Background #0a0a0b, text rgba(255,255,255,0.78)
- **Accent**: Orange #ff6b35 (matches existing brand)
- **Typography**: Inter (body), JetBrains Mono (code), Noto Sans SC (Chinese)
- **Code blocks**: Terminal-style with header bar, copy button, Shiki highlighting
- **Cards**: rounded-2xl, subtle border, backdrop blur, hover animation
- **Background**: Grid pattern + radial gradient + glow effects
- **Spacing**: Generous whitespace, prose max-width 820px

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15 App Router | Required by spec, RSC support, ISR |
| Content | Velite + next-mdx-remote | Active maintenance, TS-native |
| Search | Pagefind | Zero-config, static, no API key |
| AI | Stub interfaces | UI complete, swap stubs for real API |
| Deployment | Static export (GitHub Pages) | Keep existing deploy flow |
| Migration | In-place, coexist with Docusaurus | Low risk, gradual cutover |

## What Changes

- **New**: Next.js app structure (`app/`, `components/`, `content/`, `lib/`)
- **Kept**: All 86 markdown files (converted to MDX with components)
- **Kept**: Git history, GitHub Pages deploy
- **Removed later**: Docusaurus files (`docusaurus.config.ts`, `sidebars.ts`, `src/`, `.docusaurus/`)

## Scope

Phase 1 (this plan): Core architecture + all components + homepage + Kubernetes module sample (12 files) + AI stubs + build verification.

Phase 2 (follow-up): Migrate remaining 9 modules (74 files), add search, Roadmap page, responsive polish.
