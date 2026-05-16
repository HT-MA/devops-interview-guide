"use client"

import { useState } from "react"
import { BookOpen, MessageSquare, Wrench, Sparkles } from "lucide-react"
import {
  explainLikeBeginner,
  generateInterviewAnswer,
  troubleshoot,
} from "@/lib/ai-stub"

export function QuickActions() {
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState("")

  async function run(name: string, fn: () => Promise<unknown>) {
    setLoading(name)
    setResult("")
    const output = await fn()
    setResult(
      typeof output === "string" ? output : JSON.stringify(output, null, 2)
    )
    setLoading("")
  }

  const buttons = [
    {
      label: "Explain Simply",
      icon: <BookOpen size={12} />,
      action: () => explainLikeBeginner("Kubernetes Pod"),
    },
    {
      label: "Interview Answer",
      icon: <MessageSquare size={12} />,
      action: () => generateInterviewAnswer("Pod Lifecycle"),
    },
    {
      label: "Troubleshoot",
      icon: <Wrench size={12} />,
      action: async () => {
        const r = await troubleshoot("CrashLoopBackOff")
        return [...r.path, "", "Commands:", ...r.commands, "", "Causes:", ...r.causes].join("\n")
      },
    },
  ]

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-[0.78rem] font-semibold text-[var(--text-secondary)]">Quick Actions</h3>
      <div className="flex flex-wrap gap-1.5">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onClick={() => run(btn.label, btn.action)}
            disabled={loading === btn.label}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.7rem] font-medium text-[var(--text-tertiary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-lg hover:text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-all disabled:opacity-50"
          >
            {loading === btn.label ? (
              <Sparkles size={12} className="animate-pulse text-brand" />
            ) : (
              btn.icon
            )}
            {btn.label}
          </button>
        ))}
      </div>
      {result && (
        <div className="text-[0.72rem] text-[var(--text-tertiary)] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
          {result}
        </div>
      )}
    </div>
  )
}
