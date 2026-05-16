# Next.js 15 AI Native DevOps Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Docusaurus DevOps Interview Guide as a Next.js 15 AI Native DevOps Knowledge Platform with three-column layout, MDX component system, and AI stub interfaces.

**Architecture:** Next.js 15 App Router with MDX content in `content/`, component system in `components/`, and a dark-first TailwindCSS design system. The layout follows a three-column pattern: collapsible docs sidebar (left), MDX content area (center), AI assistant sidebar (right). All AI features use stub interfaces with real API placeholder — UI is fully functional, AI calls return mock responses.

**Tech Stack:** Next.js 15 + React 19 + TypeScript + TailwindCSS + shadcn/ui + Framer Motion + next-mdx-remote + Velite

---

## File Structure

```
app/
  layout.tsx              # Root layout: providers + three-column shell
  page.tsx                # Homepage
  docs/[slug]/page.tsx    # Dynamic doc routes (MDX)
  globals.css             # Design tokens + global styles
components/
  layout/
    Header.tsx            # Top navbar (minimal, blurred)
    Sidebar.tsx           # Left sidebar (docs tree)
    AISidebar.tsx         # Right sidebar (AI assistant)
    RightSidebar.tsx      # Right sidebar (TOC fallback)
  mdx/
    HeroBlock.tsx         # Title + tags + difficulty + read time
    TLDRBlock.tsx         # Glow card AI summary
    ArchitectureBlock.tsx  # Mermaid diagram wrapper
    InterviewFocusBlock.tsx  # High-frequency questions
    TroubleshootingBlock.tsx # Issue cards
    ProductionAdviceBlock.tsx # Best practice cards
    CommandBlock.tsx       # Terminal-style code with copy
    CalloutBlock.tsx       # Note/Warning/Danger/Tip/Interview/Production
  ui/                      # shadcn/ui components (button, card, badge, etc.)
  home/
    HeroSection.tsx
    StatsBar.tsx
    ModuleCards.tsx
    LearningPath.tsx
    CTASection.tsx
    TerminalPanel.tsx
  ai/
    ChatInput.tsx          # AI question input
    QuickActions.tsx        # Explain/Interview/Troubleshoot buttons
    AISummary.tsx           # Auto-generated TL;DR
    RelatedCommands.tsx     # Terminal-style command references
    LearningPathAI.tsx      # AI-recommended next topics
lib/
  mdx.ts                   # MDX parsing + component mapping
  content.ts               # Content metadata (Velite)
  search.ts                # Pagefind search integration
  ai-stub.ts               # AI mock responses
  sidebar.ts               # Sidebar tree data
content/
  kubernetes/
    pod-lifecycle.mdx
    deployment.mdx
    ... (12 files)
tailwind.config.ts
tsconfig.json
next.config.mjs
package.json
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/globals.css`
- Create: `lib/utils.ts`
- Create: `components.json` (shadcn/ui config)

- [ ] **Step 1: Initialize Next.js 15 project manifest**

Create `package.json`:
```json
{
  "name": "devops-knowledge-platform",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-mdx-remote": "^5.0.0",
    "lucide-react": "^0.460.0",
    "framer-motion": "^11.12.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.1",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-collapsible": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.4",
    "rehype-pretty-code": "^0.14.0",
    "rehype-slug": "^6.0.0",
    "remark-gfm": "^4.0.0",
    "shiki": "^1.24.0",
    "mermaid": "^11.4.0",
    "pagefind": "^1.2.0",
    "velite": "^0.2.0"
  },
  "devDependencies": {
    "typescript": "~5.7.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20"
  }
}
```

- [ ] **Step 2: Create next.config.mjs**

```js
import createMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  images: { unoptimized: true },
}

export default withMDX(nextConfig)
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "build", ".docusaurus"]
}
```

- [ ] **Step 4: Create tailwind.config.ts**

