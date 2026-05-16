import { Clock, BarChart3 } from "lucide-react"

interface Props {
  title: string
  description?: string
  tags?: string[]
  difficulty?: "beginner" | "intermediate" | "advanced"
  readTime?: string
}

const difficultyConfig = {
  beginner: { label: "初级", color: "text-emerald-400", bg: "bg-emerald-400/10", dots: "⚫⚪⚪" },
  intermediate: { label: "中级", color: "text-amber-400", bg: "bg-amber-400/10", dots: "⚫⚫⚪" },
  advanced: { label: "高级", color: "text-red-400", bg: "bg-red-400/10", dots: "⚫⚫⚫" },
}

export function HeroBlock({ title, description, tags, difficulty = "intermediate", readTime = "8 min" }: Props) {
  const diff = difficultyConfig[difficulty]

  return (
    <div className="relative mb-10 pb-8 border-b border-white/[0.06]">
      <div className="absolute inset-0 -top-20 -mx-8 h-64 bg-gradient-to-b from-brand/[0.04] to-transparent pointer-events-none" />

      <div className="relative space-y-4">
        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.68rem] font-semibold font-mono ${diff.color} ${diff.bg}`}>
            {diff.dots} {diff.label}
          </span>
          {tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex px-2 py-0.5 rounded-md text-[0.68rem] font-medium text-white/35 bg-white/[0.03] border border-white/[0.06]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.03em] text-white">
          {title}
        </h1>

        {/* Description */}
        {description && (
          <p className="text-white/50 text-[0.9rem] leading-relaxed max-w-2xl">
            {description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-[0.75rem] text-white/30">
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {readTime} read
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 size={12} />
            {difficulty === "beginner" ? "Foundational" : difficulty === "intermediate" ? "Intermediate" : "Advanced"}
          </span>
        </div>
      </div>
    </div>
  )
}
