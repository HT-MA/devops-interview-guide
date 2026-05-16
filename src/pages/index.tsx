import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import React from "react";
import {
  Terminal,
  Container,
  Ship,
  GitBranch,
  Activity,
  Gauge,
  Wrench,
  Cloud,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Star,
  Cpu,
  Shield,
} from "lucide-react";

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

import styles from "./index.module.css";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
  accent: string;
  tags: string[];
}

const features: Feature[] = [
  {
    icon: <Terminal size={16} />,
    title: "Linux",
    description: "Process management, memory analysis, CPU tuning, networking, shell scripting and systemd.",
    link: "/docs/linux/",
    accent: "#ff6b35",
    tags: ["Process", "Memory", "Network"],
  },
  {
    icon: <Container size={16} />,
    title: "Docker",
    description: "Multi-stage builds, network models, storage drivers, security best practices and optimization.",
    link: "/docs/docker/",
    accent: "#00a2ff",
    tags: ["Dockerfile", "Network"],
  },
  {
    icon: <Ship size={16} />,
    title: "Kubernetes",
    description: "Pod lifecycle, Service Mesh, Ingress controllers, ConfigMap, RBAC, and scheduling policies.",
    link: "/docs/kubernetes/",
    accent: "#6f4cff",
    tags: ["Pod", "Service", "Ingress"],
  },
  {
    icon: <GitBranch size={16} />,
    title: "CI/CD",
    description: "Pipeline design, GitHub Actions, Jenkins, ArgoCD, progressive delivery and rollback strategies.",
    link: "/docs/cicd/",
    accent: "#10b981",
    tags: ["Pipeline", "ArgoCD"],
  },
  {
    icon: <Activity size={16} />,
    title: "Monitoring",
    description: "Prometheus, Grafana dashboards, Loki logging, alerting rules, SLI metrics and on-call practices.",
    link: "/docs/monitoring/",
    accent: "#f59e0b",
    tags: ["Prometheus", "Grafana"],
  },
  {
    icon: <Gauge size={16} />,
    title: "SRE",
    description: "SLO/SLI/SLA design, incident management, observability, chaos engineering, disaster recovery.",
    link: "/docs/sre/",
    accent: "#a855f7",
    tags: ["SLO", "Incident"],
  },
  {
    icon: <Wrench size={16} />,
    title: "Scenarios",
    description: "Real-world troubleshooting: CPU spikes, memory leaks, network timeouts, pod crashes, DB slow queries.",
    link: "/docs/scenarios/",
    accent: "#06b6d4",
    tags: ["Debug", "Production"],
  },
  {
    icon: <Cloud size={16} />,
    title: "Terraform",
    description: "IaC fundamentals, state management, modular design, multi-provider orchestration and best practices.",
    link: "/docs/terraform/",
    accent: "#14b8a6",
    tags: ["IaC", "State"],
  },
];

function TerminalPanel() {
  return (
    <div className={styles.terminalPanel}>
      <div className={styles.terminalBox}>
        <div className={styles.terminalBar}>
          <span className={styles.terminalDot} data-color="red" />
          <span className={styles.terminalDot} data-color="yellow" />
          <span className={styles.terminalDot} data-color="green" />
          <span style={{ marginLeft: "0.5rem" }}>bash — 80×24</span>
        </div>
        <div className={styles.terminalBody}>
          <div className={styles.terminalLine}>
            <span className={styles.terminalLinePrompt}>$</span>{" "}
            <span className={styles.terminalLineCmd}>ls -la modules/</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>linux</span>{" "}
            <span className={styles.terminalOutputComment}># Process, Memory, CPU</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>docker</span>{" "}
            <span className={styles.terminalOutputComment}># Build, Network, Security</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>kubernetes</span>{" "}
            <span className={styles.terminalOutputComment}># Pod, Service, Ingress</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>cicd</span>{" "}
            <span className={styles.terminalOutputComment}># Pipeline, ArgoCD</span>
          </div>
          <div className={styles.terminalLine}>
            <span className={styles.terminalOutputPermissions}>drwxr-xr-x</span>{" "}
            <span className={styles.terminalOutputDir}>monitoring</span>{" "}
            <span className={styles.terminalOutputComment}># Prometheus, Grafana</span>
          </div>
          <div style={{ marginTop: "0.3rem" }}>
            <span className={styles.terminalLinePrompt}>$</span>{" "}
            <span style={{ color: "rgba(255,255,255,0.4)" }}>_</span>
            <span className={styles.terminalBlink} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroContainer}>
        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>// devops-interview-guide</div>
          <Heading as="h1" className={styles.heroTitle}>
            Master Your{" "}
            <span className={styles.heroAccent}>DevOps</span> Interview
          </Heading>
          <p className={styles.heroSubtitle}>
            {siteConfig.tagline}
          </p>
          <div className={styles.heroButtons}>
            <Link className={styles.primaryButton} to="/docs/linux/">
              Start Learning
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              className={styles.secondaryButton}
              to="https://github.com/HT-MA/devops-interview-guide"
              aria-label="View on GitHub"
            >
              <GitHubIcon />
              GitHub
            </Link>
          </div>
          <div className={styles.terminalStrip}>
            <span className={styles.terminalPrompt}>$</span>
            <span>git clone </span>
            <span className={styles.terminalPath}>github.com/HT-MA/devops-interview-guide</span>
            <span className={styles.terminalCursor} />
          </div>
        </div>
        <TerminalPanel />
      </div>
    </header>
  );
}

