"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"

const stages = [
  { label: "Linux", done: true },
  { label: "Docker", done: true },
  { label: "Kubernetes", done: true },
  { label: "CI/CD", done: true },
  { label: "GitOps", done: false },
  { label: "Observability", done: false },
  { label: "Production", done: false },
]

export function DevOpsRoadmap() {
  return (
    <section id="roadmap" className="max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border-subtle)]">
      <div className="text-center mb-12 space-y-3">
        <h2 className="font-display font-extrabold text-3xl tracking-[-0.03em] text-[var(--text-primary)]">
          DevOps Roadmap
        </h2>
        <p className="text-[var(--text-tertiary)] text-sm max-w-md mx-auto">
          Your learning journey from fundamentals to production mastery
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        {stages.map((stage, i) => (
          <motion.div
            key={stage.label}
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                stage.done
                  ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-400"
                  : "bg-[var(--surface-bg)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
              }`}
            >
              {stage.done ? <Check size={16} /> : <span className="text-xs font-mono">{i + 1}</span>}
            </div>

            <span
              className={`text-sm font-medium ${
                stage.done ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
              }`}
            >
              {stage.label}
            </span>

            {i < stages.length - 1 && (
              <div className="flex-1 ml-6">
                <div
                  className={`h-px w-full ${
                    stage.done && stages[i + 1].done
                      ? "bg-indigo-500/30"
                      : stage.done
                      ? "bg-gradient-to-r from-indigo-500/30 to-[var(--border-subtle)]"
                      : "bg-[var(--border-subtle)]"
                  }`}
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  )
}
