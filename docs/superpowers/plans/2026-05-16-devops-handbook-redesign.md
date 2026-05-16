# DevOps Handbook Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the DevOps Handbook Docusaurus site with a dark Editorial × Terminal aesthetic, replacing the generic purple gradient theme.

**Architecture:** Single-page Docusaurus app with custom CSS variables for theming. All changes are in configuration and presentation layer — no content restructuring. The design system lives in CSS custom properties; the homepage is React components with CSS modules.

**Tech Stack:** Docusaurus 3.5.2, React 18, CSS Modules, Google Fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono), Lucide React icons

---

### Task 1: Gitignore + Docusaurus Config

**Files:**
- Modify: `.gitignore`
- Modify: `docusaurus.config.ts`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Append to `.gitignore`:
```
.superpowers/
```

- [ ] **Step 2: Update docusaurus.config.ts — fonts, navbar, tagline**

Change the Google Fonts stylesheet links in `docusaurus.config.ts`:
```ts
// Replace the Inter font import with:
stylesheets: [
  {
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap",
    rel: "preload",
    as: "style",
  },
  {
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap",
    rel: "stylesheet",
    media: "print",
    onLoad: "this.media='all'",
  },
],
```

Change navbar title:
```ts
navbar: {
  title: "DevOps Handbook",
  // ... rest unchanged
}
```

Change tagline to be more concise:
```ts
tagline: "云原生 / SRE / Kubernetes / CI-CD 面试知识库 — 1000+ 高频题目，免费开源",
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore docusaurus.config.ts
git commit -m "chore: add .superpowers to gitignore, update fonts and config for redesign"
```

---

### Task 2: CSS Design System (custom.css)

**Files:**
- Modify: `src/css/custom.css` (full rewrite)

- [ ] **Step 1: Replace everything in custom.css with new design system**

