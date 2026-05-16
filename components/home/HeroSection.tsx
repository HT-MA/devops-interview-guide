"use client"

import Link from "next/link"
import { ArrowRight, Github } from "lucide-react"
import { motion } from "framer-motion"
import { TerminalPanel } from "./TerminalPanel"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg radial-glow" />

      <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-28">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <motion.div
            className="flex-1 space-y-6 text-center lg:text-left"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-bg)] border border-[var(--border-subtle)] text-[0.72rem] text-[var(--text-tertiary)] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              v2.0 — AI Native Platform
            </div>

            <h1 className="font-display font-extrabold text-4xl lg:text-5xl tracking-[-0.04em] text-[var(--text-primary)] leading-tight">
              Master Your{" "}
              <span className="text-brand">DevOps</span>{" "}
              Interview
            </h1>

            <p className="text-[var(--text-tertiary)] text-base lg:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0">
              云原生 / SRE / Kubernetes / CI-CD 面试知识库 — 1000+ 高频题目，50+ 真实场景，免费开源
            </p>

            <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-bg)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium rounded-xl transition-all hover:border-[var(--border-strong)]"
              >
                <Github size={15} />
                GitHub
              </a>
            </div>

            <div className="terminal-block inline-block mx-auto lg:mx-0">
              <div className="flex items-center gap-3 px-4 py-2.5 text-[0.78rem] font-mono">
                <span className="text-emerald-500">$</span>
                <span className="text-[var(--text-tertiary)]">git clone</span>
                <span className="text-blue-500">github.com/HT-MA/devops-interview-guide</span>
                <span className="w-2 h-4 bg-[var(--text-muted)] animate-pulse rounded-sm ml-1" />
              </div>
            </div>
          </motion.div>

          <div className="flex-1 flex justify-center lg:justify-end">
            <TerminalPanel />
          </div>
        </div>
      </div>
    </section>
  )
}
