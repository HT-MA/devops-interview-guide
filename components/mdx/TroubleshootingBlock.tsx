import { AlertTriangle, ArrowRight } from "lucide-react"
import Link from "next/link"

interface Issue {
  name: string
  description: string
  slug?: string
}

interface Props {
  issues: Issue[]
}

export function TroubleshootingBlock({ issues }: Props) {
  return (
    <div className="my-8">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={14} className="text-amber-400" />
        <h2 className="text-[0.85rem] font-bold text-white/80 uppercase tracking-wider">
          Common Issues
        </h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {issues.map((issue, i) => (
          <div
            key={issue.name}
            className="glass-card p-4 hover:border-white/[0.12] transition-all group animate-slide-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <code className="text-[0.78rem] font-semibold text-red-400/80 font-mono">
                  {issue.name}
                </code>
                <p className="text-[0.75rem] text-white/45 mt-1.5 leading-relaxed">
                  {issue.description}
                </p>
              </div>
              {issue.slug && (
                <Link
                  href={`/docs/${issue.slug}`}
                  className="shrink-0 p-1.5 rounded-md text-white/15 group-hover:text-brand group-hover:bg-brand/5 transition-all"
                >
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
