---
id: interview-tools
title: CI/CD 工具链面试题
description: CI/CD 工具链对比与选型面试题，涵盖 GitHub Actions vs GitLab CI vs Jenkins X、Tekton vs Argo Workflows、自托管 Runner 管理等真实面试场景
---

# CI/CD 工具链面试题

## Q1: GitHub Actions、GitLab CI、Jenkins X 在实际生产环境中怎么选型？各有什么优劣？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- 选型的关键因素：团队规模、技术栈、托管方式、预算、现有基础设施
- GitHub Actions 优势在于生态和易用性，劣势在复杂的编排和自托管
- GitLab CI 优势在于一体化和 Auto DevOps，劣势是 SI（单实例）架构的扩展性
- Jenkins X 面向 K8s 原生，抽象层次高，但学习曲线陡峭

**完整回答**:

这是一个很实际的问题——每当我加入一个新团队，基本上都会面对 CI/CD 工具的选型或迁移决策。我用这三个工具的先后顺序是 Jenkins → Jenkins X → GitHub Actions，所以对它们的优劣有切身体会。

**GitHub Actions**。

优势非常明显：第一，它与 GitHub 仓库深度集成，不需要额外搭建 CI 服务器，PR 状态、Check 结果、Merge 按钮的联动体验是三个工具中最好的。第二，Marketplace 生态丰富——从 Docker 构建到 K8s 部署到 Slack 通知，80% 的场景可以直接复用社区 Action。第三，矩阵构建（Matrix Build）的配置非常简洁——一行 `matrix` 声明就能生成多个并行 job。

劣势：第一，复杂的 DAG 编排能力有限。GitHub Actions 的 job 依赖是简单的 `needs` 关系，不支持条件分支、循环、人工审批等复杂流程。如果团队需要复杂的发布流水线（比如分阶段金丝雀 + 多环境审批 + 动态 Actor 执行），GitHub Actions 的表达能力不够。第二，日志和调试体验差——没有类似 Jenkins 的 Pipeline Stage View 或者 GitLab 的详细日志分段，排查问题需要 roll your own 的 debug 方案。第三，自托管 Runner 的管理比较原始——没有中心化的 Runner 管理面板，Health Check 和 Auto-scaling 都需要自己实现。

**GitLab CI**。

GitLab CI 最核心的优势是"一体化"——代码仓库 + CI/CD + 容器仓库 + 制品仓库 + 安全扫描 + Wiki，全部在一个产品里。对于中小团队来说，这大大降低了工具链的维护成本。GitLab 的 Auto DevOps 功能让"开箱即用"做得很好——创建一个项目，打开 Auto DevOps，什么都不用配就能得到一条完整的 CI/CD 流水线。

另一个亮点是 GitLab CI 的 `rules` 语法——它比 GitHub Actions 的 `if` 条件更灵活，支持基于变量、分支、Pipeline 事件等条件来决定是否执行某个 Job。

劣势：GitLab 的单实例架构（Single Instance）在高并发场景下会遇到性能瓶颈。我们有 2000+ 项目的团队使用 GitLab CE 时，CI 调度延迟从几秒变成了几分钟——主要原因是 Sidekiq 处理 CI Job 队列的压力太大。GitLab 官方推荐的解决方案是 Horizontal Scaling（多 Sidekiq + Redis Cluster），但配置复杂度相当高。另外，GitLab CI 的 Runner 注册和管理也比 GitHub Actions 的 Runner 复杂——需要维护 Registration Token、配置 Concurrent 参数、管理 config.toml。

**Jenkins X**。

Jenkins X 是对传统 Jenkins 的一次彻底重构——它不再使用 Jenkins Master/Agent 架构，而是基于 Tekton 构建，运行在 K8s 之上。它最大的特点是"约定优于配置"：通过 `jx` 命令创建的项目会自动生成标准的 CI/CD 流水线和预览环境。

