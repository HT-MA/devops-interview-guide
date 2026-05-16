import { Zap } from "lucide-react"

interface Props {
  children: React.ReactNode
}

export function TLDRBlock({ children }: Props) {
  return (
    <div className="glow-card p-5 my-8 animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-brand/15 flex items-center justify-center">
          <Zap size={12} className="text-brand" />
        </div>
        <span className="text-[0.75rem] font-semibold text-brand uppercase tracking-wider">
          TL;DR
        </span>
      </div>
      <div className="text-[0.88rem] text-white/65 leading-relaxed">
        {children}
      </div>
    </div>
  )
}