Full rewrite with this structure:
```css
/* ── Google Fonts import (fallback) ────────────── */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

/* ── Design tokens ────────────────────────────── */
:root {
  /* Brand colors */
  --ifm-color-primary: #ff6b35;
  --ifm-color-primary-dark: #e85a26;
  --ifm-color-primary-darker: #d04e1f;
  --ifm-color-primary-darkest: #b84218;
  --ifm-color-primary-light: #ff7f4f;
  --ifm-color-primary-lighter: #ff9369;
  --ifm-color-primary-lightest: #ffa783;

  /* Typography */
  --ifm-font-family-base: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --ifm-font-family-monospace: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  --ifm-heading-font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --ifm-code-font-size: 90%;

  /* Background & surface - light mode defaults */
  --ifm-background-color: #ffffff;
  --ifm-background-surface-color: #f8f8f8;
  --ifm-navbar-background-color: rgba(255, 255, 255, 0.85);
  --ifm-footer-background-color: #0a0a0b;
  --ifm-code-background: rgba(0, 0, 0, 0.05);
  --docusaurus-highlighted-code-line-bg: rgba(0, 0, 0, 0.06);

  /* Text */
  --ifm-heading-color: #0a0a0b;
  --ifm-font-color-base: #333333;
  --ifm-color-emphasis-300: #e0e0e0;
  --ifm-color-emphasis-500: #999999;
  --ifm-color-emphasis-600: #666666;
  --ifm-color-emphasis-700: #4a4a4a;
  --ifm-color-emphasis-800: #333333;
  --ifm-menu-color: #666666;
  --ifm-toc-color: #666666;

  /* Borders & shadows */
  --card-border: rgba(0, 0, 0, 0.06);
  --card-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  --card-shadow-hover: 0 8px 24px rgba(255, 107, 53, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  --ifm-toc-border-color: rgba(0, 0, 0, 0.06);
  --ifm-menu-color-background-active: rgba(255, 107, 53, 0.08);

  /* Misc */
  --ifm-global-radius: 8px;
  --ifm-code-border-radius: 6px;
}

[data-theme='dark'] {
  --ifm-color-primary: #ff6b35;
  --ifm-color-primary-dark: #e85a26;
  --ifm-color-primary-darker: #d04e1f;
  --ifm-color-primary-darkest: #b84218;
  --ifm-color-primary-light: #ff7f4f;
  --ifm-color-primary-lighter: #ff9369;
  --ifm-color-primary-lightest: #ffa783;

  --ifm-background-color: #0a0a0b;
  --ifm-background-surface-color: #0e0e10;
  --ifm-navbar-background-color: rgba(10, 10, 11, 0.85);
  --ifm-code-background: rgba(255, 255, 255, 0.06);
  --docusaurus-highlighted-code-line-bg: rgba(255, 255, 255, 0.06);

  --ifm-heading-color: #ffffff;
  --ifm-font-color-base: rgba(255, 255, 255, 0.78);
  --ifm-color-emphasis-300: rgba(255, 255, 255, 0.1);
  --ifm-color-emphasis-500: rgba(255, 255, 255, 0.35);
  --ifm-color-emphasis-600: rgba(255, 255, 255, 0.45);
  --ifm-color-emphasis-700: rgba(255, 255, 255, 0.55);
  --ifm-color-emphasis-800: rgba(255, 255, 255, 0.65);
  --ifm-menu-color: rgba(255, 255, 255, 0.5);
  --ifm-toc-color: rgba(255, 255, 255, 0.35);

  --card-border: rgba(255, 255, 255, 0.06);
  --card-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  --card-shadow-hover: 0 8px 24px rgba(255, 107, 53, 0.12), 0 2px 4px rgba(0, 0, 0, 0.3);
  --ifm-toc-border-color: rgba(255, 255, 255, 0.06);
  --ifm-menu-color-background-active: rgba(255, 107, 53, 0.1);
}

/* ── Base styles ──────────────────────────────── */
html, body {
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:focus-visible {
  outline: 2px solid var(--ifm-color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

::selection {
  background: rgba(255, 107, 53, 0.25);
  color: inherit;
}

/* ── Navbar ────────────────────────────────────── */
.navbar {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--card-border);
  box-shadow: none;
}

[data-theme='dark'] .navbar {
  background: var(--ifm-navbar-background-color);
}

.navbar__title {
  font-family: var(--ifm-heading-font-family);
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
}

.navbar__link {
  font-weight: 500;
  font-size: 0.88rem;
}

.navbar__link--active {
  font-weight: 600;
  color: var(--ifm-color-primary);
}

/* ── Markdown content ──────────────────────────── */
.markdown h1:first-child {
  font-family: var(--ifm-heading-font-family);
  font-weight: 800;
  font-size: 2.25rem;
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
}

.markdown h2 {
  font-family: var(--ifm-heading-font-family);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.markdown h3 {
  font-weight: 600;
  letter-spacing: -0.01em;
}

.markdown p {
  line-height: 1.7;
  max-width: 660px;
}

.markdown a {
  color: var(--ifm-color-primary);
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.markdown a:hover {
  opacity: 0.8;
  text-decoration: underline;
}

/* ── Code blocks ───────────────────────────────── */
code {
  font-family: var(--ifm-font-family-monospace);
  font-size: 0.85em;
  border: 1px solid var(--card-border);
  padding: 0.15em 0.4em;
}

pre {
  border: 1px solid var(--card-border);
  border-radius: var(--ifm-global-radius);
  font-size: 0.82rem;
}

/* ── Tables ────────────────────────────────────── */
table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--card-border);
  border-radius: var(--ifm-global-radius);
  overflow: hidden;
  font-size: 0.88rem;
}

table th {
  padding: 0.6rem 0.85rem;
  border: none;
  border-bottom: 1px solid var(--card-border);
  background: rgba(255, 255, 255, 0.03);
  font-family: var(--ifm-heading-font-family);
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ifm-color-emphasis-600);
}

table td {
  padding: 0.6rem 0.85rem;
  border: none;
  border-bottom: 1px solid var(--card-border);
}

table tr:last-child td {
  border-bottom: none;
}

/* ── Admonitions ──────────────────────────────── */
.admonition {
  border-radius: var(--ifm-global-radius);
  border-left-width: 4px;
  box-shadow: none;
  border: 1px solid var(--card-border);
  border-left-color: var(--ifm-color-primary);
  margin: 1.5rem 0;
}

.admonition-heading h5 {
  font-family: var(--ifm-heading-font-family);
  font-weight: 700;
  font-size: 0.85rem;
}

/* ── Sidebar ───────────────────────────────────── */
.menu__link {
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.85rem;
  transition: all 0.15s ease;
  padding: 0.4rem 0.75rem;
}

.menu__link:hover {
  background: rgba(255, 107, 53, 0.06);
}

.menu__link--active {
  font-weight: 600;
  background: var(--ifm-menu-color-background-active) !important;
  color: var(--ifm-color-primary) !important;
}

.menu__list-item-collapsible:hover {
  background: rgba(255, 107, 53, 0.04);
}

/* ── Difficulty badges ─────────────────────────── */
.difficulty-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.55rem;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 600;
  font-family: var(--ifm-font-family-monospace);
  margin-right: 0.35rem;
}

.difficulty-beginner {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.difficulty-intermediate {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.difficulty-advanced {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* ── Company tag ───────────────────────────────── */
.company-tag {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 500;
  margin-right: 0.25rem;
  background: rgba(255, 255, 255, 0.04);
  color: var(--ifm-color-emphasis-600);
  border: 1px solid var(--card-border);
}

/* ── Breadcrumb ────────────────────────────────── */
.breadcrumbs__item--active .breadcrumbs__link {
  color: var(--ifm-color-primary);
  font-weight: 600;
}

/* ── Pagination nav ────────────────────────────── */
.pagination-nav__link {
  border: 1px solid var(--card-border);
  border-radius: var(--ifm-global-radius);
  transition: all 0.2s ease;
}

.pagination-nav__link:hover {
  border-color: var(--ifm-color-primary);
  background: rgba(255, 107, 53, 0.04);
}

.pagination-nav__label {
  font-family: var(--ifm-heading-font-family);
  font-weight: 600;
  font-size: 0.85rem;
}

.pagination-nav__sublabel {
  font-size: 0.8rem;
  color: var(--ifm-color-emphasis-500);
  margin-top: 0.15rem;
}

/* ── GitHub header link ────────────────────────── */
.header-github-link::before {
  content: '';
  width: 20px;
  height: 20px;
  display: flex;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%23666' d='M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'/%3E%3C/svg%3E") no-repeat center;
  transition: opacity 0.2s;
}

[data-theme='dark'] .header-github-link::before {
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%23rgba(255,255,255,0.6)' d='M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'/%3E%3C/svg%3E") no-repeat center;
}

.header-github-link:hover::before {
  opacity: 0.7;
}

/* ── Footer ────────────────────────────────────── */
.footer {
  background-color: var(--ifm-footer-background-color);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

[data-theme='dark'] .footer {
  background-color: #060607;
}

.footer__title {
  font-family: var(--ifm-heading-font-family);
  font-weight: 700;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.footer__link-item {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.2s ease;
}

.footer__link-item:hover {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
}

.footer__copyright {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.2);
}

/* ── Scrollbar ─────────────────────────────────── */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

[data-theme='light'] ::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
}

[data-theme='light'] ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

/* ── Animations ────────────────────────────────── */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ── Doc page title area ───────────────────────── */
.docTitle {
  font-family: var(--ifm-heading-font-family);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.docItemContainer .theme-doc-footer {
  margin-top: 3rem;
  border-top: 1px solid var(--card-border);
  padding-top: 1.5rem;
}

/* ── TOC sidebar ───────────────────────────────── */
.table-of-contents {
  font-size: 0.82rem;
  border-left: 1px solid var(--ifm-toc-border-color);
}

.table-of-contents__link {
  transition: color 0.15s ease;
}

.table-of-contents__link:hover {
  color: var(--ifm-color-primary);
}

.table-of-contents__link--active {
  font-weight: 600;
  color: var(--ifm-color-primary);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/css/custom.css
git commit -m "feat: implement new dark editorial-terminal design system"
```

