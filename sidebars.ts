import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "category",
      label: "Linux",
      link: {
        type: "generated-index",
        title: "Linux 面试题",
        description: "Linux 系统管理、进程管理、网络配置等高频面试题",
        slug: "/linux",
      },
      items: [
        "linux/_category_",
        "linux/process-management",
        "linux/memory-management",
        "linux/cpu-analysis",
        "linux/network",
        "linux/io",
        "linux/systemd",
        "linux/shell",
        "linux/permissions",
      ],
    },
    {
      type: "category",
      label: "Docker",
      link: {
        type: "generated-index",
        title: "Docker 面试题",
        description: "容器化技术、镜像构建、容器网络等高频面试题",
        slug: "/docker",
      },
      items: [
        "docker/_category_",
        "docker/container-basics",
        "docker/dockerfile-optimization",
        "docker/docker-network",
        "docker/docker-storage",
        "docker/docker-security",
      ],
    },
    {
      type: "category",
      label: "Kubernetes",
      link: {
        type: "generated-index",
        title: "Kubernetes 面试题",
        description: "K8s 核心概念、运维实践、故障排查等高频面试题",
        slug: "/kubernetes",
      },
      items: [
        "kubernetes/_category_",
        "kubernetes/pod-lifecycle",
        "kubernetes/deployment",
        "kubernetes/service",
        "kubernetes/ingress",
        "kubernetes/configmap-secret",
        "kubernetes/storage",
        "kubernetes/networking",
        "kubernetes/scheduling",
        "kubernetes/troubleshooting",
      ],
    },
    {
      type: "category",
      label: "CI/CD",
      link: {
        type: "generated-index",
        title: "CI/CD 面试题",
        description: "持续集成/持续部署、流水线设计、发布策略等高频面试题",
        slug: "/cicd",
      },
      items: [
        "cicd/_category_",
        "cicd/pipeline-design",
        "cicd/jenkins",
        "cicd/github-actions",
        "cicd/argocd",
        "cicd/deployment-strategies",
      ],
    },
    {
      type: "category",
      label: "监控告警",
      link: {
        type: "generated-index",
        title: "监控告警面试题",
        description: "Prometheus、Grafana、日志收集等高频面试题",
        slug: "/monitoring",
      },
      items: [
        "monitoring/_category_",
        "monitoring/prometheus",
        "monitoring/grafana",
        "monitoring/alerting",
        "monitoring/logging",
      ],
    },
    {
      type: "category",
      label: "SRE",
      link: {
        type: "generated-index",
        title: "SRE 面试题",
        description: "站点可靠性工程、可观测性、灾备等高频面试题",
        slug: "/sre",
      },
      items: [
        "sre/_category_",
        "sre/slo-sli-sla",
        "sre/incident-management",
        "sre/observability",
      ],
    },
    {
      type: "category",
      label: "场景题",
      link: {
        type: "generated-index",
        title: "场景题",
        description: "真实生产环境中的故障排查与解决思路",
        slug: "/scenarios",
      },
      items: [
        "scenarios/_category_",
        "scenarios/cpu-high",
        "scenarios/memory-leak",
        "scenarios/network-issue",
        "scenarios/pod-crash",
        "scenarios/database-slow",
      ],
    },
    {
      type: "category",
      label: "Terraform",
      link: {
        type: "generated-index",
        title: "Terraform 面试题",
        description: "基础设施即代码、状态管理、模块化等高频面试题",
        slug: "/terraform",
      },
      items: ["terraform/_category_", "terraform/basics", "terraform/state-management"],
    },
    {
      type: "category",
      label: "Ansible",
      link: {
        type: "generated-index",
        title: "Ansible 面试题",
        description: "自动化运维、 playbook 编写、角色管理等高频面试题",
        slug: "/ansible",
      },
      items: ["ansible/_category_", "ansible/basics", "ansible/playbooks"],
    },
    {
      type: "category",
      label: "高频面试题",
      link: {
        type: "generated-index",
        title: "高频面试题",
        description: "各大厂高频面试题汇总",
        slug: "/hr",
      },
      items: ["hr/_category_", "hr/behavioral", "hr/technical"],
    },
  ],
};

export default sidebars;
