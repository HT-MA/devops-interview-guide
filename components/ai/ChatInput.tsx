"use client"

import { useState, useRef } from "react"
import { Send, Sparkles } from "lucide-react"
import { askAI } from "@/lib/ai-stub"

export function ChatInput() {
  const [query, setQuery] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || loading) return
    setLoading(true)
    setResponse("")
    const answer = await askAI(query)
    setResponse(answer)
    setLoading(false)
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-brand" />
        <h3 className="text-[0.78rem] font-semibold text-[var(--text-secondary)]">Ask AI</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Why kubelet is important?"
            className="w-full bg-[var(--surface-bg)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-[0.78rem] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-brand/50 transition-colors font-mono"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-brand disabled:opacity-30 transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
      </form>
      {loading && (
        <p className="text-[0.72rem] text-[var(--text-muted)] animate-pulse">
          Thinking...
        </p>
      )}
      {response && (
        <div className="text-[0.75rem] text-[var(--text-tertiary)] leading-relaxed whitespace-pre-wrap">
          {response}
        </div>
      )}
    </div>
  )
}
