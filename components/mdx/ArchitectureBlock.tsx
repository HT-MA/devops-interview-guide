"use client"

import { useEffect, useRef, useState } from "react"
import { Box } from "lucide-react"

interface Props {
  children: React.ReactNode
  caption?: string
}

export function ArchitectureBlock({ children, caption }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="my-8 glass-card p-5 animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <Box size={14} className="text-white/40" />
        <span className="text-[0.75rem] font-semibold text-white/40 uppercase tracking-wider">
          Architecture
        </span>
      </div>
      <div
        ref={ref}
        className="overflow-x-auto text-[0.78rem] leading-relaxed font-mono text-white/60"
      >
        {children}
      </div>
      {caption && (
        <p className="mt-3 text-[0.72rem] text-white/30 text-center">{caption}</p>
      )}
    </div>
  )
}
