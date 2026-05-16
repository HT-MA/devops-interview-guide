"use client"

import { motion } from "framer-motion"

const steps = [
  { step: "01", title: "Master the Fundamentals", description: "Browse 1000+ questions across all modules, from Linux basics to Kubernetes advanced topics." },
  { step: "02", title: "Practice Real Scenarios", description: "Troubleshoot real production incidents: CPU spikes, memory leaks, network failures, and pod crashes." },
  { step: "03", title: "Ace the Interview", description: "Cover big tech high-frequency topics and get the DevOps/SRE offer you deserve." },
]

export function LearningPath() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border-subtle)]">
      <div className="text-center mb-12 space-y-3">
        <h2 className="font-display font-extrabold text-3xl tracking-[-0.02em] text-[var(--text-primary)]">
          Your Learning Path
        </h2>
        <p className="text-[var(--text-tertiary)] text-sm">
          A structured approach to mastering DevOps interviews
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <motion.div
            key={step.step}
            className="glass-card p-6 text-center group hover:border-[var(--border-default)] transition-all"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="text-[0.65rem] font-bold text-brand/60 tracking-[0.15em] mb-3">
              STEP {step.step}
            </div>
            <h3 className="font-semibold text-[var(--text-secondary)] text-sm mb-2">{step.title}</h3>
            <p className="text-[0.78rem] text-[var(--text-tertiary)] leading-relaxed">{step.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
