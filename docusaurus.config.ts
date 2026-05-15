import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  // 不使用自定义插件，换另一种方法
  // 添加未来可以添加插件的配置预留位置
  title: "DevOps Interview Handbook",
  tagline: "云原生 / SRE / Kubernetes / CI-CD 面试知识库",
  favicon: "img/logo.svg",
  url: "https://HT-MA.github.io",
  baseUrl: "/devops-interview-guide/",
  organizationName: "HT-MA",
  projectName: "devops-interview-guide",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "zh-Hans",
    locales: ["zh-Hans"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/HT-MA/devops-interview-guide/edit/main/",
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          editUrl: "https://github.com/HT-MA/devops-interview-guide/edit/main/",
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/social-card.jpg",
    navbar: {
      title: "DevOps Interview",
      logo: {
        alt: "DevOps Interview Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "面试题库",
        },
        {
          type: "docsVersionDropdown",
          position: "right",
        },
        {
          href: "https://github.com/HT-MA/devops-interview-guide",
          position: "right",
          className: "header-github-link",
          "aria-label": "GitHub repository",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "核心模块",
          items: [
            {
              label: "Linux",
              to: "/docs/linux/",
            },
            {
              label: "Kubernetes",
              to: "/docs/kubernetes/",
            },
            {
              label: "Docker",
              to: "/docs/docker/",
            },
            {
              label: "CI/CD",
              to: "/docs/cicd/",
            },
          ],
        },
        {
          title: "进阶内容",
          items: [
            {
              label: "监控告警",
              to: "/docs/monitoring/",
            },
            {
              label: "SRE",
              to: "/docs/sre/",
            },
            {
              label: "场景题",
              to: "/docs/scenarios/",
            },
          ],
        },
        {
          title: "资源",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/HT-MA/devops-interview-guide",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} DevOps Interview Handbook. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "yaml", "json", "toml", "docker"],
    },
    colorMode: {
      defaultMode: "light",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
