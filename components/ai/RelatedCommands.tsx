"use client"

import { useState } from "react"
import { Terminal, Copy, Check } from "lucide-react"
import { getRelatedCommands } from "@/lib/ai-stub"

export function RelatedCommands({ topic = "kubernetes" }: { topic?: string }) {
  const commands = getRelatedCommands(topic)
  const [copied, setCopied] = useState<string | null>(null)

  function handleCopy(cmd: string) {
    navigator.clipboard.writeText(cmd)
    setCopied(cmd)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal size={14} className="text-[var(--text-tertiary)]" />
        <h3 className="text-[0.78rem] font-semibold text-[var(--text-secondary)]">
          Related Commands
        </h3>
      </div>
      <div className="space-y-1.5">
        {commands.map(({ cmd, desc }) => (
          <div key={cmd} className="terminal-block group">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <code className="text-[0.72rem] text-[var(--text-secondary)] font-mono truncate block">
                  {cmd}
                </code>
                <span className="text-[0.65rem] text-[var(--text-muted)] mt-0.5 block">
                  {desc}
                </span>
              </div>
              <button
                onClick={() => handleCopy(cmd)}
                className="shrink-0 ml-2 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-bg)] transition-all opacity-0 group-hover:opacity-100"
                aria-label="Copy command"
              >
                {copied === cmd ? (
                  <Check size={12} className="text-green-400" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
