import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import styles from "./index.module.css";

interface Feature {
  icon: string;
  title: string;
  description: string;
  link: string;
}

const features: Feature[] = [
  {
    icon: "🐧",
    title: "Linux",
    description: "进程管理、内存分析、CPU分析、网络配置、Shell脚本等核心知识点",
    link: "/docs/linux/",
  },
  {
    icon: "🐳",
    title: "Docker",
    description: "容器基础、镜像构建、网络配置、存储驱动、安全加固等面试题",
    link: "/docs/docker/",
  },
  {
    icon: "☸️",
    title: "Kubernetes",
    description: "Pod生命周期、Service、Ingress、ConfigMap、存储、网络等高频考点",
    link: "/docs/kubernetes/",
  },
  {
    icon: "🔄",
    title: "CI/CD",
    description: "流水线设计、Jenkins、GitHub Actions、ArgoCD、发布策略等",
    link: "/docs/cicd/",
  },
  {
    icon: "📊",
    title: "监控告警",
    description: "Prometheus、Grafana、Loki、告警风暴、指标设计等",
    link: "/docs/monitoring/",
  },
  {
    icon: "🎯",
    title: "SRE",
    description: "SLO/SLI/SLA、故障管理、可观测性、灾备恢复等",
    link: "/docs/sre/",
  },
  {
    icon: "🔧",
    title: "场景题",
    description: "CPU飙高、内存泄漏、网络故障、Pod崩溃等真实案例分析",
    link: "/docs/scenarios/",
  },
  {
    icon: "☁️",
    title: "Terraform",
    description: "IaC基础、状态管理、模块化、Provider配置等",
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
          {siteConfig.title}
        </Heading>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <div className={styles.heroBadges}>
          <span className={styles.badge}>1000+ 高频题目</span>
          <span className={styles.badge}>真实生产案例</span>
          <span className={styles.badge}>持续更新</span>
        </div>
        <div className={styles.heroButtons}>
          <Link className={styles.primaryButton} to="/docs/linux/">
            开始学习
          </Link>
          <Link
            className={styles.secondaryButton}
            to="https://github.com/your-github-username/devops-interview-guide"
          >
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
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="DevOps面试知识库"
      description="云原生 / SRE / Kubernetes / CI-CD 面试知识库，包含1000+高频题目和真实生产案例"
    >
      <HomepageHeader />
      <main>
        <StatsSection />
        <section className={styles.featuresSection}>
          <div className={styles.sectionHeader}>
            <Heading as="h2">核心模块</Heading>
            <p>涵盖 DevOps 工程师面试的核心技术领域</p>
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
