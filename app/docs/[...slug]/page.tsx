import { notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { RightSidebar } from "@/components/layout/RightSidebar"
import fs from "fs/promises"
import path from "path"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ slug: string[] }>
}

export async function generateStaticParams() {
  const contentDir = path.join(process.cwd(), "docs")
  const files: string[] = []

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if ((entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) && !fullPath.includes("superpowers")) {
          const relative = path.relative(contentDir, fullPath)
          files.push(relative.replace(/\.mdx$/, "").replace(/\.md$/, ""))
        }
      }
    } catch { /* directory may not exist */ }
  }

  await walk(contentDir)

  // Must return at least one param for static export
  if (files.length === 0) {
    return [{ slug: ["index"] }]
  }

  return files.map((slug) => ({ slug: slug.split(path.sep) }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const slugPath = slug.join("/")
  return {
    title: slugPath.split("/").pop()?.replace(/-/g, " ") || "Docs",
    description: `DevOps Handbook — ${slugPath}`,
  }
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params
  const slugPath = slug.join("/")

  let html: string
  try {
    const jsonPath = path.join(process.cwd(), "compiled", `${slugPath}.json`)
    const raw = await fs.readFile(jsonPath, "utf-8")
    html = JSON.parse(raw).html
  } catch {
    // Fallback when no compiled content exists
    if (slugPath === "index") {
      html = `<div class="text-center py-20"><h1 class="text-3xl font-bold text-white mb-3">Documentation</h1><p class="text-white/40">Content coming soon. Run <code class="text-indigo-400">npm run compile</code> to build docs.</p></div>`
    } else {
      notFound()
    }
  }

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
              <a href="/docs" className="text-white/30 hover:text-white/60 transition-colors">
                ← All Docs
              </a>
              <a href="/docs/kubernetes" className="text-white/30 hover:text-white/60 transition-colors">
                Kubernetes →
              </a>
            </div>
          </footer>
        </main>
        <RightSidebar />
      </div>
    </>
  )
}