function StatsBar() {
  const stats = [
    { number: "1000+", label: "Questions", accent: false },
    { number: "10", label: "Modules", accent: false },
    { number: "50+", label: "Scenarios", accent: false },
    { number: "Free", label: "Open Source", accent: true },
  ];

  return (
    <div className={styles.statsBar}>
      {stats.map((stat, i) => (
        <div key={i} className={styles.statItem}>
          <div className={stat.accent ? styles.statNumberAccent : styles.statNumber}>
            {stat.number}
          </div>
          <div className={styles.statLabel}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function FeatureCard({ icon, title, description, link, accent, tags }: Feature) {
  return (
    <Link className={styles.featureCard} to={link} aria-label={`${title} - ${description}`}>
      <div
        className={styles.featureIconBox}
        style={{
          background: `${accent}15`,
          border: `1px solid ${accent}25`,
          color: accent,
        }}
      >
        {icon}
      </div>
      <Heading as="h3" className={styles.featureTitle}>
        {title}
      </Heading>
      <p className={styles.featureDescription}>{description}</p>
      {tags.length > 0 && (
        <div className={styles.featureTags}>
          {tags.map((tag) => (
            <span key={tag} className={styles.featureTag}>{tag}</span>
          ))}
        </div>
      )}
    </Link>
  );
}

function FeaturesSection() {
  return (
    <section className={`${styles.section} ${styles.altSection}`}>
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader}>
          <Heading as="h2" className={styles.sectionTitle}>Core Modules</Heading>
          <p className={styles.sectionSubtitle}>Everything you need for DevOps interview prep</p>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((props, idx) => (
            <FeatureCard key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LearningPath() {
  const steps = [
    {
      step: "01",
      title: "Master the Fundamentals",
      description: "Browse 1000+ questions across all modules, from Linux basics to Kubernetes advanced topics.",
    },
    {
      step: "02",
      title: "Practice Real Scenarios",
      description: "Troubleshoot real production incidents: CPU spikes, memory leaks, network failures, and pod crashes.",
    },
    {
      step: "03",
      title: "Ace the Interview",
      description: "Cover big tech high-frequency topics and get the DevOps/SRE offer you deserve.",
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader}>
          <Heading as="h2" className={styles.sectionTitle}>Your Learning Path</Heading>
          <p className={styles.sectionSubtitle}>A structured approach to mastering DevOps interviews</p>
        </div>
        <div className={styles.learningGrid}>
          {steps.map((step, i) => (
            <div key={i} className={styles.learningCard}>
              <div className={styles.learningStepLabel}>STEP {step.step}</div>
              <Heading as="h3" className={styles.learningTitle}>{step.title}</Heading>
              <p className={styles.learningDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaCard}>
        <Heading as="h2" className={styles.ctaTitle}>Ready to Level Up?</Heading>
        <p className={styles.ctaDescription}>1000+ questions, 50+ real scenarios — all free and open source.</p>
        <div className={styles.ctaButtons}>
          <Link className={styles.primaryButton} to="/docs/linux/">
            Start Learning
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            className={styles.ctaSecondaryButton}
            to="https://github.com/HT-MA/devops-interview-guide"
            aria-label="Star on GitHub"
          >
            <Star size={16} aria-hidden="true" />
            Star on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title="DevOps Interview Handbook"
      description="云原生 / SRE / Kubernetes / CI-CD 面试知识库，包含 1000+ 高频题目和真实生产案例"
    >
      <div className={styles.pageWrapper}>
        <HomepageHeader />
        <StatsBar />
        <FeaturesSection />
        <LearningPath />
        <CTASection />
      </div>
    </Layout>
  );
}
