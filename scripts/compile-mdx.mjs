import { evaluate } from "@mdx-js/mdx"
import * as runtime from "react/jsx-runtime"
import * as reactDom from "react-dom/server"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import React from "react"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const contentDir = path.join(__dirname, "..", "docs")
const outputDir = path.join(__dirname, "..", "compiled")

// Theme-aware color helpers — use CSS variables so both light/dark work
const t  = (k) => `var(--text-${k})`       // --text-primary, --text-secondary, etc.
const tp = () => t('primary')
const ts = () => t('secondary')
const tt = () => t('tertiary')
const tm = () => t('muted')

const stubComponents = {
  HeroBlock({ title, description, tags, difficulty, readTime }) {
    const diffConfig = { beginner: { label: "初级", dots: "⚫⚪⚪" }, intermediate: { label: "中级", dots: "⚫⚫⚪" }, advanced: { label: "高级", dots: "⚫⚫⚫" } }
    const diff = diffConfig[difficulty] || diffConfig.intermediate
    return React.createElement("div", { className: "relative mb-10 pb-8 border-b border-[var(--border-subtle)]" },
      React.createElement("div", { className: "absolute inset-0 -top-20 -mx-8 h-64 bg-gradient-to-b from-indigo-500/[0.04] to-transparent pointer-events-none" }),
      React.createElement("div", { className: "relative space-y-4" },
        React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
          React.createElement("span", { className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.68rem] font-semibold font-mono", style: { color: t('accent'), background: 'var(--accent-bg)' } }, diff.dots, " ", diff.label),
          ...(tags || []).map(tag => React.createElement("span", { key: tag, className: "inline-flex px-2 py-0.5 rounded-md text-[0.68rem] font-medium border", style: { color: tt(), background: 'var(--surface-bg)', borderColor: 'var(--border-subtle)' } }, tag))
        ),
        React.createElement("h1", { className: "font-display font-extrabold text-3xl tracking-[-0.03em]", style: { color: tp() } }, title),
        description && React.createElement("p", { className: "text-[0.9rem] leading-relaxed max-w-2xl", style: { color: tt() } }, description),
        React.createElement("div", { className: "flex items-center gap-4 text-[0.75rem]", style: { color: tm() } },
          React.createElement("span", null, "⏱ ", readTime || "8 min", " read"),
          React.createElement("span", null, "📊 ", difficulty === "beginner" ? "Foundational" : difficulty === "intermediate" ? "Intermediate" : "Advanced")
        )
      )
    )
  },

  TLDRBlock({ children }) {
    return React.createElement("div", { className: "glow-card p-5 my-8" },
      React.createElement("div", { className: "flex items-center gap-2 mb-3" },
        React.createElement("div", { className: "w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center" },
          React.createElement("span", { className: "text-xs", style: { color: t('accent') } }, "⚡")
        ),
        React.createElement("span", { className: "text-[0.75rem] font-semibold tracking-wide", style: { color: t('accent') } }, "TL;DR")
      ),
      React.createElement("div", { className: "text-[0.88rem] leading-relaxed", style: { color: ts() } }, children)
    )
  },

  ArchitectureBlock({ children, caption }) {
    return React.createElement("div", { className: "my-8 glass-card p-5" },
      React.createElement("div", { className: "flex items-center gap-2 mb-3" },
        React.createElement("span", { className: "text-xs", style: { color: tt() } }, "📦"),
        React.createElement("span", { className: "text-[0.75rem] font-semibold tracking-wide", style: { color: tt() } }, "Architecture")
      ),
      React.createElement("pre", { className: "overflow-x-auto text-[0.78rem] leading-relaxed font-mono whitespace-pre", style: { color: ts() } }, children),
      caption && React.createElement("p", { className: "mt-3 text-[0.72rem] text-center", style: { color: tm() } }, caption)
    )
  },

  CommandBlock({ command, label, lang, output }) {
    const cmd = typeof command === "string" ? command : ""
    return React.createElement("div", { className: "terminal-block my-6" },
      React.createElement("div", { className: "terminal-header" },
        React.createElement("span", { className: "terminal-dot", style: { background: "#ff5f56" } }),
        React.createElement("span", { className: "terminal-dot", style: { background: "#ffbd2e" } }),
        React.createElement("span", { className: "terminal-dot", style: { background: "#27c93f" } }),
        React.createElement("span", { className: "ml-2" }, label || "bash"),
        React.createElement("div", { className: "flex-1" }),
        React.createElement("span", { className: "text-[0.65rem]", style: { color: tm() } }, "Copy")
      ),
      React.createElement("pre", { className: "p-4 overflow-x-auto" },
        React.createElement("code", { className: "text-[0.8rem] font-mono leading-relaxed whitespace-pre", style: { color: ts() } }, cmd)
      ),
      output && React.createElement("div", { className: "border-t border-[var(--border-subtle)] px-4 py-3", style: { background: 'var(--surface-bg)' } },
        React.createElement("pre", { className: "text-[0.75rem] font-mono leading-relaxed overflow-x-auto whitespace-pre", style: { color: tt() } }, output)
      )
    )
  },

  CalloutBlock({ type, title, children }) {
    const configs = {
      note: { icon: "ℹ", label: "Note", accent: "var(--blue-400)" },
      warning: { icon: "⚠", label: "Warning", accent: "var(--amber-400)" },
      danger: { icon: "🚫", label: "Danger", accent: "var(--red-400)" },
      tip: { icon: "💡", label: "Tip", accent: "var(--emerald-400)" },
      interview: { icon: "💬", label: "Interview", accent: "var(--accent-light)" },
      production: { icon: "👁", label: "Production", accent: "var(--purple-400)" },
    }
    const c = configs[type] || configs.note
    return React.createElement("div", {
      className: "my-6 rounded-xl border border-[var(--border-subtle)] border-l-4 p-4",
      style: { borderLeftColor: c.accent, background: 'var(--surface-bg)' }
    },
      React.createElement("div", { className: "flex items-center gap-2 mb-2 text-[0.75rem] font-semibold tracking-wide", style: { color: c.accent } },
        c.icon, " ", title || c.label
      ),
      React.createElement("div", { className: "text-[0.85rem] leading-relaxed", style: { color: ts() } }, children)
    )
  },

  InterviewFocusBlock({ questions }) {
    const diffBadge = { beginner: { bg: "rgba(52,211,153,0.1)", color: "var(--emerald-400)", label: "初级" }, intermediate: { bg: "rgba(251,191,36,0.1)", color: "var(--amber-400)", label: "中级" }, advanced: { bg: "rgba(248,113,113,0.1)", color: "var(--red-400)", label: "高级" } }
    return React.createElement("div", { className: "my-8 space-y-3" },
      React.createElement("div", { className: "flex items-center gap-2 mb-4" },
        React.createElement("span", { className: "text-xs", style: { color: t('accent') } }, "🎯"),
        React.createElement("h2", { className: "text-[0.85rem] font-bold tracking-wide", style: { color: tp() } }, "Interview Focus")
      ),
      ...(questions || []).map((q, i) => {
        const badge = diffBadge[q.difficulty] || diffBadge.intermediate
        return React.createElement("div", { key: i, className: "glass-card p-4" },
          React.createElement("div", { className: "flex items-start justify-between gap-3 mb-2" },
            React.createElement("h3", { className: "text-[0.85rem] font-semibold", style: { color: tp() } }, "Q: ", q.q),
            React.createElement("span", { className: "shrink-0 px-1.5 py-0.5 rounded text-[0.62rem] font-semibold font-mono", style: { background: badge.bg, color: badge.color } }, badge.label)
          ),
          React.createElement("div", { className: "space-y-2 text-[0.78rem]" },
            React.createElement("div", { className: "flex items-start gap-2" },
              React.createElement("span", { className: "shrink-0 mt-0.5 text-xs", style: { color: "var(--amber-400)" } }, "💡"),
              React.createElement("span", { style: { color: ts(), fontWeight: 500 } }, "面试官意图: "),
              React.createElement("span", { style: { color: ts() } }, q.intent)
            ),
            React.createElement("div", { className: "flex items-start gap-2" },
              React.createElement("span", { className: "shrink-0 mt-0.5 text-xs", style: { color: t('accent') } }, "💬"),
              React.createElement("span", { style: { color: ts(), fontWeight: 500 } }, "回答建议: "),
              React.createElement("span", { style: { color: ts() } }, q.tip)
            )
          )
        )
      })
    )
  },

  TroubleshootingBlock({ issues }) {
    return React.createElement("div", { className: "my-8" },
      React.createElement("div", { className: "flex items-center gap-2 mb-4" },
        React.createElement("span", { className: "text-xs", style: { color: "var(--amber-400)" } }, "⚠"),
        React.createElement("h2", { className: "text-[0.85rem] font-bold tracking-wide", style: { color: tp() } }, "Common Issues")
      ),
      React.createElement("div", { className: "grid gap-2 sm:grid-cols-2" },
        ...(issues || []).map(issue =>
          React.createElement("div", { key: issue.name, className: "glass-card p-4" },
            React.createElement("code", { className: "text-[0.78rem] font-semibold font-mono", style: { color: "var(--red-400)" } }, issue.name),
            React.createElement("p", { className: "text-[0.75rem] mt-1.5 leading-relaxed", style: { color: tt() } }, issue.description)
          )
        )
      )
    )
  },

  ProductionAdviceBlock({ advice }) {
    const icons = { "best-practice": "✅", security: "🛡", scaling: "📈", monitoring: "📊" }
    const colors = { "best-practice": "var(--emerald-400)", security: "var(--amber-400)", scaling: "var(--blue-400)", monitoring: "var(--purple-400)" }
    return React.createElement("div", { className: "my-8" },
      React.createElement("div", { className: "flex items-center gap-2 mb-4" },
        React.createElement("span", { className: "text-xs", style: { color: tt() } }, "👁"),
        React.createElement("h2", { className: "text-[0.85rem] font-bold tracking-wide", style: { color: tp() } }, "Production Advice")
      ),
      React.createElement("div", { className: "grid gap-3 sm:grid-cols-2" },
        ...(advice || []).map(item => {
          const accent = colors[item.type] || "var(--emerald-400)"
          return React.createElement("div", { key: item.title, className: "glass-card p-4" },
            React.createElement("div", { className: "flex items-start gap-3" },
              React.createElement("div", { className: "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs", style: { background: 'var(--surface-bg)', color: accent } }, icons[item.type] || "•"),
              React.createElement("div", null,
                React.createElement("h3", { className: "text-[0.8rem] font-semibold", style: { color: ts() } }, item.title),
                React.createElement("p", { className: "text-[0.73rem] mt-1 leading-relaxed", style: { color: tt() } }, item.description)
              )
            )
          )
        })
      )
    )
  },
}

