"use client"

import { motion } from "framer-motion"
import { Target, MessageSquare, Zap, BarChart3 } from "lucide-react"

const topics = [
  { icon: <Target size={14} />, title: "高频核心题", description: "Kubernetes 架构、etcd 共识算法、API Server 认证授权链路", count: "200+ questions" },
  { icon: <MessageSquare size={14} />, title: "场景设计题", description: "设计 CI/CD 流水线、设计监控体系、故障自愈方案", count: "50+ scenarios" },
  { icon: <Zap size={14} />, title: "生产排错题", description: "Pod CrashLoopBackOff、CPU 飙升、内存泄漏、网络超时", count: "30+ cases" },
  { icon: <BarChart3 size={14} />, title: "行为面试题", description: "故障处理流程、团队协作、SRE 文化、技术决策", count: "40+ questions" },
]

export function InterviewPrep() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border-subtle)]">
      <div className="text-center mb-12 space-y-3">
        <h2 className="font-display font-extrabold text-3xl tracking-[-0.03em] text-[var(--text-primary)]">
          Interview Preparation
        </h2>
        <p className="text-[var(--text-tertiary)] text-sm max-w-md mx-auto">
          Structured preparation covering every angle of DevOps interviews
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {topics.map((topic, i) => (
          <motion.div
            key={topic.title}
            className="glass-card p-5 group hover:border-[var(--border-default)] transition-all"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
              {topic.icon}
            </div>
            <h3 className="font-semibold text-sm text-[var(--text-secondary)] mb-1.5">{topic.title}</h3>
            <p className="text-[0.75rem] text-[var(--text-tertiary)] leading-relaxed mb-3">{topic.description}</p>
            <span className="text-[0.65rem] font-mono text-brand/60">{topic.count}</span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
