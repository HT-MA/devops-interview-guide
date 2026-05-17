import { notFound } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { RightSidebar } from "@/components/layout/RightSidebar"
import { sidebarTree } from "@/lib/sidebar"
import fs from "fs/promises"
import path from "path"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ slug?: string[] }>
}

export async function generateStaticParams() {
  const contentDir = path.join(process.cwd(), "docs")
  const slugs: { slug: string[] }[] = [{ slug: [] }]
  const categories = new Set<string>()

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if ((entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) && !fullPath.includes("superpowers")) {
          const relative = path.relative(contentDir, fullPath)
          const slugParts = relative.replace(/\.mdx$/, "").replace(/\.md$/, "").split(path.sep)
          slugs.push({ slug: slugParts })
          if (slugParts.length >= 1) categories.add(slugParts[0])
        }
      }
    } catch { /* directory may not exist */ }
  }

  await walk(contentDir)

  for (const cat of categories) {
    slugs.push({ slug: [cat] })
  }

  return slugs
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!slug || slug.length === 0) {
    return { title: "All Docs — DevOps Handbook", description: "DevOps interview knowledge base" }
  }
  if (slug.length === 1) {
    const category = sidebarTree.find((c) => c.items.some((i) => i.slug.startsWith(slug[0])))
    return { title: `${category?.label || slug[0]} — DevOps Handbook`, description: `Articles in ${slug[0]}` }
  }
  return {
    title: slug.join(" / ").replace(/-/g, " "),
    description: `DevOps Handbook — ${slug.join("/")}`,
  }
}

function CategoryIndex({ slug }: { slug: string }) {
  const category = sidebarTree.find((c) => c.items.some((i) => i.slug.startsWith(slug)))
  if (!category) return null

  const items = category.items.filter((i) => i.slug.startsWith(slug + "/") || i.slug === slug)

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">Category</p>
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.02em] text-[var(--text-primary)]">
          <span className="mr-2">{category.icon}</span>{category.label}
        </h1>
        <p className="text-[var(--text-tertiary)] text-sm mt-2">{items.length} articles</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`/docs/${item.slug}`}
            className="glass-card p-4 block group hover:border-[var(--border-default)] transition-all"
          >
            <h3 className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-brand transition-colors">
              {item.title}
            </h3>
          </Link>
        ))}
      </div>
    </div>
  )
}

function AllDocsIndex() {
  const totalArticles = sidebarTree.reduce((acc, c) => acc + c.items.length, 0)

  return (
    <div className="animate-fade-in">
      <div className="mb-10">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.02em] text-[var(--text-primary)] mb-2">
          Documentation
        </h1>
        <p className="text-[var(--text-tertiary)] text-sm">
          DevOps interview knowledge base — {totalArticles} articles across {sidebarTree.length} categories
        </p>
      </div>
      <div className="space-y-8">
        {sidebarTree.map((cat) => {
          const catSlug = cat.items[0]?.slug.split("/")[0] || ""
          return (
            <div key={cat.label}>
              <Link
                href={`/docs/${catSlug}`}
                className="inline-flex items-center gap-2 mb-3 group"
              >
                <span className="text-lg">{cat.icon}</span>
                <h2 className="font-semibold text-[var(--text-primary)] group-hover:text-brand transition-colors">
                  {cat.label}
                </h2>
                <span className="text-[0.7rem] text-[var(--text-muted)]">{cat.items.length} articles</span>
              </Link>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {cat.items.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/docs/${item.slug}`}
                    className="text-[0.8rem] text-[var(--text-tertiary)] hover:text-brand transition-colors py-1 block"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params

  // Empty slug → All Docs index
  if (!slug || slug.length === 0) {
    return (
      <>
        <Header />
        <div className="flex max-w-[1800px] mx-auto">
          <Sidebar />
          <main className="flex-1 min-w-0 px-6 lg:px-10 py-10">
            <article className="max-w-content mx-auto">
              <AllDocsIndex />
            </article>
          </main>
          <RightSidebar />
        </div>
      </>
    )
  }

  const slugPath = slug.join("/")

  // Single segment → category index
  if (slug.length === 1) {
    return (
      <>
        <Header />
        <div className="flex max-w-[1800px] mx-auto">
          <Sidebar />
          <main className="flex-1 min-w-0 px-6 lg:px-10 py-10">
            <article className="max-w-content mx-auto">
              <CategoryIndex slug={slug[0]} />
            </article>
          </main>
          <RightSidebar />
        </div>
      </>
    )
  }

  // Multi-segment → article
  let html: string
  try {
    const jsonPath = path.join(process.cwd(), "compiled", `${slugPath}.json`)
    const raw = await fs.readFile(jsonPath, "utf-8")
    html = JSON.parse(raw).html
  } catch {
    notFound()
  }

  const parentCategory = slug[0]

  return (
    <>
      <Header />
      <div className="flex max-w-[1800px] mx-auto">
        <Sidebar />
        <main className="flex-1 min-w-0 px-6 lg:px-10 py-10">
          <article
            className="max-w-content mx-auto prose animate-fade-in"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <footer className="max-w-content mx-auto mt-16 pt-6 border-t border-white/[0.06]">
            <div className="flex justify-between items-center text-[0.8rem]">
              <Link href="/docs" className="text-white/30 hover:text-white/60 transition-colors">
                ← All Docs
              </Link>
              <Link href={`/docs/${parentCategory}`} className="text-white/30 hover:text-white/60 transition-colors">
                {parentCategory} →
              </Link>
            </div>
          </footer>
        </main>
        <RightSidebar />
      </div>
    </>
  )
}