async function walk(dir) {
  const files = []
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return files }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
    } else if ((entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) && !fullPath.includes("superpowers")) {
      files.push(fullPath)
    }
  }
  return files
}

async function main() {
  const mdxFiles = await walk(contentDir)

  if (mdxFiles.length === 0) {
    console.log("No MDX files found in", contentDir)
    return
  }

  await fs.mkdir(outputDir, { recursive: true })

  for (const filePath of mdxFiles) {
    const source = await fs.readFile(filePath, "utf-8")

    let html
    try {
      const { default: MDXContent } = await evaluate(source, {
        ...runtime,
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
        Fragment: React.Fragment,
        useMDXComponents: () => stubComponents,
      })
      html = reactDom.renderToString(React.createElement(MDXContent))
    } catch (err) {
      console.error(`Error compiling ${filePath}:`, err.message)
      html = `<pre style="color:${t('tertiary')};padding:2rem">Failed to compile: ${err.message}\n\n${source.substring(0, 500)}</pre>`
    }

    const relative = path.relative(contentDir, filePath)
    const outPath = path.join(outputDir, relative.replace(/\.mdx$/, "").replace(/\.md$/, "") + ".json")

    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, JSON.stringify({ html }), "utf-8")

    console.log(`Compiled: ${relative} (${html.length} chars)`)
  }

  console.log(`\nDone! ${mdxFiles.length} files -> ${outputDir}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