优势：和 K8s 生态的集成深度是三者中最强的——Preview Environment（自动为每个 PR 创建独立的 K8s 环境）、Lighthouse（统一 Webhook 处理）、Nexus/Chartmuseum（制品管理）都是开箱即用。适合需要"全功能 GitOps"的 K8s 团队。

劣势：抽象层次太高。当流水线不按预期工作时，排查问题需要理解 Tekton 的 Task/Pipeline/PipelineRun CRD、理解 Jenkins X 的 Addon 和 App 机制、理解 Helm 的 Chart 结构——学习曲线极陡。我们团队用了 6 个月 Jenkins X，最后换回 GitHub Actions + ArgoCD 的自定义组合，因为"出了问题我们知道自己配了什么"。

**选型建议**：

- 团队在 GitHub 上、规模 < 50 人、需求标准：选 GitHub Actions，开箱即用，生态最好
- 团队用 GitLab、需要一体化平台、内部部署：选 GitLab CI，Auto DevOps 可以快速启动
- 团队深度使用 K8s、需要 GitOps + Preview Environment + 全自动 CI/CD：Jenkins X 值得考虑，但要有充足的学习预算
- 如果团队已经投资了 Jenkins：不一定需要迁移——通过 Jenkins Shared Libraries + Declarative Pipeline + K8s Plugin，传统 Jenkins 也能达到合格的 CI/CD 水平

**追问**:
- Q: 有没有遇到过从 Jenkins 迁移到 GitHub Actions 的 case？迁移过程中最大的挑战是什么？
- Q: GitLab CI 的 `needs` 关键字和 GitHub Actions 的 `needs` 在 DAG 编排能力上有什么区别？
- Q: Jenkins X 3.x 的改进和新架构是怎样的？它和 Jenkins X 2.x 有什么区别？

---

## Q2: Jenkins Pipeline Shared Library 你们是怎么设计和管理的？共享库的版本控制如何做？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 腾讯、阿里、快手

**答案要点**:
- Shared Library 是 Jenkins 实现"一次编写，多处复用"的核心机制
- 需要制定严格的共享库工程规范——目录结构、函数接口、异常处理
- 版本管理使用 Git tag + LoadLibrary 的版本选择
- 共享库的测试需要专门设计——单元测试用 JenkinsPipelineUnit，集成测试在真实 Jenkins 中运行

**完整回答**:

Shared Library 是在 Jenkins 中做 Pipeline as Code 规模化的必经之路。没有共享库，每个 Jenkinsfile 都在重复相同的构建逻辑。

**共享库的标准化结构**：

我们团队维护了三个共享库：

```
vars/                    # 全局变量（实际是可调用函数）
  dockerBuild.groovy    # Docker 构建函数
  k8sDeploy.groovy      # K8s 部署函数
  notify.groovy         # 通知函数
  commonCleanup.groovy  # 清理函数

src/                     # 辅助类（遵循 Java/Groovy 包结构）
  com/company/pipeline/
    DockerUtils.groovy
    K8sUtils.groovy
    SlackNotifier.groovy
    VersionManager.groovy

resources/               # 静态资源
  templates/
    deploy.yaml
  config/
    default-settings.yaml
```

`vars/` 目录下的每个 `.groovy` 文件会被 Jenkins 自动识别为全局变量。比如 `vars/dockerBuild.groovy` 定义了：

```groovy
def call(Map config) {
    def registry = config.registry ?: 'registry.example.com'
    def imageName = config.imageName
    def tag = config.tag ?: env.BUILD_NUMBER
    
    pipeline {
        agent any
        stages {
            stage('Docker Build') {
                steps {
                    script {
                        docker.build("${registry}/${imageName}:${tag}")
                    }
                }
            }
            stage('Docker Push') {
                steps {
                    script {
                        docker.withRegistry("https://${registry}", config.credId) {
                            docker.image("${registry}/${imageName}:${tag}").push()
                        }
                    }
                }
            }
        }
    }
}
```

在业务项目的 Jenkinsfile 中调用：

