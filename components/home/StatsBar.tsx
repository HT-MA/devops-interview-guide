"use client"

import { motion } from "framer-motion"

const stats = [
  { number: "1000+", label: "Questions" },
  { number: "10", label: "Modules" },
  { number: "50+", label: "Scenarios" },
  { number: "Free", label: "Open Source" },
]

export function StatsBar() {
  return (
    <div className="border-y border-[var(--border-subtle)] bg-[var(--surface-bg)]">
      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="text-center"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="font-display font-extrabold text-2xl lg:text-3xl tracking-[-0.02em] text-[var(--text-primary)]">
              {stat.number}
            </div>
            <div className="text-[0.75rem] text-[var(--text-muted)] mt-1 font-medium uppercase tracking-wider">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