```ts
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.mdx",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ff6b35",
          dark: "#e85a26",
          darker: "#d04e1f",
          light: "#ff7f4f",
          lighter: "#ff9369",
        },
        surface: {
          DEFAULT: "#0a0a0b",
          elevated: "#0e0e10",
          overlay: "#111113",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.06)",
          default: "rgba(255, 255, 255, 0.1)",
          strong: "rgba(255, 255, 255, 0.15)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "820px",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 107, 53, 0.1)" },
          "50%": { boxShadow: "0 0 40px rgba(255, 107, 53, 0.2)" },
        },
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 5: Create postcss.config.mjs**

```js
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
export default config
```

- [ ] **Step 6: Create lib/utils.ts (cn helper)**

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 7: Create shadcn/ui components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": false
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 8: Create app/globals.css (design system)**

Write the complete dark-first design system CSS (see separate artifact for the full ~300 line CSS file):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700&display=swap');

:root {
  --font-sans: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-display: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
}

/* Dark-first base */
body {
  background: #0a0a0b;
  color: rgba(255, 255, 255, 0.78);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Grid background pattern */
.grid-bg {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 64px 64px;
}

/* Glow effects */
.glow-orange {
  box-shadow: 0 0 40px rgba(255, 107, 53, 0.08), 0 0 80px rgba(255, 107, 53, 0.04);
}

/* Glass card */
.glass-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(16px);
  border-radius: 1rem;
}

/* Terminal code block */
.terminal-block {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.75rem;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
}

.terminal-dot { width: 10px; height: 10px; border-radius: 50%; }
.terminal-dot.red { background: #ff5f56; }
.terminal-dot.yellow { background: #ffbd2e; }
.terminal-dot.green { background: #27c93f; }

/* Content typography */
.prose h1 { font-family: var(--font-display); font-weight: 800; font-size: 2rem; letter-spacing: -0.03em; color: #fff; }
.prose h2 { font-family: var(--font-display); font-weight: 700; font-size: 1.25rem; letter-spacing: -0.02em; color: #fff; margin-top: 2.5rem; }
.prose p { line-height: 1.75; max-width: 820px; }
.prose a { color: #ff6b35; text-decoration: none; }
.prose a:hover { opacity: 0.8; }
.prose code { font-family: var(--font-mono); font-size: 0.85em; background: rgba(255,255,255,0.06); padding: 0.15em 0.4em; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06); }
.prose table { width: 100%; border-collapse: collapse; border: 1px solid rgba(255,255,255,0.06); border-radius: 0.5rem; overflow: hidden; font-size: 0.875rem; }
.prose th { padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.45); }
.prose td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.04); }
.prose tr:last-child td { border-bottom: none; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* Selection */
::selection { background: rgba(255,107,53,0.25); color: inherit; }

/* Focus */
:focus-visible { outline: 2px solid #ff6b35; outline-offset: 2px; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`

Expected: All packages install successfully.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json next.config.mjs tsconfig.json tailwind.config.ts postcss.config.mjs app/globals.css lib/utils.ts components.json
git commit -m "feat: scaffold Next.js 15 project with TailwindCSS and design tokens"
```

---

### Task 2: Root Layout + Providers

**Files:**
- Create: `app/layout.tsx`

- [ ] **Step 1: Create root layout with font loading + theme provider**

```tsx
import type { Metadata } from "next"
import "./globals.css"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: {
    default: "DevOps Handbook",
    template: "%s | DevOps Handbook",
  },
  description: "AI Native DevOps Knowledge Platform — 云原生面试知识库",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-Hans" className="dark" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0a0a0b] text-white/80 antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify dev server starts**

Run: `npm run dev`
Expected: Next.js dev server on localhost:3000, renders empty page.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add root layout with dark theme and fonts"
```

---

### Task 3: Header Component

**Files:**
- Create: `components/layout/Header.tsx`
- Modify: `app/layout.tsx` (add Header)

- [ ] **Step 1: Create Header component**

```tsx
"use client"

