import { Target, Lightbulb, MessageSquare } from "lucide-react"

interface Question {
  q: string
  intent: string
  tip: string
  difficulty?: "beginner" | "intermediate" | "advanced"
}

interface Props {
  questions: Question[]
}

const diffBadge = {
  beginner: "bg-emerald-400/10 text-emerald-400",
  intermediate: "bg-amber-400/10 text-amber-400",
  advanced: "bg-red-400/10 text-red-400",
}

export function InterviewFocusBlock({ questions }: Props) {
  return (
    <div className="my-8 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Target size={14} className="text-brand" />
        <h2 className="text-[0.85rem] font-bold text-white/80 uppercase tracking-wider">
          Interview Focus
        </h2>
      </div>
      {questions.map((q, i) => (
        <div key={i} className="glass-card p-4 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-[0.85rem] font-semibold text-white/85">
              Q: {q.q}
            </h3>
            {q.difficulty && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[0.62rem] font-semibold font-mono ${diffBadge[q.difficulty]}`}>
                {q.difficulty === "beginner" ? "初级" : q.difficulty === "intermediate" ? "中级" : "高级"}
              </span>
            )}
          </div>
          <div className="space-y-2 text-[0.78rem]">
            <div className="flex items-start gap-2">
              <Lightbulb size={12} className="text-amber-400 shrink-0 mt-0.5" />
              <span className="text-white/40">面试官意图: </span>
              <span className="text-white/60">{q.intent}</span>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquare size={12} className="text-brand shrink-0 mt-0.5" />
              <span className="text-white/40">回答建议: </span>
              <span className="text-white/60">{q.tip}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