---

### Task 3: Homepage Styles (index.module.css)

**Files:**
- Modify: `src/pages/index.module.css` (full rewrite)

- [ ] **Step 1: Rewrite index.module.css**

```css
/* ── Hero ────────────────────────────────────── */
.hero {
  position: relative;
  overflow: hidden;
  background: #0a0a0b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.heroContainer {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 0.9fr;
  gap: 0;
  min-height: 520px;
}

.heroContent {
  padding: 5rem 3rem 3rem 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.heroLabel {
  font-size: 0.7rem;
  font-weight: 600;
  color: #ff6b35;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  opacity: 0;
  animation: fade-in-up 0.6s ease forwards;
}

.heroTitle {
  font-size: clamp(2.2rem, 4.5vw, 3.5rem);
  font-weight: 900;
  color: white;
  line-height: 1.05;
  margin: 0 0 0.75rem 0;
  letter-spacing: -0.04em;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  opacity: 0;
  animation: fade-in-up 0.6s ease 0.1s forwards;
}

.heroAccent {
  color: #ff6b35;
}

.heroSubtitle {
  font-size: 0.92rem;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.7;
  margin: 0 0 1.75rem 0;
  max-width: 420px;
  opacity: 0;
  animation: fade-in-up 0.6s ease 0.15s forwards;
}

.heroButtons {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  opacity: 0;
  animation: fade-in-up 0.6s ease 0.2s forwards;
}

.primaryButton {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #ff6b35;
  color: white;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: none;
}

.primaryButton:hover {
  background: #e85a26;
  transform: translateY(-1px);
  color: white;
  text-decoration: none;
  box-shadow: 0 6px 20px rgba(255, 107, 53, 0.35);
}

.secondaryButton {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.secondaryButton:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  transform: translateY(-1px);
}

.terminalStrip {
  margin-top: 1.75rem;
  padding: 0.65rem 1rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 420px;
  opacity: 0;
  animation: fade-in-up 0.6s ease 0.3s forwards;
}

.terminalPrompt {
  color: #f59e0b;
  font-weight: 700;
}

.terminalPath {
  color: rgba(255, 255, 255, 0.5);
}

.terminalCursor {
  width: 0.4rem;
  height: 0.8rem;
  background: rgba(255, 255, 255, 0.3);
  animation: blink 1s step-end infinite;
  display: inline-block;
  vertical-align: text-bottom;
}

/* ── Terminal Panel (right column) ───────────── */
.terminalPanel {
  padding: 5rem 2.5rem 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.terminalBox {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  font-size: 0.7rem;
  line-height: 1.75;
  overflow: hidden;
  opacity: 0;
  animation: fade-in-up 0.6s ease 0.25s forwards;
}

.terminalBar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.65rem 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.2);
}

.terminalDot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.terminalDot[data-color="red"] { background: #ef4444; }
.terminalDot[data-color="yellow"] { background: #eab308; }
.terminalDot[data-color="green"] { background: #22c55e; }

.terminalBody {
  padding: 0.85rem 1rem;
}

.terminalLine {
  white-space: nowrap;
}

.terminalOutputDir {
  color: #06b6d4;
}

.terminalOutputComment {
  color: rgba(255, 255, 255, 0.2);
}

.terminalOutputPermissions {
  color: #22c55e;
}

.terminalLinePrompt {
  color: #f59e0b;
  font-weight: 700;
}

.terminalLineCmd {
  color: rgba(255, 255, 255, 0.8);
}

.terminalBlink {
  width: 0.35rem;
  height: 0.75rem;
  background: rgba(255, 255, 255, 0.3);
  animation: blink 1s step-end infinite;
  display: inline-block;
  vertical-align: text-bottom;
}

/* ── Stats Bar ────────────────────────────────── */
.statsBar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: #0a0a0b;
}

.statItem {
  padding: 1.15rem;
  text-align: center;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s ease;
}

.statItem:last-child {
  border-right: none;
}

.statItem:hover {
  background: rgba(255, 255, 255, 0.015);
}

.statNumber {
  font-size: 1.4rem;
  font-weight: 800;
  color: white;
  letter-spacing: -0.02em;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.statNumberAccent {
  font-size: 1.4rem;
  font-weight: 800;
  color: #ff6b35;
  letter-spacing: -0.02em;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.statLabel {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 500;
  margin-top: 0.15rem;
}

/* ── Section common ───────────────────────────── */
.section {
  padding: 4.5rem 2rem;
  background: #0a0a0b;
}

.sectionHeader {
  margin-bottom: 2.5rem;
}

.sectionTitle {
  font-size: 1.8rem;
  font-weight: 900;
  color: white;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.03em;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.sectionSubtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

/* ── Features Grid ────────────────────────────── */
.featuresGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.featureCard {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none !important;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.featureCard:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 107, 53, 0.2);
  background: rgba(255, 255, 255, 0.035);
}

.featureIconBox {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
  transition: all 0.3s ease;
}

.featureCard:hover .featureIconBox {
  transform: scale(1.05);
}

.featureTitle {
  font-size: 0.95rem;
  font-weight: 700;
  color: white;
  margin: 0;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.featureDescription {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.6;
  margin: 0;
  flex: 1;
}

.featureTags {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.3rem;
}

.featureTag {
  font-size: 0.6rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.35);
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
}

/* ── Learning Path ────────────────────────────── */
.learningGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.learningCard {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 2rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.learningCard:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 107, 53, 0.15);
  background: rgba(255, 255, 255, 0.035);
}

.learningStepLabel {
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 0.08em;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  margin-bottom: 0.75rem;
}

.learningTitle {
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.5rem 0;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.learningDescription {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.6;
  margin: 0;
}

/* ── CTA Section ──────────────────────────────── */
.ctaSection {
  padding: 4.5rem 2rem;
  background: #0a0a0b;
}

.ctaCard {
  max-width: 800px;
  margin: 0 auto;
  padding: 3rem;
  border: 1px solid rgba(255, 107, 53, 0.15);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.05), rgba(245, 158, 11, 0.02));
  text-align: center;
}

.ctaTitle {
  font-size: 1.6rem;
  font-weight: 900;
  color: white;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.03em;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.ctaDescription {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0 0 1.5rem 0;
}

.ctaButtons {
  display: flex;
  gap: 0.65rem;
  justify-content: center;
  flex-wrap: wrap;
}

.ctaSecondaryButton {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ctaSecondaryButton:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
}

/* ── General Layout ───────────────────────────── */
.pageWrapper {
  background: #0a0a0b;
  min-height: 100vh;
}

.sectionContainer {
  max-width: 1200px;
  margin: 0 auto;
}

/* ── Spacer for alt sections ──────────────────── */
.altSection {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

/* ── Responsive ───────────────────────────────── */
@media (max-width: 1024px) {
  .featuresGrid {
    grid-template-columns: repeat(2, 1fr);
  }

  .heroContainer {
    min-height: auto;
  }

  .terminalPanel {
    padding-left: 1.5rem;
  }
}

@media (max-width: 900px) {
  .heroContainer {
    grid-template-columns: 1fr;
  }

  .heroContent {
    padding: 3rem 1.5rem 0;
    text-align: center;
    align-items: center;
  }

  .heroSubtitle {
    max-width: 100%;
  }

  .heroButtons {
    justify-content: center;
  }

  .terminalStrip {
    max-width: 100%;
  }

  .terminalPanel {
    padding: 1.5rem;
  }

  .learningGrid {
    grid-template-columns: 1fr;
    max-width: 450px;
  }
}

@media (max-width: 768px) {
  .heroContent {
    padding: 2.5rem 1.25rem 0;
  }

  .statsBar {
    grid-template-columns: repeat(2, 1fr);
  }

  .statItem:nth-child(2) {
    border-right: none;
  }

  .statItem:nth-child(3) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .section {
    padding: 3rem 1.25rem;
  }

  .sectionTitle {
    font-size: 1.5rem;
  }

  .featuresGrid {
    gap: 0.75rem;
  }

  .featureCard {
    padding: 1.25rem;
  }

  .ctaCard {
    padding: 2rem 1.5rem;
  }

  .ctaSection {
    padding: 3rem 1.25rem;
  }

  .ctaButtons {
    flex-direction: column;
    align-items: center;
  }
}

@media (max-width: 600px) {
  .featuresGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .heroButtons {
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .primaryButton, .secondaryButton, .ctaSecondaryButton {
    width: 100%;
    justify-content: center;
  }

  .statsBar {
    grid-template-columns: repeat(2, 1fr);
  }

  .statItem:nth-child(2) {
    border-right: none;
  }
}

/* ── Reduced motion ───────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .heroLabel, .heroTitle, .heroSubtitle, .heroButtons, .terminalStrip,
  .terminalBox, .terminalCursor, .terminalBlink {
    animation: none;
    opacity: 1;
  }

  .featureCard:hover, .learningCard:hover {
    transform: none;
  }

  .statItem:hover {
    background: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/index.module.css
git commit -m "feat: add homepage styles with terminal-editorial design"
```