import Link from "next/link"
import { Search, BookOpen, Github } from "lucide-react"
import { useState } from "react"

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0b]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between h-12 px-5 max-w-[1800px] mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
              <BookOpen size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight text-white/90 group-hover:text-white transition-colors">
              DevOps Handbook
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/docs/kubernetes" className="px-3 py-1.5 text-[0.8rem] font-medium text-white/40 hover:text-white/70 transition-colors rounded-md hover:bg-white/[0.04]">
              Docs
            </Link>
            <Link href="/roadmap" className="px-3 py-1.5 text-[0.8rem] font-medium text-white/40 hover:text-white/70 transition-colors rounded-md hover:bg-white/[0.04]">
              Roadmap
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-[0.8rem] text-white/30 bg-white/[0.04] rounded-lg border border-white/[0.06] hover:border-white/[0.12] hover:text-white/50 transition-all"
          >
            <Search size={13} />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="hidden sm:inline ml-2 px-1.5 py-0.5 text-[0.65rem] text-white/20 bg-white/[0.04] rounded font-mono">
              ⌘K
            </kbd>
          </button>
          <a
            href="https://github.com/HT-MA/devops-interview-guide"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
            aria-label="GitHub"
          >
            <Github size={16} />
          </a>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Add Header to root layout**

Edit `app/layout.tsx` to import and render Header above `{children}`.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Header.tsx app/layout.tsx
git commit -m "feat: add header with nav, search button, and GitHub link"
```

---

### Task 4: Sidebar Component (Left)

**Files:**
- Create: `components/layout/Sidebar.tsx`
- Create: `lib/sidebar.ts` (sidebar tree data)
- Modify: `app/layout.tsx` (add Sidebar to doc pages)

- [ ] **Step 1: Create sidebar data**

Create `lib/sidebar.ts` with the complete 10-category tree from the existing `sidebars.ts`.

- [ ] **Step 2: Create Sidebar component**

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { sidebarTree, type SidebarCategory } from "@/lib/sidebar"

function CategoryItem({ category }: { category: SidebarCategory }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(
    category.items.some(item => pathname.includes(item.slug))
  )

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center w-full gap-1.5 px-3 py-1.5 text-[0.8rem] font-medium text-white/40 hover:text-white/60 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="flex items-center gap-2">
          <span className="text-[0.65rem] opacity-60">{category.icon}</span>
          {category.label}
        </span>
      </button>
      {open && (
        <div className="ml-5 mt-0.5 border-l border-white/[0.06]">
          {category.items.map((item) => (
            <Link
              key={item.slug}
              href={`/docs/${item.slug}`}
              className={cn(
                "block px-3 py-1.5 text-[0.78rem] text-white/35 hover:text-white/60 transition-colors rounded-r-md border-l-2 -ml-px",
                pathname === `/docs/${item.slug}`
                  ? "text-brand border-brand bg-brand/5"
                  : "border-transparent hover:border-white/10"
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-white/[0.06] h-[calc(100vh-3rem)] sticky top-12 overflow-y-auto py-4">
      <nav className="space-y-0.5 px-2">
        {sidebarTree.map((category) => (
          <CategoryItem key={category.label} category={category} />
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx lib/sidebar.ts
git commit -m "feat: add collapsible docs sidebar with 10 categories"
```

---

### Task 5: Right AI Sidebar

**Files:**
- Create: `components/layout/RightSidebar.tsx`
- Create: `components/ai/ChatInput.tsx`
- Create: `components/ai/QuickActions.tsx`
- Create: `components/ai/AISummary.tsx`
- Create: `components/ai/RelatedCommands.tsx`
- Create: `lib/ai-stub.ts`

- [ ] **Step 1: Create AI stub responses**

