"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { sidebarTree, type SidebarCategory } from "@/lib/sidebar"

function CategoryItem({ category }: { category: SidebarCategory }) {
  const pathname = usePathname()
  const isActive = category.items.some((item) =>
    pathname.includes(`/docs/${item.slug}`)
  )
  const [open, setOpen] = useState(isActive)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center w-full gap-1.5 px-3 py-1.5 text-[0.8rem] font-medium transition-colors rounded-md",
          isActive
            ? "text-[var(--text-secondary)]"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        )}
      >
        {open ? (
          <ChevronDown size={12} className="shrink-0" />
        ) : (
          <ChevronRight size={12} className="shrink-0" />
        )}
        <span className="flex items-center gap-2 truncate">
          <span className="text-[0.65rem] opacity-60">{category.icon}</span>
          {category.label}
        </span>
      </button>
      {open && (
        <div className="ml-5 mt-0.5 border-l border-[var(--border-subtle)]">
          {category.items.map((item) => (
            <Link
              key={item.slug}
              href={`/docs/${item.slug}`}
              className={cn(
                "block px-3 py-1.5 text-[0.78rem] transition-colors rounded-r-md border-l-2 -ml-px",
                pathname === `/docs/${item.slug}`
                  ? "text-brand border-brand bg-[var(--accent-bg)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border-transparent hover:border-[var(--border-default)]"
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
    <aside className="w-60 shrink-0 border-r border-[var(--border-subtle)] h-[calc(100vh-3rem)] sticky top-12 overflow-y-auto py-4 hidden lg:block">
      <div className="px-3 mb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Documentation
        </p>
      </div>
      <nav className="space-y-0.5 px-2">
        {sidebarTree.map((category) => (
          <CategoryItem key={category.label} category={category} />
        ))}
      </nav>
    </aside>
  )
}