```groovy
@Library('company-pipeline-library@v2.1.0') _
// LoadLibrary 的版本选择——@v2.1.0 指定版本

dockerBuild(
    registry: 'harbor.example.com',
    imageName: 'myapp',
    tag: env.BUILD_NUMBER,
    credId: 'harbor-robot-account'
)
```

**版本管理**：

共享库的版本管理有几个方案，我们用的是 Git tag + `@` 引用：

```bash
# 创建共享库版本
git tag -a v2.1.0 -m "Release v2.1.0: Add K8s deploy retry logic"
git push origin v2.1.0

# Jenkinsfile 中引用指定版本
@Library('company-pipeline-library@v2.1.0') _
# 或引用最新 master（不推荐用于生产）
@Library('company-pipeline-library') _
```

版本管理的实践原则：

- 主版本号（Major）：Breaking change——函数签名变更、行为语义变更
- 次版本号（Minor）：新增功能——新增函数或参数，向后兼容
- 补丁版本（Patch）：Bug 修复——不影响接口和行为的变更

同时，我们维护了一个 `CHANGELOG.md` 记录每个版本的变更内容。

**共享库的测试**：

这是一个容易被忽略但极其重要的环节。Jenkins Pipeline 的测试比普通代码测试困难得多，因为 Pipeline 的执行依赖 Jenkins 环境。

我们的测试策略分两层：

第一层：单元测试。使用 JenkinsPipelineUnit 框架，在本地运行：

```groovy
// 共享库单元测试示例
class DockerBuildTest extends BasePipelineTest {
    @Test
    void testDockerBuildWithDefaultRegistry() {
        def script = loadScript('vars/dockerBuild.groovy')
        script.call(imageName: 'myapp', tag: '123')
        
        // 验证 Docker 构建命令
        assertThat(helper.callStack.findAll { call ->
            call.methodName == 'sh' && call.args[0].toString().contains('docker build')
        }).isNotEmpty()
    }
}
```

第二层：集成测试。在专门的测试 Jenkins 实例中（Docker 部署），创建一个测试项目并执行完整的 Pipeline，验证产物是否正确生成。

**生产环境踩过的坑**：

共享库中使用 `node {}` 和 `stage {}` 会导致 Pipeline 进入 Scripted Pipeline 模式，无法正确生成 Declarative Pipeline 的 Stage View。这是一个非常隐蔽的问题——共享库的函数内部不应该包裹 `node {}` 和 `stage {}`，这些应该在 Jenkinsfile 中声明。

另一个坑是共享库的序列化问题。Jenkins Pipeline 在执行过程中会将 Pipeline 脚本的状态序列化到磁盘上，用于"暂停-恢复"机制。如果共享库中的闭包引用了不可序列化的对象（如网络连接、文件句柄），会导致 `NotSerializableException`。解决方案是在闭包中只使用可序列化的数据类型，或者使用 `@NonCPS` 注解标记非序列化的方法。

**追问**:
- Q: 共享库的 LoadLibrary 支持多个共享库同时加载吗？如果两个共享库有同名函数，谁覆盖谁？
- Q: Jenkins 的 CPS（Continuation Passing Style）是什么？为什么共享库中的循环和条件语句需要特殊处理？
- Q: 你们怎么保证共享库的向后兼容性？有没有因为共享库升级导致下游 Jenkinsfile 大面积失败的事故？

---

## Q3: Tekton 和 Argo Workflows 在 CI/CD 场景下有什么不同？你们怎么选择的？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、蚂蚁集团、腾讯

**答案要点**:
- Tekton 是 K8s 原生的 CI/CD 框架，专注于构建和测试流水线
- Argo Workflows 是 K8s 原生的工作流引擎，擅长任务编排和 DAG 执行
- Tekton 使用 CRD（Task、Pipeline、PipelineRun）定义流水线，状态存储为 K8s 资源
- Argo Workflows 使用 Workflow CRD，支持更复杂的条件、循环、递归和 Step 模板

**完整回答**:

这两个工具都运行在 K8s 之上，但设计目标和适用场景有本质差异。