Create `lib/ai-stub.ts`:
```ts
export async function askAI(question: string): Promise<string> {
  // Stub: simulate AI response after short delay
  await new Promise(r => setTimeout(r, 800))
  return `这是关于 "${question}" 的 AI 回答。接口已预留，接入 API Key 后即可获得真实回答。`
}

export async function generateSummary(content: string): Promise<string> {
  await new Promise(r => setTimeout(r, 600))
  return "本文介绍了 Kubernetes Pod 生命周期的核心概念，包括 Pod 相位、Init Container、探针配置和生命周期钩子。面试重点在于理解 Pod 状态转换和故障排查。"
}

export async function explainLikeBeginner(topic: string): Promise<string> {
  await new Promise(r => setTimeout(r, 800))
  return `想象一下... ${topic} 就像是一个智能调度系统...`
}

export async function generateInterviewAnswer(topic: string): Promise<string> {
  await new Promise(r => setTimeout(r, 1000))
  return `面试官问 "${topic}" 时，建议从以下三个层面回答：\n1. 核心概念\n2. 实际应用\n3. 生产经验`
}

export async function troubleshoot(issue: string): Promise<{path: string[], commands: string[], causes: string[]}> {
  await new Promise(r => setTimeout(r, 1000))
  return {
    path: ["检查 Pod 状态", "查看事件日志", "确认资源限制", "检查镜像拉取"],
    commands: ["kubectl describe pod", "kubectl get events", "kubectl logs"],
    causes: ["镜像不存在", "资源不足", "配置错误", "网络问题"],
  }
}
```

- [ ] **Step 2: Create ChatInput component**

Terminal-style text input with send button.

- [ ] **Step 3: Create QuickActions component**

Buttons: Explain Simply, Interview Answer, Troubleshooting, Summarize.

- [ ] **Step 4: Create AISummary component**

Display TL;DR, key points, interview focus.

- [ ] **Step 5: Create RelatedCommands component**

Display kubectl/docker commands with copy button and terminal style.

- [ ] **Step 6: Create RightSidebar assembling all AI components**

```tsx
"use client"

import { ChatInput } from "@/components/ai/ChatInput"
import { QuickActions } from "@/components/ai/QuickActions"
import { AISummary } from "@/components/ai/AISummary"
import { RelatedCommands } from "@/components/ai/RelatedCommands"

export function RightSidebar() {
  return (
    <aside className="w-72 shrink-0 border-l border-white/[0.06] h-[calc(100vh-3rem)] sticky top-12 overflow-y-auto p-4 space-y-5">
      <ChatInput />
      <QuickActions />
      <AISummary />
      <RelatedCommands />
    </aside>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add components/layout/RightSidebar.tsx components/ai/ lib/ai-stub.ts
git commit -m "feat: add AI sidebar with chat, quick actions, summary, and commands"
```

---

### Task 6: MDX Component System

**Files:**
- Create: `components/mdx/HeroBlock.tsx`
- Create: `components/mdx/TLDRBlock.tsx`
- Create: `components/mdx/ArchitectureBlock.tsx`
- Create: `components/mdx/InterviewFocusBlock.tsx`
- Create: `components/mdx/TroubleshootingBlock.tsx`
- Create: `components/mdx/ProductionAdviceBlock.tsx`
- Create: `components/mdx/CommandBlock.tsx`
- Create: `components/mdx/CalloutBlock.tsx`
- Create: `components/mdx/index.ts` (barrel export)
- Create: `lib/mdx.ts` (MDX parsing + component mapping)

- [ ] **Step 1: Create HeroBlock**

Displays title, tags (difficulty, company), description, estimated read time with a gradient top section.

- [ ] **Step 2: Create TLDRBlock**

Glow card with orange accent border, AI-summary style content, key highlights in bold.

- [ ] **Step 3: Create ArchitectureBlock**

Wrapper around Mermaid diagram with loading state and dark theme.

- [ ] **Step 4: Create InterviewFocusBlock**

Question cards with difficulty badges, interviewer intent, and answer suggestions in a grid.

- [ ] **Step 5: Create TroubleshootingBlock**

Issue cards (Pod Pending, CrashLoopBackOff, etc.) with icon, description, and link to details.

- [ ] **Step 6: Create ProductionAdviceBlock**

Grid of advice cards: Best Practice, Security, Scaling, Monitoring.

- [ ] **Step 7: Create CommandBlock**

Terminal-style code block with header bar (dots + label), copy button, syntax highlighting via Shiki.

- [ ] **Step 8: Create CalloutBlock**

Six variants: Note, Warning, Danger, Tip, Interview, Production — each with distinct icon, color, and border.

- [ ] **Step 9: Create MDX parsing layer**

`lib/mdx.ts` with `compileMDX` wrapper and custom component mapping.