---

### Task 4: Homepage Component (index.tsx)

**Files:**
- Modify: `src/pages/index.tsx` (full rewrite)

- [ ] **Step 1: Rewrite index.tsx with new homepage layout**

```tsx
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import React from "react";
import {
  Terminal,
  Container,
  Ship,
  GitBranch,
  Activity,
  Gauge,
  Wrench,
  Cloud,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Star,
  Cpu,
  Shield,
} from "lucide-react";

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

import styles from "./index.module.css";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
  accent: string;
  tags: string[];
}

const features: Feature[] = [
  {
    icon: <Terminal size={16} />,
    title: "Linux",
    description: "Process management, memory analysis, CPU tuning, networking, shell scripting and systemd.",
    link: "/docs/linux/",
    accent: "#ff6b35",
    tags: ["Process", "Memory", "Network"],
  },
  {
    icon: <Container size={16} />,
    title: "Docker",
    description: "Multi-stage builds, network models, storage drivers, security best practices and optimization.",
    link: "/docs/docker/",
    accent: "#00a2ff",
    tags: ["Dockerfile", "Network"],
  },
  {
    icon: <Ship size={16} />,
    title: "Kubernetes",
    description: "Pod lifecycle, Service Mesh, Ingress controllers, ConfigMap, RBAC, and scheduling policies.",
    link: "/docs/kubernetes/",
    accent: "#6f4cff",
    tags: ["Pod", "Service", "Ingress"],
  },
  {
    icon: <GitBranch size={16} />,
    title: "CI/CD",
    description: "Pipeline design, GitHub Actions, Jenkins, ArgoCD, progressive delivery and rollback strategies.",
    link: "/docs/cicd/",
    accent: "#10b981",
    tags: ["Pipeline", "ArgoCD"],
  },
  {
    icon: <Activity size={16} />,
    title: "Monitoring",
    description: "Prometheus, Grafana dashboards, Loki logging, alerting rules, SLI metrics and on-call practices.",
    link: "/docs/monitoring/",
    accent: "#f59e0b",
    tags: ["Prometheus", "Grafana"],
  },
  {
    icon: <Gauge size={16} />,
    title: "SRE",
    description: "SLO/SLI/SLA design, incident management, observability, chaos engineering, disaster recovery.",
    link: "/docs/sre/",
    accent: "#a855f7",
    tags: ["SLO", "Incident"],
  },
  {
    icon: <Wrench size={16} />,
    title: "Scenarios",
    description: "Real-world troubleshooting: CPU spikes, memory leaks, network timeouts, pod crashes, DB slow queries.",
    link: "/docs/scenarios/",
    accent: "#06b6d4",
    tags: ["Debug", "Production"],
  },
  {
    icon: <Cloud size={16} />,
    title: "Terraform",
    description: "IaC fundamentals, state management, modular design, multi-provider orchestration and best practices.",
    link: "/docs/terraform/",
    accent: "#14b8a6",
    tags: ["IaC", "State"],
  },
];

function TerminalPanel() {
  return (
    <div className={styles.terminalPanel}>
      <div className={styles.terminalBox}>
        <div className={styles.terminalBar}>
          <span className={styles.terminalDot} data-color="red" />
          <span className={styles.terminalDot} data-color="yellow" />
          <span className={styles.terminalDot} data-color="green" />
          <span style={{ marginLeft: "0.5rem" }}>bash — 80×24</span>
        </div>
        <div className={styles.terminalBody}>
          <div className={styles.terminalLine}>
            <span className={styles.terminalLinePrompt}>$</span>{" "}
            <span className={styles.terminalLineCmd}>ls -la modules/</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>linux</span>{" "}
            <span className={styles.terminalOutputComment}># Process, Memory, CPU</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>docker</span>{" "}
            <span className={styles.terminalOutputComment}># Build, Network, Security</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>kubernetes</span>{" "}
            <span className={styles.terminalOutputComment}># Pod, Service, Ingress</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>cicd</span>{" "}
            <span className={styles.terminalOutputComment}># Pipeline, ArgoCD</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>monitoring</span>{" "}
            <span className={styles.terminalOutputComment}># Prometheus, Grafana</span>
          </div>
          <div style={{ marginTop: "0.3rem" }}>
            <span className={styles.terminalLinePrompt}>$</span>{" "}
            <span style={{ color: "rgba(255,255,255,0.4)" }}>_</span>
            <span className={styles.terminalBlink} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroContainer}>
        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>// devops-interview-guide</div>
          <Heading as="h1" className={styles.heroTitle}>
            Master Your{" "}
            <span className={styles.heroAccent}>DevOps</span> Interview
          </Heading>
          <p className={styles.heroSubtitle}>
            {siteConfig.tagline}
          </p>
          <div className={styles.heroButtons}>
            <Link className={styles.primaryButton} to="/docs/linux/">
              Start Learning
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              className={styles.secondaryButton}
              to="https://github.com/HT-MA/devops-interview-guide"
              aria-label="View on GitHub"
            >
              <GitHubIcon />
              GitHub
            </Link>
          </div>
          <div className={styles.terminalStrip}>
            <span className={styles.terminalPrompt}>$</span>
            <span>git clone </span>
            <span className={styles.terminalPath}>github.com/HT-MA/devops-interview-guide</span>
            <span className={styles.terminalCursor} />
          </div>
        </div>
        <TerminalPanel />
      </div>
    </header>
  );
}

function StatsBar() {
  const stats = [
    { number: "1000+", label: "Questions", accent: false },
    { number: "10", label: "Modules", accent: false },
    { number: "50+", label: "Scenarios", accent: false },
    { number: "Free", label: "Open Source", accent: true },
  ];

  return (
    <div className={styles.statsBar}>
      {stats.map((stat, i) => (
        <div key={i} className={styles.statItem}>
          <div className={stat.accent ? styles.statNumberAccent : styles.statNumber}>
            {stat.number}
          </div>
          <div className={styles.statLabel}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function FeatureCard({ icon, title, description, link, accent, tags }: Feature) {
  return (
    <Link className={styles.featureCard} to={link} aria-label={`${title} - ${description}`}>
      <div
        className={styles.featureIconBox}
        style={{
          background: `${accent}15`,
          border: `1px solid ${accent}25`,
          color: accent,
        }}
      >
        {icon}
      </div>
      <Heading as="h3" className={styles.featureTitle}>
        {title}
      </Heading>
      <p className={styles.featureDescription}>{description}</p>
      {tags.length > 0 && (
        <div className={styles.featureTags}>
          {tags.map((tag) => (
            <span key={tag} className={styles.featureTag}>{tag}</span>
          ))}
        </div>
      )}
    </Link>
  );
}

function FeaturesSection() {
  return (
    <section className={`${styles.section} ${styles.altSection}`}>
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader}>
          <Heading as="h2" className={styles.sectionTitle}>Core Modules</Heading>
          <p className={styles.sectionSubtitle}>Everything you need for DevOps interview prep</p>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((props, idx) => (
            <FeatureCard key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LearningPath() {
  const steps = [
    {
      step: "01",
      title: "Master the Fundamentals",
      description: "Browse 1000+ questions across all modules, from Linux basics to Kubernetes advanced topics.",
    },
    {
      step: "02",
      title: "Practice Real Scenarios",
      description: "Troubleshoot real production incidents: CPU spikes, memory leaks, network failures, and pod crashes.",
    },
    {
      step: "03",
      title: "Ace the Interview",
      description: "Cover big tech high-frequency topics and get the DevOps/SRE offer you deserve.",
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader}>
          <Heading as="h2" className={styles.sectionTitle}>Your Learning Path</Heading>
          <p className={styles.sectionSubtitle}>A structured approach to mastering DevOps interviews</p>
        </div>
        <div className={styles.learningGrid}>
          {steps.map((step, i) => (
            <div key={i} className={styles.learningCard}>
              <div className={styles.learningStepLabel}>STEP {step.step}</div>
              <Heading as="h3" className={styles.learningTitle}>{step.title}</Heading>
              <p className={styles.learningDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaCard}>
        <Heading as="h2" className={styles.ctaTitle}>Ready to Level Up?</Heading>
        <p className={styles.ctaDescription}>1000+ questions, 50+ real scenarios — all free and open source.</p>
        <div className={styles.ctaButtons}>
          <Link className={styles.primaryButton} to="/docs/linux/">
            Start Learning
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            className={styles.ctaSecondaryButton}
            to="https://github.com/HT-MA/devops-interview-guide"
            aria-label="Star on GitHub"
          >
            <Star size={16} aria-hidden="true" />
            Star on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title="DevOps Interview Handbook"
      description="云原生 / SRE / Kubernetes / CI-CD 面试知识库，包含 1000+ 高频题目和真实生产案例"
    >
      <div className={styles.pageWrapper}>
        <HomepageHeader />
        <StatsBar />
        <FeaturesSection />
        <LearningPath />
        <CTASection />
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Remove unused imports from index.tsx**

Remove these unused imports that were in the old file:
- `useState, useEffect, useRef` — not needed in new homepage (no count-up animations)
- `Cpu, Sparkles, Shield, Layers, GitPullRequest` — not used
- `BookOpen, Lightbulb, Cpu` — not used

The cleaner import block is already shown in Step 1 above.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.tsx
git commit -m "feat: rewrite homepage with editorial-terminal design"
```