**Tekton：面向 CI 的构建引擎**。

Tekton 的设计定位是"K8s 上的 CI 引擎"。它的核心抽象是：

- `Task`：一组按序执行的 Step（每个 Step 是一个容器）
- `Pipeline`：一组按 DAG 组织的 Task
- `TaskRun` / `PipelineRun`：Task 和 Pipeline 的单次执行实例
- `PipelineResource`（Deprecated in v1）：流水线的输入输出，已被 `Workspace` 替代

我们的 CI 流水线用 Tekton 重构的一部分典型 Task：

```yaml
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: maven-build
spec:
  params:
  - name: module
    type: string
  - name: skipTests
    type: string
    default: "false"
  workspaces:
  - name: source
    mountPath: /workspace
  - name: maven-cache
    mountPath: /root/.m2
  steps:
  - name: compile
    image: maven:3.8-eclipse-temurin-17
    script: |
      mvn compile -pl $(params.module) -am
    workingDir: $(workspaces.source.path)
  - name: test
    image: maven:3.8-eclipse-temurin-17
    script: |
      if [ "$(params.skipTests)" != "true" ]; then
        mvn test -pl $(params.module) -am
      fi
    workingDir: $(workspaces.source.path)
```

Tekton 的优势是"极致的 K8s 原生"——你的流水线就是 K8s 资源，用 `kubectl` 就能管理，不需要额外的 CLI。每个 Step 运行在独立的容器中，资源隔离天然存在。

但 Tekton 的缺陷也很明显：DAG 编排能力非常基础。没有条件分支（只有 `when` 表达式）、没有循环、没有递归、没有人工审批节点、没有超时控制（虽然有 `timeout` 字段但能力有限）。如果你需要一个"如果测试通过就发 Slack 通知，如果失败就创建 Jira Ticket"的条件逻辑，在 Tekton 中需要自己写脚本实现。

**Argo Workflows：面向工作流编排的引擎**。

Argo Workflows 的设计定位是"K8s 上的工作流引擎"。它的核心抽象是 `Workflow`，一个 Workflow 包含多个 `Template`，Template 之间可以有复杂的控制流关系。

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: deployment-pipeline-
spec:
  entrypoint: main
  templates:
  - name: main
    steps:
    - - name: build-and-test
        template: build-and-test
    - - name: deploy-staging
        template: deploy
        arguments:
          parameters: [{name: env, value: staging}]
      - name: security-scan
        template: security-scan
    - - name: approve-production
        template: approval
    - - name: deploy-prod
        template: deploy
        arguments:
          parameters: [{name: env, value: production}]
        when: "{{steps.approve-production.outputs.result}} == approved"

  - name: approval
    suspend: {}    # 等待人工审批

  - name: deploy
    inputs:
      parameters:
      - name: env
    container:
      image: bitnami/kubectl:latest
      command: [kubectl]
      args: ["apply", "-f", "deploy/{{inputs.parameters.env}}/"]