- [ ] **Step 10: Commit**

```bash
git add components/mdx/ lib/mdx.ts
git commit -m "feat: add MDX component system with 8 content blocks"
```

---

### Task 7: Docs Page + Dynamic Route

**Files:**
- Create: `app/docs/[slug]/page.tsx`
- Create: `lib/content.ts` (Velite content definitions)
- Create: `content/kubernetes/pod-lifecycle.mdx` (sample)

- [ ] **Step 1: Create Velite content config**

`lib/content.ts` defining doc schema with frontmatter fields.

- [ ] **Step 2: Create dynamic docs page**

```tsx
import { notFound } from "next/navigation"
import { compileMDX } from "@/lib/mdx"
import { mdxComponents } from "@/components/mdx"
import { Sidebar } from "@/components/layout/Sidebar"
import { RightSidebar } from "@/components/layout/RightSidebar"
import fs from "fs/promises"
import path from "path"

export default async function DocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const slugPath = Array.isArray(slug) ? slug.join("/") : slug

  let source: string
  try {
    source = await fs.readFile(
      path.join(process.cwd(), "content", `${slugPath}.mdx`),
      "utf-8"
    )
  } catch {
    notFound()
  }

  const { content, frontmatter } = await compileMDX(source)

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0 max-w-content mx-auto px-8 py-10">
        <article className="prose animate-fade-in">
          {content}
        </article>
        <footer className="mt-16 pt-6 border-t border-white/[0.06] flex justify-between">
          {/* Previous / Next nav */}
        </footer>
      </main>
      <RightSidebar />
    </div>
  )
}
```

- [ ] **Step 3: Migrate one sample MDX file**

Convert `docs/kubernetes/pod-lifecycle.md` to `content/kubernetes/pod-lifecycle.mdx` using the new component system.

- [ ] **Step 4: Commit**

```bash
git add app/docs/ lib/content.ts content/
git commit -m "feat: add dynamic docs route with three-column layout and sample content"
```

---

### Task 8: Homepage

**Files:**
- Create: `app/page.tsx`
- Create: `components/home/HeroSection.tsx`
- Create: `components/home/StatsBar.tsx`
- Create: `components/home/ModuleCards.tsx`
- Create: `components/home/LearningPath.tsx`
- Create: `components/home/CTASection.tsx`
- Create: `components/home/TerminalPanel.tsx`

- [ ] **Step 1: Create TerminalPanel**

Framer Motion animated terminal emulator showing `ls -la modules/` output.

- [ ] **Step 2: Create HeroSection**

Two-column hero: left has tagline, headline, subtitle, CTA buttons, git clone strip; right has TerminalPanel.

- [ ] **Step 3: Create StatsBar**

4 stats cards with counter animation.

- [ ] **Step 4: Create ModuleCards**

8 module cards in responsive grid with icon, title, description, tags, accent color.

- [ ] **Step 5: Create LearningPath**

3-step path cards: Fundamentals, Practice, Ace Interview.

- [ ] **Step 6: Create CTASection**

Glow card with CTA buttons.

- [ ] **Step 7: Create homepage assembling all sections**

```tsx
import { Header } from "@/components/layout/Header"
import { HeroSection } from "@/components/home/HeroSection"
import { StatsBar } from "@/components/home/StatsBar"
import { ModuleCards } from "@/components/home/ModuleCards"
import { LearningPath } from "@/components/home/LearningPath"
import { CTASection } from "@/components/home/CTASection"

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="grid-bg">
        <HeroSection />
        <StatsBar />
        <ModuleCards />
        <LearningPath />
        <CTASection />
      </main>
    </>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx components/home/
git commit -m "feat: add homepage with hero, stats, modules, and CTA"
```

---

### Task 9: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run production build**

Run: `npm run build`

- [ ] **Step 2: Fix any build errors**

Address TypeScript errors, missing imports, etc.

- [ ] **Step 3: Verify static output**

Run: `npm run start` and check localhost:3000 renders correctly.

- [ ] **Step 4: Final commit**

```bash
git commit -m "chore: fix build errors and verify production build"
```

---
