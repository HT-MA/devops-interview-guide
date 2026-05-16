import { Shield, TrendingUp, Activity, Eye, CheckCircle } from "lucide-react"

interface Advice {
  type: "best-practice" | "security" | "scaling" | "monitoring"
  title: string
  description: string
}

const iconMap = {
  "best-practice": { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  security: { icon: Shield, color: "text-amber-400", bg: "bg-amber-400/10" },
  scaling: { icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-400/10" },
  monitoring: { icon: Activity, color: "text-purple-400", bg: "bg-purple-400/10" },
}

interface Props {
  advice: Advice[]
}

export function ProductionAdviceBlock({ advice }: Props) {
  return (
    <div className="my-8">
      <div className="flex items-center gap-2 mb-4">
        <Eye size={14} className="text-white/40" />
        <h2 className="text-[0.85rem] font-bold text-white/80 uppercase tracking-wider">
          Production Advice
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {advice.map((item, i) => {
          const { icon: Icon, color, bg } = iconMap[item.type]
          return (
            <div
              key={item.title}
              className="glass-card p-4 animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={14} className={color} />
                </div>
                <div>
                  <h3 className="text-[0.8rem] font-semibold text-white/75">{item.title}</h3>
                  <p className="text-[0.73rem] text-white/45 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