```

Argo Workflows 在控制流方面比 Tekton 强得多——`steps` 支持串行/并行混合编排、`dag` 支持完整 DAG、`suspend` 支持人工审批、`when` 支持条件执行、`withItems`/`withParam` 支持循环。同时支持 Artifact 在 Step 间传递、Output Parameters 引用、递归模板调用。

但 Argo Workflows 的问题在于：它的设计目标是"做任何事"的工作流引擎，而不是专门为 CI/CD 设计的。因此没有内置的"源码拉取"、"Git 触发"、"测试报告"等 CI 概念——这些都靠你自己组装。

**选型建议**：

我们的选择是：**Tekton 做 CI（构建和测试），Argo Workflows 做 CD（部署编排）**，ArgoCD 做 GitOps 同步。

具体来说：代码提交触发 Tekton PipelineRun，编译构建 + 测试 + 安全扫描；扫描通过后 Tekton 的一个 Task 调用 Argo Workflows API 触发一个部署工作流；部署工作流在 Argo Workflows 中执行"审批 → Staging → 验证 → 审批 → Production"的编排。

如果团队规模小，只做 CI/CD，不需要引入两个工具——GitHub Actions 或 GitLab CI 就够了。Tekton + Argo Workflows 的组合更适用于"CI/CD 体系需要自建"的大型团队。

**追问**:
- Q: Tekton 的 `PipelineRun` 在 Pod 调度方面有什么特点？如何利用 K8s 的亲和性调度优化 Tekton Runner 的部署？
- Q: Argo Workflows 的 `suspend` 节点和 `approval` 模板在实现上有什么区别？人工审批超时后怎么处理？
- Q: Tekton 的 `Results` 功能和 Argo Workflows 的 `Output Parameters` 在设计理念有什么异同？如何跨 Task/Step 传递复杂数据？

---

## Q4: 跨平台 CI（ARM64/AMD64）你们是怎么做的？多架构镜像构建有哪些方案？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、华为、腾讯

**答案要点**:
- ARM64 服务器（AWS Graviton、Ampere Altra）的比例在快速增长，多架构 CI 已成刚需
- Docker Buildx 的 `--platform` + QEMU 模拟是目前最通用的方案
- 交叉编译（Cross-compilation）比模拟构建更快，但受限于语言和编译链
- 多架构镜像通过 Manifest List（OCI Index）来实现单个 Tag 对应多平台

**完整回答**:

随着 AWS Graviton、华为鲲鹏、Ampere Altra 等 ARM 服务器的普及，"写一次，跑在两个架构上"已经是生产环境的现实需求。

**方案一：Docker Buildx + QEMU 模拟**（通用方案，我们主要使用）。

核心原理：在 AMD64 的 CI Agent 上通过 QEMU 用户态模拟器运行 ARM64 的指令。Docker Buildx 自动处理了 QEMU 的注册和调用：

```yaml
# GitHub Actions 多架构构建
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3
  with:
    platforms: arm64,amd64

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push multi-arch image
  uses: docker/build-push-action@v5
  with:
    context: .
    platforms: linux/amd64,linux/arm64
    push: true
    tags: registry.example.com/myapp:latest
```

这个方案的优点是：不需要修改 Dockerfile，不需要修改代码，一个命令直接构建出支持两个架构的镜像。Buildx 会分别在两个架构上执行 `FROM`、`RUN`、`COPY` 等指令，最终合并为一个 Manifest List。

缺点：QEMU 模拟有性能损失。实测在 AMD64 模拟 ARM64 时，编译速度下降 2-3 倍。如果 Dockerfile 中有大量的 `RUN` 指令（比如 npm install 编译 native addon），时间会显著增加。

**方案二：原生 ARM64 CI Agent + 交叉编译**（高性能方案）。

如果团队有足够的 ARM64 机器（比如 AWS Graviton 实例），可以搭建原生的 ARM64 CI Agent：

```
# 使用矩阵构建，各跑各的架构
jobs:
  build:
    strategy:
      matrix:
        arch: [amd64, arm64]
    runs-on: ${{ matrix.arch == 'arm64' && 'arm-runner' || 'ubuntu-latest' }}
    steps:
    - uses: actions/checkout@v4
    - name: Build Docker image
      run: |
        docker build --platform linux/${{ matrix.arch }} \
          -t registry.example.com/myapp:linux-${{ matrix.arch }} .
        docker push registry.example.com/myapp:linux-${{ matrix.arch }}

  merge-manifest:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - name: Create manifest list
      run: |
        docker manifest create registry.example.com/myapp:latest \
          registry.example.com/myapp:linux-amd64 \
          registry.example.com/myapp:linux-arm64
        docker manifest push registry.example.com/myapp:latest
