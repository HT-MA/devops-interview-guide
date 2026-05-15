
---

# 项目定位

## 项目名称（可选）

你可以挑一种风格：

### 偏专业

* DevOps-Interview-Guide
* DevOps-Knowledge-Base
* Awesome-DevOps-Interview
* CloudNative-Interview-Handbook

### 偏个人品牌

* HTMA DevOps Notes
* DevOps Journey
* DevOps Lab
* SRE & DevOps Handbook

### 偏中文社区

* DevOps面试宝典
* 云原生面试指南
* 运维工程师面试题库

---

# 推荐技术方案

我建议：

## 方案一（强烈推荐）

# 使用 Docusaurus

Docusaurus

优点：

* 天然适合知识库
* GitHub Pages 部署简单
* UI 很现代
* 支持搜索
* 支持 Markdown
* 支持暗黑模式
* 后期能加博客
* SEO 很好
* AI 很喜欢生成 Markdown

非常适合：

* 面试题库
* 技术文档
* 学习路线
* 知识库

---

# 最终效果

你的网站会像：

```text
首页
├── Linux
├── Docker
├── Kubernetes
├── CI/CD
├── Terraform
├── Ansible
├── AWS / 阿里云
├── Monitoring
├── SRE
├── Troubleshooting
├── 场景题
├── 高频面试题
└── 系统设计
```

---

# 我建议的项目结构

```text
devops-interview-guide/
├── docs/
│   ├── linux/
│   ├── docker/
│   ├── kubernetes/
│   ├── cicd/
│   ├── terraform/
│   ├── ansible/
│   ├── sre/
│   ├── monitoring/
│   ├── cloud/
│   ├── scenarios/
│   └── hr/
│
├── blog/
├── static/
├── src/
├── docusaurus.config.ts
├── sidebars.ts
└── README.md
```

---

# 内容体系设计（核心）

这个非常重要。

不要只是：

```text
Q: 什么是 Kubernetes
A: xxxx
```

太无聊。

应该：

---

# 推荐题目结构

## 示例

# Kubernetes Pod CrashLoopBackOff

## 面试官想考什么

* Pod 生命周期
* 容器启动机制
* 排障能力

## 标准答案

解释 CrashLoopBackOff 的含义。

## 常见原因

* 启动命令错误
* 健康检查失败
* OOMKilled
* 配置文件缺失

## 排查流程

```bash
kubectl describe pod xxx
kubectl logs xxx
kubectl get events
```

## 实战经验

生产环境里最常见的是：

* ConfigMap 没更新
* 探针配置错误

## 延伸问题

* OOMKilled 如何分析？
* livenessProbe 和 readinessProbe 区别？

---

这种结构特别像真实高级工程师。

---

# 你应该重点做的模块

---

# 1. Linux（最重要）

建议：

```text
进程管理
内存分析
CPU分析
网络
IO
systemd
权限
shell
日志分析
性能优化
```

经典命令：

```bash
top
htop
vmstat
iostat
sar
netstat
ss
lsof
strace
tcpdump
```

---

# 2. Kubernetes（流量核心）

这是搜索流量最大的。

建议：

```text
Pod
Deployment
Service
Ingress
ConfigMap
Secret
Helm
HPA
Scheduler
CNI
CSI
etcd
```

高级：

```text
Operator
Service Mesh
K8s 网络
调度器
集群故障
```

---

# 3. CI/CD

这个很适合结合你的经验。

建议：

* Jenkins
* GitHub Actions
* GitLab CI
* ArgoCD
* FluxCD

重点：

```text
流水线设计
蓝绿发布
金丝雀
回滚
灰度
```

---

# 4. 云原生监控

现在特别热门。

```text
Prometheus
Grafana
Loki
ELK
OpenTelemetry
Jaeger
```

重点：

* 告警风暴
* 指标设计
* 日志治理

---

# 5. 场景题（最加分）

这是你项目区别于别人的核心。

例如：

---

# 场景：线上 CPU 飙高

## 你会怎么做？

### 第一阶段

```bash
top
```

### 第二阶段

```bash
pidstat
```

### 第三阶段

```bash
strace
```

### 第四阶段

定位：

* 死循环
* GC
* 数据库阻塞

---

这种内容特别值钱。

---

# UI 设计建议

---

# 首页 Hero

```text
DevOps Interview Handbook

云原生 / SRE / Kubernetes / CI-CD 面试知识库

1000+ 高频题目
真实生产案例
持续更新
```

按钮：

```text
[开始学习]
[GitHub]
```

---

# 首页模块卡片

建议卡片：

* Linux
* Docker
* Kubernetes
* Terraform
* SRE
* CI/CD
* AWS
* Monitoring

---

# 加分功能（非常推荐）

---

# 1. 面试难度标签

```text
🟢 初级
🟡 中级
🔴 高级
```

---

# 2. 公司标签

```text
阿里
腾讯
字节
AWS
Google
```

---

# 3. 收藏功能（后期）

可以：

* localStorage
* IndexedDB

---

# 4. 搜索

Docusaurus 原生支持：

* Algolia

非常强。

---

# 5. AI 功能（你可以后期做）

你其实可以做：

## “AI 面试官”

输入：

```text
Kubernetes
```

AI 自动：

* 出题
* 追问
* 评分

这个会很酷。

---

# GitHub Pages 部署

Docusaurus 原生支持。

部署后：

```text
https://你的用户名.github.io/devops-interview-guide/
```

---

# 推荐 README 结构

```text
# DevOps Interview Guide

一个面向 DevOps / SRE / 云原生工程师的面试知识库。

## 内容

- Linux
- Docker
- Kubernetes
- CI/CD
- Terraform
- AWS
- Monitoring
- SRE

## 特点

- 高频面试题
- 场景化分析
- 真实生产经验
- 持续更新

## 在线阅读

GitHub Pages 地址
```

---

# 我建议你后续的发展方向

这个项目其实能演化成：

---

## 第一阶段

知识库

---

## 第二阶段

个人品牌

---

## 第三阶段

AI DevOps 面试平台

比如：

* AI 模拟面试
* AI 追问
* AI 评分
* AI 简历分析

这个方向现在很有潜力。

---

# 我建议你现在立即做的事情

## 第一步

创建仓库：

```text
devops-interview-guide
```

---

## 第二步

初始化：

```bash
npx create-docusaurus@latest devops-interview-guide classic
```

---

## 第三步

先写 10 篇高质量内容：

建议：

1. Linux CPU 100%
2. Pod CrashLoopBackOff
3. K8s 网络问题
4. Docker 镜像优化
5. Jenkins Pipeline
6. Prometheus 告警
7. Ingress 原理
8. Terraform 状态管理
9. Redis 排障
10. Nginx 502

---

## 第四步

开启 GitHub Pages

---

## 第五步

持续更新