---

### Task 5: DocPaginator Polish (Optional)

**Files:**
- Modify: `src/theme/DocPaginator/index.tsx`
- Modify: `src/theme/DocPaginator/styles.module.css`

- [ ] **Step 1: Update DocPaginator to use new design system styles**

The CSS in `custom.css` already handles `.pagination-nav__link` styling, but the custom overrides container can be updated:

```tsx
// In index.tsx — update to use modern link styling
import React from 'react';
import type { ComponentProps } from '@docusaurus/types';
import styles from './styles.module.css';

type Props = ComponentProps<'DocPaginator'>;

export default function DocPaginator(props: Props): JSX.Element {
  return (
    <nav className="pagination-nav" aria-label="文档分页">
      <div className={styles.paginatorContainer}>
        {props.previous && (
          <a className="pagination-nav__link" href={props.previous.permalink}>
            <div className="pagination-nav__label">← 上一页</div>
            <div className="pagination-nav__sublabel">{props.previous.label}</div>
          </a>
        )}
        {props.next && (
          <a className="pagination-nav__link" href={props.next.permalink}>
            <div className="pagination-nav__label">下一页 →</div>
            <div className="pagination-nav__sublabel">{props.next.label}</div>
          </a>
        )}
      </div>
    </nav>
  );
}
```