```

对于 Go 和 Rust 语言的应用，交叉编译非常高效——`GOOS=linux GOARCH=arm64 go build` 直接在 AMD64 机器上编译出 ARM64 可执行文件，不需要 QEMU 模拟。Java、Python、Node.js 等语言则依赖 JVM/解释器的跨平台能力，不需要特殊处理。

**多架构镜像的消费端**：

构建好的 Manifest List 被 K8s 节点拉取时，kubelet 会自动选择对应架构的镜像。用户不需要关心底层架构：

```bash
# 查看 Manifest List 的内容
docker manifest inspect registry.example.com/myapp:latest
# 输出显示 linux/amd64 和 linux/arm64 两个 manifest
```

**实践建议**：

对于中小团队，直接用 Docker Buildx + QEMU 方案，简单可靠。对于大规模团队（100+ 微服务），建议搭建原生 ARM64 Runner，配合交叉编译加速。

CI 流水线中的多架构构建不应该在每次提交时都跑——我们的策略是：PR 阶段只跑 AMD64（足够做测试验证），在合并到主分支时才触发多架构构建。

**追问**:
- Q: QEMU 模拟下运行 `npm install` 时，native addon（如 node-sass、sharp）需要特殊处理吗？它们怎么跨平台编译的？
- Q: K8s 集群中存在 ARM 和 AMD 混部时，如何确保 Pod 被调度到正确的架构节点上？NodeSelector 和 NodeAffinity 怎么配置？
- Q: OCI Image Spec 的 Manifest List 和 Multi-Arch Image Index 的关系是什么？Docker 和 OCI 标准在这个层面有什么区别？

---

## Q5: GitHub Actions 的缓存机制在生产环境你们是怎么用的？遇到过哪些性能和一致性问题？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 美团、字节跳动、拼多多

**答案要点**:
- GitHub Actions 缓存通过 `actions/cache` 和 `actions/cache/save` / `actions/cache/restore` 管理
- Cache key 设计决定了命中率，需要平衡"精确匹配"和"部分匹配"
- Cache 容量限制（每个仓库 10GB）和跨分支不可见性（分叉分支）是常见约束
- 大规模团队需要关注 Cache 命中率和 Storage 成本控制

**完整回答**:

GitHub Actions 的缓存机制设计得比较简单——本质上是一个基于对象存储的 Key-Value 存储。但生产环境下有很多细节需要处理。

**缓存策略的设计**：

我们为不同的依赖使用不同的缓存粒度：

```yaml
# 分层缓存策略
- name: Cache npm dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      npm-${{ runner.os }}-

- name: Cache Maven dependencies
  uses: actions/cache@v4
  with:
    path: ~/.m2/repository
    key: maven-${{ runner.os }}-${{ hashFiles('**/pom.xml') }}
    restore-keys: |
      maven-${{ runner.os }}-

- name: Cache Go modules
  uses: actions/cache@v4
  with:
    path: |
      ~/go/pkg/mod
      ~/.cache/go-build
    key: go-${{ runner.os }}-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      go-${{ runner.os }}-
```

关键实践：

第一，**将 `restore-keys` 作为兜底策略**。`key` 精确匹配时直接命中缓存，速度最快。如果 lock 文件变更导致 key 不匹配，`restore-keys` 会尝试最近的一次缓存（即使不完全匹配）。例如 `npm-${{ runner.os }}-` 会匹配最新的 `npm-linux-*` 缓存。虽然部分缓存需要额外下载一些包，但比完全不缓存快得多。

第二，**在 matrix 构建中正确区分缓存**。对于多 Node 版本矩阵构建，cache key 必须包含 Node 版本：

```yaml
strategy:
  matrix:
    node-version: [16, 18, 20]

