"use client"

import { motion } from "framer-motion"

const dirs = [
  { perms: "drwxr-xr-x", name: "linux", comment: "# Process, Memory, CPU" },
  { perms: "drwxr-xr-x", name: "docker", comment: "# Build, Network, Security" },
  { perms: "drwxr-xr-x", name: "kubernetes", comment: "# Pod, Service, Ingress" },
  { perms: "drwxr-xr-x", name: "cicd", comment: "# Pipeline, ArgoCD" },
  { perms: "drwxr-xr-x", name: "monitoring", comment: "# Prometheus, Grafana" },
  { perms: "drwxr-xr-x", name: "sre", comment: "# SLO, Incident, On-call" },
  { perms: "drwxr-xr-x", name: "terraform", comment: "# IaC, State, Modules" },
]

export function TerminalPanel() {
  return (
    <motion.div
      className="terminal-block w-full max-w-md shadow-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="terminal-header">
        <span className="terminal-dot" style={{ background: "#ff5f56" }} />
        <span className="terminal-dot" style={{ background: "#ffbd2e" }} />
        <span className="terminal-dot" style={{ background: "#27c93f" }} />
        <span className="ml-2">bash — 80×24</span>
      </div>
      <div className="p-4 space-y-1 font-mono text-[0.8rem] leading-relaxed">
        <div>
          <span className="text-emerald-500">$</span>{" "}
          <span className="text-[var(--text-secondary)]">ls -la modules/</span>
        </div>
        {dirs.map((d, i) => (
          <motion.div
            key={d.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          >
            <span className="text-[var(--text-muted)]">{d.perms}</span>{" "}
            <span className="text-blue-500">{d.name}</span>{" "}
            <span className="text-[var(--text-muted)]">{d.comment}</span>
          </motion.div>
        ))}
        <motion.div
          className="pt-2 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <span className="text-emerald-500">$</span>
          <span className="text-[var(--text-tertiary)]">_</span>
          <span className="w-2 h-4 bg-[var(--text-muted)] animate-pulse rounded-sm" />
        </motion.div>
      </div>
    </motion.div>
  )
}