This component is already fine — no changes needed to the TSX. The CSS module can be kept as-is since pagination styles are handled globally in custom.css.

- [ ] **Step 2: Commit (if changes made)**

```bash
# Only if you actually modified files
git add src/theme/DocPaginator/
git commit -m "chore: polish DocPaginator styling"
```

---

### Task 6: Build & Verify

**Files:**
- None — build the project

- [ ] **Step 1: Build the project**

```bash
cd C:\Users\Todd\OneDrive\workspace\DevOps-Handbook && npm run build
```

Expected: Build succeeds with no errors. If there are TypeScript errors, fix them.

- [ ] **Step 2: Start dev server and visually verify**

```bash
cd C:\Users\Todd\OneDrive\workspace\DevOps-Handbook && npm start
```

Check in browser at localhost:3000:
- Hero renders with 2-column layout
- Terminal panel shows on the right
- Stats bar has 4 items
- Module cards are in a 4-column grid
- Learning path has 3 steps
- CTA card renders
- Dark mode and light mode both work
- Responsive layout at mobile widths
- Content pages render with correct sidebar styling
- Tables, code blocks, admonitions look correct

- [ ] **Step 3: Fix any issues found during verification**

If visual issues found, fix CSS and rebuild.

---

### Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Color palette (#0a0a0b, #ff6b35, etc.) | Task 2 (custom.css) |
| Typography (Plus Jakarta Sans, DM Sans, JetBrains Mono) | Task 1 + Task 2 |
| Navbar with logo mark | Task 1 + Docusaurus config (logo unchanged) |
| Hero 2-column layout | Task 3 (CSS) + Task 4 (component) |
| Terminal panel (right column) | Task 3 + Task 4 |
| Stats bar (4 columns) | Task 3 + Task 4 |
| Module cards grid | Task 3 + Task 4 |
| Learning path (3 steps) | Task 3 + Task 4 |
| CTA section | Task 3 + Task 4 |
| Content page dark sidebar | Task 2 (custom.css sidebar styles) |
| Content area styling (tables, admonitions, code) | Task 2 (custom.css content styles) |
| Responsive behavior | Task 3 (responsive breakpoints) |
| Reduced motion support | Task 3 (reduced motion queries) |
| DocPaginator polish | Task 5 |
| .gitignore .superpowers/ | Task 1 |