steps:
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-${{ runner.os }}-node${{ matrix.node-version }}-${{ hashFiles('**/package-lock.json') }}
```

如果不区分，npm 缓存可能在 Node 16 和 Node 20 之间共享——某些包在版本间有不兼容的本机 addon。

**Cache 的痛点和解决方案**：

痛点一：**缓存跨分支不可见**。GitHub Actions 的缓存是"基于分支"的——`main` 分支创建的缓存可以被任何分支读取，但功能分支创建的缓存只能被该功能分支及其子分支读取。这意味着：一个新分支的第一次 CI 运行永远无法命中缓存（除非基于 main 分支创建时 main 已经有缓存）。这是设计如此，不是 Bug。我们通过定期在 main 分支上运行一个"缓存预热"的 workflow 来缓解——每周构建一次所有服务的依赖，生成缓存。

痛点二：**缓存容量限制**。每个仓库的缓存上限是 10GB（GitHub 托管 Runner）或受存储配额限制。超过限制时，旧的缓存自动被淘汰（LRU）。对于大型 Monorepo，10GB 可能不够。我们的解决方案：只缓存 `~/.npm`（tar 包缓存），不缓存 `node_modules`（解压后的目录）。`node_modules` 占用空间大但恢复时仍然需要解压，收益不大。另外，定期清理无效的缓存——用 `gh actions cache list` 查看，或者通过 `actions/cache` 的 `save-always: false` 来控制哪些 workflow run 创建缓存。

痛点三：**缓存不一致**。这是最严重的问题。我们遇到过三次"我的代码在 CI 的旧缓存上跑"的问题——原因是 cache key 的 `hashFiles` 只检测了 `package-lock.json`，但如果有人手动改了 `node_modules` 的内容而没有更新 lock 文件，缓存的 `node_modules` 和 lock 文件就不一致。我们的对策：在 CI 中增加 `npm ci`（不是 `npm install`），`npm ci` 会检测 lock 文件和 `node_modules` 的一致性，如果不一致就报错。

**Cache Action v4 的变化**：

GitHub 在 `actions/cache@v4` 中引入了几个变化：缓存路径支持 Glob 模式；分段缓存（`save`/`restore` 分开）；缓存 Segment 大小限制调整。其中分段缓存最有价值——它允许你在 job 的不同阶段分别保存和恢复缓存，比如在 build 阶段保存编译缓存后在 test 阶段恢复使用。

**追问**:
- Q: 你们有没有遇到过 GitHub Actions Cache 的"缓存污染"问题？怎么定位和处理的？
- Q: `actions/cache@v4` 的分段缓存相比 v3 的单一缓存有哪些性能提升？什么场景下收益最大？
- Q: 如果多个 workflow 使用相同的 cache key，写入并发怎么处理？后写入的会覆盖先写入的吗？

---

## Q6: 自托管 Runner（Self-Hosted Runner）你们是怎么管理的？部署在 K8s 上有哪些经验和坑？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- 自托管 Runner 的核心价值：突破 GitHub Actions 的硬件限制、访问内网资源、降低成本
- K8s 上部署 Runner 可以实现弹性伸缩——有 Job 时创建 Pod，空闲时缩容到 0
- 管理自托管 Runner 关注几个重点：安全隔离、自动伸缩、缓存持久化、Runner 注册/注销
- 相比 GitHub 托管 Runner，自托管的维护成本高很多

**完整回答**:

自托管 Runner 是"用运维成本换计算资源灵活性"的方案。我们团队有两个主要的 Runner 集群：一个在 AWS EKS 上跑通用 CI 任务，另一个在自建 IDC 的 K8s 集群上跑需要访问内部网络的 Job。

**K8s 上部署 Runner 的架构**：

核心组件是 `actions-runner-controller`（ARC），它是 GitHub 官方维护的 K8s Operator，负责管理 Runner Pod 的生命周期：

```yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: ci-runner
spec:
  replicas: 2
  template:
    spec:
      repository: company/myapp
      group: default
      labels:
        - self-hosted
        - linux
        - x64
      env:
        - name: RUNNER_TOKEN
          valueFrom:
            secretKeyRef:
              name: runner-secret
              key: token
      tolerations:
      - key: "ci-only"
        operator: "Exists"
        effect: "NoSchedule"
      resources:
        requests:
          cpu: "2"
          memory: "4Gi"
        limits:
          cpu: "4"
          memory: "8Gi"
  replicas: 0    # 起始副本为 0，通过 HPA 或 Runner 数量自动缩放
