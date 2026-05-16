"use client"

import Link from "next/link"
import { Search, BookOpen, Github } from "lucide-react"
import { ThemeToggle } from "./ThemeToggle"

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--header-bg)] backdrop-blur-xl">
      <div className="flex items-center justify-between h-12 px-5 max-w-[1800px] mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
              <BookOpen size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight text-[var(--text-primary)] opacity-90 group-hover:opacity-100 transition-opacity">
              DevOps Handbook
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/docs/kubernetes"
              className="px-3 py-1.5 text-[0.8rem] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors rounded-md hover:bg-[var(--surface-bg)]"
            >
              Docs
            </Link>
            <Link
              href="/roadmap"
              className="px-3 py-1.5 text-[0.8rem] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors rounded-md hover:bg-[var(--surface-bg)]"
            >
              Roadmap
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-[0.8rem] text-[var(--text-muted)] bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:text-[var(--text-tertiary)] transition-all">
            <Search size={13} />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="hidden sm:inline ml-2 px-1.5 py-0.5 text-[0.65rem] text-[var(--text-muted)] bg-[var(--surface-bg)] rounded font-mono">
              ⌘K
            </kbd>
          </button>
          <a
            href="https://github.com/HT-MA/devops-interview-guide"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="GitHub"
          >
            <Github size={16} />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
