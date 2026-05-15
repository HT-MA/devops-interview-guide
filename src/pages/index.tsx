import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import {
  Terminal,
  Container,
  Ship,
  GitBranch,
  Activity,
  Gauge,
  Wrench,
  Cloud,
  Sparkles,
  ArrowRight,
} from "lucide-react";

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.908 24 17.592 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

import styles from "./index.module.css";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
}

const features: Feature[] = [
  {
    icon: <Terminal size={24} />,
    title: "Linux",
    description: "进程管理、内存分析、CPU 调优、网络配置、Shell 脚本等核心知识点",
    link: "/docs/linux/",
  },
  {
    icon: <Container size={24} />,
    title: "Docker",
    description: "容器基础、多阶段构建、网络模型、存储驱动与安全加固",
    link: "/docs/docker/",
  },
  {
    icon: <Ship size={24} />,
    title: "Kubernetes",
    description: "Pod 生命周期、Service Mesh、Ingress、ConfigMap、RBAC 等高频考点",
    link: "/docs/kubernetes/",
  },
  {
    icon: <GitBranch size={24} />,
    title: "CI/CD",
    description: "流水线设计、Jenkins、GitHub Actions、ArgoCD、渐进式发布",
    link: "/docs/cicd/",
  },
  {
    icon: <Activity size={24} />,
    title: "监控告警",
    description: "Prometheus、Grafana、Loki、告警抑制、SLI 指标设计",
    link: "/docs/monitoring/",
  },
  {
    icon: <Gauge size={24} />,
    title: "SRE",
    description: "SLO / SLI / SLA、故障管理、Chaos Engineering、灾备恢复",
    link: "/docs/sre/",
  },
  {
    icon: <Wrench size={24} />,
    title: "场景题",
    description: "CPU 飙高、内存泄漏、网络超时、Pod 崩溃等真实案例排查",
    link: "/docs/scenarios/",
  },
  {
    icon: <Cloud size={24} />,
    title: "Terraform",
    description: "IaC 基础、State 管理、模块化设计、Multi-Provider 编排",
    link: "/docs/terraform/",
  },
];

function FeatureCard({ icon, title, description, link }: Feature) {
  return (
    <Link className={styles.featureCard} to={link}>
      <div className={styles.featureIcon}>{icon}</div>
      <Heading as="h3" className={styles.featureTitle}>
        {title}
      </Heading>
      <p className={styles.featureDescription}>{description}</p>
    </Link>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroContainer}>
        <Heading as="h1" className={styles.heroTitle}>
          <span>{siteConfig.title}</span>
        </Heading>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <div className={styles.heroBadges}>
          <span className={styles.badge}>
            <Sparkles size={14} />
            1000+ 高频题目
          </span>
          <span className={styles.badge}>真实生产案例</span>
          <span className={styles.badge}>持续更新</span>
        </div>
        <div className={styles.heroButtons}>
          <Link className={styles.primaryButton} to="/docs/linux/">
            开始学习
            <ArrowRight size={18} />
          </Link>
          <Link
            className={styles.secondaryButton}
            to="https://github.com/HT-MA/devops-interview-guide"
          >
            <GitHubIcon />
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

function StatsSection() {
  const stats = [
    { number: "1000+", label: "高频题目" },
    { number: "10+", label: "核心模块" },
    { number: "50+", label: "真实场景" },
    { number: "持续", label: "更新迭代" },
  ];

  return (
    <section className={styles.statsSection}>
      <div className={styles.statsGrid}>
        {stats.map((stat, index) => (
          <div key={index} className={styles.statItem}>
            <div className={styles.statNumber}>{stat.number}</div>
            <div className={styles.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title="DevOps 面试知识库"
      description="云原生 / SRE / Kubernetes / CI-CD 面试知识库，包含 1000+ 高频题目和真实生产案例"
    >
      <HomepageHeader />
      <main>
        <StatsSection />
        <section className={styles.featuresSection}>
          <div className={styles.sectionHeader}>
            <Heading as="h2">核心模块</Heading>
            <p>覆盖 DevOps 工程师面试的所有核心技术领域</p>
          </div>
          <div className={styles.featuresGrid}>
            {features.map((props, idx) => (
              <FeatureCard key={idx} {...props} />
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
