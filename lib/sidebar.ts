export interface SidebarItem {
  slug: string
  title: string
}

export interface SidebarCategory {
  icon: string
  label: string
  items: SidebarItem[]
}

export const sidebarTree: SidebarCategory[] = [
  {
    icon: "☸",
    label: "Kubernetes",
    items: [
      { slug: "kubernetes/pod-lifecycle", title: "Pod 生命周期" },
      { slug: "kubernetes/deployment", title: "Deployment" },
      { slug: "kubernetes/service", title: "Service" },
      { slug: "kubernetes/ingress", title: "Ingress" },
      { slug: "kubernetes/configmap-secret", title: "ConfigMap & Secret" },
      { slug: "kubernetes/storage", title: "Storage" },
      { slug: "kubernetes/networking", title: "Networking" },
      { slug: "kubernetes/scheduling", title: "Scheduling" },
      { slug: "kubernetes/troubleshooting", title: "Troubleshooting" },
      { slug: "kubernetes/interview-core", title: "Core 面试题" },
      { slug: "kubernetes/interview-network", title: "Network 面试题" },
      { slug: "kubernetes/interview-ops", title: "Ops 面试题" },
    ],
  },
  {
    icon: "🐧",
    label: "Linux",
    items: [
      { slug: "linux/process-management", title: "Process Management" },
      { slug: "linux/memory-management", title: "Memory Management" },
      { slug: "linux/cpu-analysis", title: "CPU Analysis" },
      { slug: "linux/network", title: "Network" },
      { slug: "linux/io", title: "I/O" },
      { slug: "linux/systemd", title: "Systemd" },
      { slug: "linux/shell", title: "Shell" },
      { slug: "linux/permissions", title: "Permissions" },
      { slug: "linux/interview-process", title: "Process 面试题" },
      { slug: "linux/interview-memory", title: "Memory 面试题" },
      { slug: "linux/interview-network", title: "Network 面试题" },
      { slug: "linux/interview-storage", title: "Storage 面试题" },
    ],
  },
  {
    icon: "🐳",
    label: "Docker",
    items: [
      { slug: "docker/container-basics", title: "Container Basics" },
      { slug: "docker/dockerfile-optimization", title: "Dockerfile Optimization" },
      { slug: "docker/docker-network", title: "Docker Network" },
      { slug: "docker/docker-storage", title: "Docker Storage" },
      { slug: "docker/docker-security", title: "Docker Security" },
      { slug: "docker/interview-architecture", title: "Architecture 面试题" },
      { slug: "docker/interview-build", title: "Build 面试题" },
      { slug: "docker/interview-ops", title: "Ops 面试题" },
    ],
  },
  {
    icon: "⚙",
    label: "CI/CD",
    items: [
      { slug: "cicd/pipeline-design", title: "Pipeline Design" },
      { slug: "cicd/jenkins", title: "Jenkins" },
      { slug: "cicd/github-actions", title: "GitHub Actions" },
      { slug: "cicd/argocd", title: "ArgoCD" },
      { slug: "cicd/deployment-strategies", title: "Deployment Strategies" },
      { slug: "cicd/interview-pipeline", title: "Pipeline 面试题" },
      { slug: "cicd/interview-deploy", title: "Deploy 面试题" },
      { slug: "cicd/interview-tools", title: "Tools 面试题" },
    ],
  },
  {
    icon: "📊",
    label: "Monitoring",
    items: [
      { slug: "monitoring/prometheus", title: "Prometheus" },
      { slug: "monitoring/grafana", title: "Grafana" },
      { slug: "monitoring/alerting", title: "Alerting" },
      { slug: "monitoring/logging", title: "Logging" },
      { slug: "monitoring/interview-prometheus", title: "Prometheus 面试题" },
      { slug: "monitoring/interview-logging", title: "Logging 面试题" },
      { slug: "monitoring/interview-alerting", title: "Alerting 面试题" },
    ],
  },
  {
    icon: "🔧",
    label: "SRE",
    items: [
      { slug: "sre/slo-sli-sla", title: "SLO / SLI / SLA" },
      { slug: "sre/incident-management", title: "Incident Management" },
      { slug: "sre/observability", title: "Observability" },
      { slug: "sre/interview-reliability", title: "Reliability 面试题" },
      { slug: "sre/interview-incident", title: "Incident 面试题" },
      { slug: "sre/interview-observability", title: "Observability 面试题" },
    ],
  },
  {
    icon: "🔍",
    label: "Scenarios",
    items: [
      { slug: "scenarios/cpu-high", title: "CPU High" },
      { slug: "scenarios/memory-leak", title: "Memory Leak" },
      { slug: "scenarios/network-issue", title: "Network Issue" },
      { slug: "scenarios/pod-crash", title: "Pod Crash" },
      { slug: "scenarios/database-slow", title: "Database Slow" },
      { slug: "scenarios/interview-linux", title: "Linux 场景题" },
      { slug: "scenarios/interview-k8s", title: "K8s 场景题" },
      { slug: "scenarios/interview-network", title: "Network 场景题" },
    ],
  },
  {
    icon: "🏗",
    label: "Terraform",
    items: [
      { slug: "terraform/basics", title: "Basics" },
      { slug: "terraform/state-management", title: "State Management" },
      { slug: "terraform/interview-core", title: "Core 面试题" },
      { slug: "terraform/interview-advanced", title: "Advanced 面试题" },
      { slug: "terraform/interview-troubleshoot", title: "Troubleshoot 面试题" },
    ],
  },
  {
    icon: "📦",
    label: "Ansible",
    items: [
      { slug: "ansible/basics", title: "Basics" },
      { slug: "ansible/playbooks", title: "Playbooks" },
      { slug: "ansible/interview-core", title: "Core 面试题" },
      { slug: "ansible/interview-advanced", title: "Advanced 面试题" },
      { slug: "ansible/interview-troubleshoot", title: "Troubleshoot 面试题" },
    ],
  },
  {
    icon: "💬",
    label: "HR / 行为面试",
    items: [
      { slug: "hr/behavioral", title: "Behavioral" },
      { slug: "hr/technical", title: "Technical Communication" },
      { slug: "hr/interview-behavioral", title: "Behavioral 面试题" },
      { slug: "hr/interview-technical-system", title: "System Design 面试题" },
    ],
  },
]