```

**弹性伸缩**：

我们使用 ARC 的 `HorizontalRunnerAutoscaler`（HRA）来实现基于 CI Job 队列深度的自动伸缩：

```yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: HorizontalRunnerAutoscaler
metadata:
  name: ci-runner-autoscaler
spec:
  scaleTargetRef:
    name: ci-runner
    kind: RunnerDeployment
  minReplicas: 0
  maxReplicas: 20
  scaleUpTriggers:
  - duration: 5m
    githubAPIReplicas:
      replicas: 15     # 队列里有 Job 时快速扩展到 15 个
  scaleDownDelay: 30m  # 最后一个 Job 完成后，等待 30 分钟再缩容
```

这里 `scaleDownDelay: 30m` 是实战经验——如果没有这个延迟，Runner 会在 Job 结束后立即被销毁，如果有新 Job 进来就要重新创建 Pod（拉取镜像 + 注册 Runner + 等待 Assignment，大约 1-2 分钟），这会显著延长 Job 等待时间。30 分钟的延迟平衡了成本和响应速度。

**Runner 的镜像管理**：

自托管 Runner 的镜像需要包含常见的 CI 工具链。我们的 Runner 镜像基于 `ubuntu:22.04`，预装了：Docker CLI（DinD）、Node.js 18/20、Python 3.10、Go 1.21、Java 17、kubectl、Helm、Terraform、AWS CLI、Docker Compose。

镜像构建和更新的流程：
```
基础镜像: ubuntu:22.04
  └── Runner 镜像: runner-base:v1 (Docker + Node + Go + ...)
       └── Runner 镜像: runner-base:v2 (升级 Node 版本)
```

每次 Runner 镜像更新都需要验证——我们有一个专门的 Workflow 在 Runner 更新后自动执行一组"冒烟测试"来验证所有预装工具正常工作。

**安全的坑**：

自托管 Runner 最大的安全隐患是"恶意 Workflow 可以在 Runner 上执行任意代码"。GitHub 托管的 Runner 每个 Job 运行在一个干净的 VM 中，隔离性很好。自托管 Runner 在 K8s Pod 中运行，隔离性依赖于 Pod 的安全配置。

我们的安全措施：

```yaml
# Pod Security Context 配置
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
  containers:
  - name: runner
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
      readOnlyRootFilesystem: true
```

另外很重要的一点：自托管 Runner 不能运行在 PR 触发的 Workflow 上——因为 PR 的 Workflow 可以被 Fork 仓库的恶意代码修改。我们在 Runner 的配置中只接受 `push` 和 `workflow_dispatch` 事件触发的 Job，PR 事件使用 GitHub 托管的 Runner（免费额度足够 PR 场景的算力）。

**成本对比**：

我们用了一年自托管 Runner 后算了一笔账：自托管 Runner 的实际成本（EC2 实例 + EBS 存储 + 运维人力）大约是 GitHub 托管 Runner 的 60%。但运维复杂度更高——需要处理 K8s 集群升级、Runner 镜像更新、存储容量规划、Runner Token 轮换等。

对于 50 人以下的团队，GitHub 托管 Runner 的性价比更高。自托管更适合：需要 GPU 构建、大内存构建（16GB+）、访问内部网络资源、大规模矩阵构建的场景。

**追问**:
- Q: 你们如何处理 Runner Pod 中的 Docker-in-Docker（DinD）？DinD 的 /var/run/docker.sock 挂载方案有什么安全隐患？
- Q: 自托管 Runner 的 Token 轮换策略是怎么做的？如果 Token 泄露了怎么快速吊销？
- Q: 如果 K8s 集群本身不可用（API Server 挂了），正在运行的 CI Job 会怎么处理？自动恢复机制有吗？

---

## 本题难度等级说明

| 难度 | 图标 | 对应层级 |
|------|------|----------|
| ⚫⚪⚪ 初级 | 初级 | 1-3 年经验 |
| ⚫⚫⚪ 中级 | 中级 | 3-5 年经验 |
| ⚫⚫⚫ 高级 | 高级 | 5 年+ 经验 |
