import { Info, AlertTriangle, AlertCircle, Lightbulb, MessageSquare, Eye } from "lucide-react"

type CalloutType = "note" | "warning" | "danger" | "tip" | "interview" | "production"

interface Props {
  type: CalloutType
  title?: string
  children: React.ReactNode
}

const config: Record<CalloutType, { icon: React.ReactNode; label: string; border: string; bg: string; text: string }> = {
  note: {
    icon: <Info size={14} />,
    label: "Note",
    border: "border-l-blue-400/40",
    bg: "bg-blue-400/5",
    text: "text-blue-400",
  },
  warning: {
    icon: <AlertTriangle size={14} />,
    label: "Warning",
    border: "border-l-amber-400/40",
    bg: "bg-amber-400/5",
    text: "text-amber-400",
  },
  danger: {
    icon: <AlertCircle size={14} />,
    label: "Danger",
    border: "border-l-red-400/40",
    bg: "bg-red-400/5",
    text: "text-red-400",
  },
  tip: {
    icon: <Lightbulb size={14} />,
    label: "Tip",
    border: "border-l-emerald-400/40",
    bg: "bg-emerald-400/5",
    text: "text-emerald-400",
  },
  interview: {
    icon: <MessageSquare size={14} />,
    label: "Interview",
    border: "border-l-brand/40",
    bg: "bg-brand/5",
    text: "text-brand",
  },
  production: {
    icon: <Eye size={14} />,
    label: "Production",
    border: "border-l-purple-400/40",
    bg: "bg-purple-400/5",
    text: "text-purple-400",
  },
}

export function CalloutBlock({ type, title, children }: Props) {
  const { icon, label, border, bg, text } = config[type]

  return (
    <div className={`my-6 rounded-xl border border-white/[0.06] border-l-4 ${border} ${bg} p-4 animate-slide-up`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={text}>{icon}</span>
        <span className={`text-[0.75rem] font-semibold uppercase tracking-wider ${text}`}>
          {title || label}
        </span>
      </div>
      <div className="text-[0.85rem] text-white/60 leading-relaxed">
        {children}
      </div>
    </div>
  )
}
