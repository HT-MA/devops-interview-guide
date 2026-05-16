"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Terminal, Container, Ship, GitBranch, Activity, Gauge, Wrench, Cloud } from "lucide-react"

interface Module {
  icon: React.ReactNode
  title: string
  description: string
  link: string
  accent: string
  tags: string[]
}

const modules: Module[] = [
  { icon: <Terminal size={16} />, title: "Linux", description: "Process management, memory analysis, CPU tuning, networking.", link: "/docs/linux", accent: "#6366f1", tags: ["Process", "Memory", "Network"] },
  { icon: <Container size={16} />, title: "Docker", description: "Multi-stage builds, network models, storage drivers, security.", link: "/docs/docker", accent: "#3b82f6", tags: ["Dockerfile", "Network"] },
  { icon: <Ship size={16} />, title: "Kubernetes", description: "Pod lifecycle, Service Mesh, Ingress, ConfigMap, RBAC.", link: "/docs/kubernetes", accent: "#8b5cf6", tags: ["Pod", "Service", "Ingress"] },
  { icon: <GitBranch size={16} />, title: "CI/CD", description: "Pipeline design, GitHub Actions, Jenkins, ArgoCD.", link: "/docs/cicd", accent: "#06b6d4", tags: ["Pipeline", "ArgoCD"] },
  { icon: <Activity size={16} />, title: "Monitoring", description: "Prometheus, Grafana, Loki logging, alerting rules.", link: "/docs/monitoring", accent: "#f59e0b", tags: ["Prometheus", "Grafana"] },
  { icon: <Gauge size={16} />, title: "SRE", description: "SLO/SLI/SLA design, incident management, observability.", link: "/docs/sre", accent: "#a78bfa", tags: ["SLO", "Incident"] },
  { icon: <Wrench size={16} />, title: "Scenarios", description: "Real-world troubleshooting: CPU spikes, memory leaks, pod crashes.", link: "/docs/scenarios", accent: "#22d3ee", tags: ["Debug", "Production"] },
  { icon: <Cloud size={16} />, title: "Terraform", description: "IaC fundamentals, state management, modular design.", link: "/docs/terraform", accent: "#2dd4bf", tags: ["IaC", "State"] },
]

export function ModuleCards() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center mb-12 space-y-3">
        <h2 className="font-display font-extrabold text-3xl tracking-[-0.02em] text-[var(--text-primary)]">
          Core Modules
        </h2>
        <p className="text-[var(--text-tertiary)] text-sm">
          Everything you need for DevOps interview prep
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {modules.map((mod, i) => (
          <motion.div
            key={mod.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
          >
            <Link
              href={mod.link}
              className="glass-card p-5 block group hover:border-[var(--border-default)] transition-all h-full"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${mod.accent}15`, border: `1px solid ${mod.accent}30`, color: mod.accent }}
              >
                {mod.icon}
              </div>
              <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1.5 group-hover:text-brand transition-colors">
                {mod.title}
              </h3>
              <p className="text-[0.75rem] text-[var(--text-tertiary)] leading-relaxed mb-3">
                {mod.description}
              </p>
              <div className="flex flex-wrap gap-1">
                {mod.tags.map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 text-[0.63rem] font-medium text-[var(--text-muted)] bg-[var(--surface-bg)] rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
