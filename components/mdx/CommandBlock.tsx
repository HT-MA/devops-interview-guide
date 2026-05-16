"use client"

import { useState } from "react"
import { Copy, Check, Terminal } from "lucide-react"

interface Props {
  command: string
  label?: string
  lang?: string
  output?: string
}

export function CommandBlock({ command, label = "bash", lang = "bash", output }: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="terminal-block my-6 animate-slide-up">
      <div className="terminal-header">
        <span className="terminal-dot" style={{ background: "#ff5f56" }} />
        <span className="terminal-dot" style={{ background: "#ffbd2e" }} />
        <span className="terminal-dot" style={{ background: "#27c93f" }} />
        <span className="ml-2">{label}</span>
        <div className="flex-1" />
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[0.65rem] text-white/25 hover:text-white/60 hover:bg-white/[0.06] rounded transition-all"
        >
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className={`text-[0.8rem] text-white/75 font-mono leading-relaxed language-${lang}`}>
          {command}
        </code>
      </pre>
      {output && (
        <div className="border-t border-white/[0.06] px-4 py-3 bg-black/20">
          <pre className="text-[0.75rem] text-white/40 font-mono leading-relaxed overflow-x-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}
