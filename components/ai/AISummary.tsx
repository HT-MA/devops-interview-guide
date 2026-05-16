"use client"

import { useState, useEffect } from "react"
import { Zap } from "lucide-react"

export function AISummary({ title = "Pod 生命周期" }: { title?: string; content?: string }) {
  const [summary, setSummary] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSummary(
        `**TL;DR** — ${title} 是 Kubernetes 中最核心的概念之一。本文包含 Pod 相位 (Phase)、Init Container、探针 (Probes) 和生命周期钩子 (Hooks) 四个关键部分。\n\n**面试重点:** Pod 状态转换、CrashLoopBackOff 排查、Liveness vs Readiness 区别。`
      )
      setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [title])

  return (
    <div className="glow-card p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <Zap size={14} className="text-brand" />
        <h3 className="text-[0.78rem] font-semibold text-[var(--text-secondary)]">
          AI Summary
        </h3>
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-2.5 bg-[var(--surface-bg)] rounded w-full animate-pulse" />
          <div className="h-2.5 bg-[var(--surface-bg)] rounded w-3/4 animate-pulse" />
          <div className="h-2.5 bg-[var(--surface-bg)] rounded w-1/2 animate-pulse" />
        </div>
      ) : (
        <div className="text-[0.75rem] text-[var(--text-tertiary)] leading-relaxed whitespace-pre-wrap">
          {summary}
        </div>
      )}
    </div>
  )
}
