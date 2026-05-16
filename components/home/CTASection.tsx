"use client"

import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { motion } from "framer-motion"

export function CTASection() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-20">
      <motion.div
        className="glow-card p-10 md:p-14 text-center space-y-5"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="font-display font-extrabold text-3xl tracking-[-0.03em] text-[var(--text-primary)]">
          Ready to Level Up?
        </h2>
        <p className="text-[var(--text-tertiary)] text-sm max-w-md mx-auto">
          1000+ questions, 50+ real scenarios — all free and open source.
        </p>
        <div className="flex flex-wrap items-center gap-3 justify-center">
          <Link
            href="/docs/kubernetes"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-brand/20"
          >
            Start Learning
            <ArrowRight size={15} />
          </Link>
          <a
            href="https://github.com/HT-MA/devops-interview-guide"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-bg)] border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-sm font-medium rounded-xl transition-all hover:border-[var(--border-strong)]"
          >
            <Star size={14} />
            Star on GitHub
          </a>
        </div>
      </motion.div>
    </section>
  )
}
