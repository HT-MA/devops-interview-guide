---
id: interview-deploy
title: 部署与发布面试题
description: 部署策略与发布管理高频面试题，涵盖蓝绿/金丝雀/滚动部署、ArgoCD、GitOps、渐进式发布等真实面试场景
---

# 部署与发布面试题

## Q1: 蓝绿部署、金丝雀部署、滚动部署在生产环境中分别适用什么场景？你们怎么选的？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动、美团

**答案要点**:
- 三种策略的核心区别在于"风险"和"速度"的权衡
- 蓝绿部署：两套完整环境，瞬间切换，适合关键业务，但资源成本翻倍
- 金丝雀部署：逐步放量，适合需要灰度验证的新功能，但回滚速度相对慢
- 滚动部署：逐批替换，资源占用最低，适合常规迭代，但缺乏精细控制

**完整回答**:

这三种策略我们都在生产环境中使用过，选型取决于业务场景和风险容忍度。

**蓝绿部署（Blue-Green Deployment）**。

蓝绿部署的核心是两套一模一样的环境——Blue 跑当前生产版本，Green 部署新版本。验证通过后，负载均衡器/路由从 Blue 切换到 Green。

我们什么时候用蓝绿：核心金融交易服务。这类服务的风险容忍度极低，要求回滚速度在秒级。蓝绿部署给了我们"一键回滚"的能力——切回 Blue 就可以了，不需要重新部署。

蓝绿的代价是资源翻倍——在 K8s 中需要两套独立的 Deployment，但可以通过命名空间或标签来区分。对于 50 个 Pod 的服务，蓝绿意味着同时运行 100 个 Pod。成本控制方面，我们会在流量切换完成后，保留旧版本 5 分钟（用于回滚），之后自动缩容到 0。

这里有一个常见陷阱：蓝绿需要在切换前确认数据库兼容。如果 Blue 和 Green 用了不同版本的数据模型，数据库 schema 变更需要向后兼容——否则切换后 Green 跑没问题，但回滚到 Blue 时数据已经变了。

**金丝雀部署（Canary Deployment）**。

金丝雀部署的核心是逐步放量——先让新版本服务 1% 的流量，观察几分钟无误后增加到 10%、50%、100%。

我们什么时候用金丝雀：面向用户的前端 API、推荐系统、AI 模型推理服务。这类服务的变更效果难以通过测试环境完全模拟，需要真实流量的验证。

金丝雀的技术实现有几个关键点：

第一，**流量拆分方式**。K8s Service 的默认 Round-Robin 没法按百分比控制。我们有两种方案：Service Mesh（Istio）的 VirtualService 流量权重，或者 Nginx Ingress 的金丝雀 annotation：

```yaml
# Istio VirtualService 流量拆分
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts:
  - myapp
  http:
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: myapp-v2
  - route:
    - destination:
        host: myapp-v1
        weight: 90
      - destination:
          host: myapp-v2
          weight: 10
```

第二，**观测与自动决策**。金丝雀不能只靠人肉看——当新版本的错误率上升 1%、P99 延迟增加 20% 时，应该自动回滚。我们用 Flagger 或 Argo Rollouts 来实现基于 Prometheus metrics 的自动金丝雀分析。

金丝雀的主要风险是"长尾效应"——当流量只放了 1% 时，如果故障路径非常冷门（比如某个特定的支付渠道），可能在小流量阶段无法暴露，全量后才触发。

**滚动部署（Rolling Update）**。

滚动部署是 K8s 默认策略——逐个替换 Pod，新老版本并存，Ready 一个再替换下一个。

我们什么时候用滚动：内部工具、后台 Job、无状态 API。这些服务出问题的影响面小，滚动部署的"无感升级"特性足够用了。

滚动的关键参数：
- `maxSurge`：允许超出期望副本数的比例。设为 25% 表示更新时最多可以有 125% 的 Pod
- `maxUnavailable`：更新中允许不可用的 Pod 比例。设为 0 表示始终保持所有 Pod 可用

我们的推荐值是 `maxSurge: 1, maxUnavailable: 0` 或 `maxSurge: 25%, maxUnavailable: 25%`，视资源余量而定。

**追问**:
- Q: 蓝绿部署中数据库的 schema 变更怎么处理？如果新版本改了表结构，回滚时旧版本不兼容新数据怎么办？
- Q: 你们的金丝雀发布有自动化的"通过/回滚"指标吗？具体用什么指标和阈值？
- Q: 在 K8s 中用 Service 权重做金丝雀时，Session 保持（Sticky Session）怎么处理？

---

## Q2: 你们在生产环境用 Feature Flags 吗？Feature Flags 和部署策略是怎么配合的？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、美团、拼多多

**答案要点**:
- Feature Flags 将"发布"和"上线"解耦——代码可以部署到生产，但功能通过开关控制是否可见
- 配合部署策略可以实现"暗部署"——先部署代码但不启用，降低发布风险
- LaunchDarkly 是商业化的 Feature Flag 平台，提供实时开关、目标用户细分、A/B 测试能力
- Feature Flags 本身有技术债务——累积的 Flag 需要定期清理

**完整回答**:

Feature Flags 在我们团队已经是一项基础能力，和 CI/CD 深度绑定。

**Feature Flags 的核心价值**：

传统部署中，发布和上线是同一个事件——代码部署到生产就意味着功能对用户可见。Feature Flags 打破了这个绑定：代码可以部署到生产环境，但功能开关默认关闭。当通过测试验证后，运营在后台打开开关，功能才真正对用户可见。

这带来了几个好处：

第一，**降低发布风险**。新功能可以提前部署到生产环境进行"暗测试"——代码在生产环境运行，但用户看不到新功能。如果发现 Bug，在后台关闭开关即可，不需要做镜像回滚。

第二，**按用户粒度控制**。LaunchDarkly 支持根据用户 ID、地域、设备类型、会员等级等维度控制开关。比如"新支付流程只对 10% 的北京地区 VIP 用户开放"——这在 Route 层实现非常复杂，在 Feature Flag 层就是一个配置项。

第三，**A/B 测试的基础设施**。Feature Flags 提供了流量拆分和指标关联的能力。LaunchDarkly 对接了我们的数据平台——每个 Flag 的曝光和转化数据自动上报到 ClickHouse，产品经理可以在后台查看数据报表。

**Feature Flags 和 CI/CD 的集成实践**：

```
代码部署流程：
1. 开发提交代码（新功能包裹在 Feature Flag 后面）
2. CI 构建并部署到生产（功能默认关闭）
3. QA 在生产环境启动 Flag，验证功能
4. 验证通过后，逐步开放给真实用户（金丝雀+Flag 双重控制）
5. 功能稳定后，移除 Flag 代码 + 删除 LaunchDarkly 中的 Flag
```

这里的关键是"Flag 环绕"的实现模式：

```javascript
// 典型 Feature Flag 用法
const ldClient = await LaunchDarkly.initialize(LD_SDK_KEY, user);

app.get('/api/v2/orders', async (req, res) => {
    const useNewCheckout = await ldClient.variation('new-checkout-flow', false);
    
    if (useNewCheckout) {
        return handleNewCheckout(req, res);
    }
    return handleLegacyCheckout(req, res);
});
```

生产环境需要管理 Flag 的默认值。我们的规则是：新 Flag 的默认值必须是"关闭"（fallback 是旧行为），这样即使 LaunchDarkly SDK 连不上服务器，服务的核心行为不会改变。

**Feature Flags 的代价**：

最大的代价是代码复杂度。每个 Feature Flag 意味着两条代码路径，这些路径需要持续维护直到 Flag 被移除。我们在 Jira 中为每个 Feature Flag 创建了"Flag 清理"子任务，规定功能稳定后两个 Sprint 内必须清理。但现实是——总有 Flag 在代码里躺了半年还没清理。

LaunchDarkly 上也有 Flag 膨胀的问题。我们的 LaunchDarkly 项目中积累了上千个 Flag，其中超过一半是"不再使用的"。我们每季度做一次 Flag 审计，通过 SDK 上报的 Flag 使用频率数据来识别僵尸 Flag。

**追问**:
- Q: 运行时改变 Flag 状态时，你们如何保证不打断用户的当前操作？Flag 的"热加载"机制是怎样的？
- Q: 你们遇到过 Feature Flag SDK 故障导致的线上事故吗？SDK 降级策略是怎么设计的？
- Q: Feature Flags 在微服务架构中，如何做跨服务的 Flag 一致性？如果 A 服务认为 Flag 是开启的，但 B 服务认为是关闭的，会有什么问题？

---

## Q3: ArgoCD 的 Sync 策略和 Sync Hooks 在生产环境你们是怎么配置的？遇到过什么坑？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、腾讯、蚂蚁集团

**答案要点**:
- ArgoCD 的核心是 GitOps——集群状态以 Git 仓库中的配置为准
- Sync 策略控制着"自动同步"的行为——Prune、SelfHeal、ApplyOutOfSyncOnly
- Sync Hooks 允许在 Sync 流程中插入自定义 Job——PreSync、Sync、PostSync、SyncFail
- 需要关注 Sync 的"漂移检测"和"自动修复"可能导致的问题

**完整回答**:

ArgoCD 是我们 GitOps 落地的核心组件。用了一年多，踩了不少坑，也积累了一套比较成熟的配置标准。

**Sync 策略配置**：

我们的标准生产配置：

```yaml
spec:
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
      - ApplyOutOfSyncOnly=true
      - RespectIgnoreDifferences=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

几个关键选项的生产经验：

`selfHeal: true` 是一把双刃剑。它保证了 Git 仓库中的配置是唯一的真相来源，任何手动 `kubectl edit` 都会被 ArgoCD 自动还原。但有一次排查问题时，SRE 在某台机器上执行 `kubectl scale deployment myapp --replicas=5` 想临时扩容，结果 ArgoCD 在 3 分钟内自动缩回了配置中的副本数。我们的教训是：生产环境扩容/缩容必须修改 Git 仓库中的配置，而不是通过 kubectl。为此我们在内部文档中明确标注了 "No kubectl edit on ArgoCD-managed resources"。

`PruneLast=true` 这个选项解决了"先创建再删除"还是"先删除再创建"的问题。默认情况下 ArgoCD 先创建新资源再删除旧资源——但某些情况下（如 PVC），旧资源删除导致 PVC 被回收，新 Pod 启动时拿不到数据。PruneLast 会先创建新资源，等待 Ready 后再清理旧资源，对 StatefulSet 和有状态服务的更新很关键。

**Sync Hooks 实践**：

我们的一个典型生产环境 Sync Hooks 配置：

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
spec:
  # ...
  sync:
    hooks:
      # PreSync: 在 Sync 之前执行数据库 Migration
      - type: PreSync
        kind: Job
        metadata:
          name: db-migration
          annotations:
            argocd.argoproj.io/hook: PreSync
            argocd.argoproj.io/hook-delete-policy: HookSucceeded
        spec:
          template:
            spec:
              containers:
                - name: migration
                  image: registry.example.com/app-migration:1.2.3
                  command: ["./run-migration.sh"]
              restartPolicy: Never
          backoffLimit: 2

      # PostSync: Sync 完成后执行 Smoke Test
      - type: PostSync
        kind: Job
        metadata:
          name: smoke-test
          annotations:
            argocd.argoproj.io/hook: PostSync
            argocd.argoproj.io/hook-delete-policy: HookSucceeded
        spec:
          template:
            spec:
              containers:
                - name: smoke
                  image: registry.example.com/app-smoke:1.2.3
                  command: ["./smoke-test.sh"]
              restartPolicy: Never
          backoffLimit: 1

      # SyncFail: Sync 失败时执行，用于发告警或清理
      - type: SyncFail
        kind: Job
        metadata:
          name: notify-failure
          annotations:
            argocd.argoproj.io/hook: SyncFail
        spec:
          template:
            spec:
              containers:
                - name: notify
                  image: curlimages/curl
                  command:
                    - "sh"
                    - "-c"
                    - "curl -X POST -H 'Content-Type: application/json' -d '{\"text\":\"ArgoCD Sync Failed: myapp\"}' $WEBHOOK_URL"
              restartPolicy: Never
```

**踩过的坑**：

最大的坑是 Hook Job 的重试行为。PreSync Hook 的 Job 默认会重试（backoffLimit: 6），但是 ArgoCD 在等待 PreSync Job 完成时，如果重试太多次，整个 Sync 流程可能超时。Sync 超时后 ArgoCD 标记为 "Sync Failed"，但 PreSync Job 可能还在后台运行——这就导致数据库 Migration 在后台还在跑，但部署流程已经认定失败了。

我们的解决方案是：PreSync Job 的 `backoffLimit` 设置为较小的值（2），并且 Migration 脚本本身要实现幂等性——"跑了一次和跑两次结果一样"。

另一个坑是 `argocd.argoproj.io/hook-delete-policy: HookSucceeded`。这个 annotation 告诉 ArgoCD，Hook Job 成功后自动删除。但如果 Job 失败了，Job 的 Pod 会保留下来供排查——如果没有设置保留策略，这些 Pod 会占用集群资源。我们建议同时设置 `ttlSecondsAfterFinished: 3600`。

**追问**:
- Q: ArgoCD 的 Sync 流程如果被多个 PR 触发，如何处理并发 Sync？队列机制是怎样的？
- Q: 你们 ArgoCD 的 HA 是怎么部署的？ArgoCD Redis 的高可用遇到过什么问题？
- Q: Config Management Plugin（CMP）在 ArgoCD 中的应用场景有哪些？你们自定义过 CMP 吗？

---

## Q4: 你们团队是用 Argo Rollouts 还是 Flagger？渐进式交付在生产环境是怎么落地的？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、蚂蚁集团

**答案要点**:
- Argo Rollouts 和 Flagger 都是渐进式交付（Progressive Delivery）的实现
- Argo Rollouts 是 Argo 生态的一部分，使用 CRD 替代原生 Deployment
- Flagger 与 Service Mesh 深度集成（Istio、Linkerd、App Mesh）
- 核心能力：自动金丝雀、指标分析、自动回滚、流量管理

**完整回答**:

我们选型 Argo Rollouts 而不是 Flagger，主要原因是团队已经在用 ArgoCD，希望减少技术栈的扩散。

**Argo Rollouts 的核心概念**：

Argo Rollouts 引入了一个新的 CRD `Rollout`，替代原生的 `Deployment`。Rollout 提供了原生的蓝绿和金丝雀策略，并且和 Service Mesh（Istio、SMI）或 Nginx Ingress 深度集成。

我们的典型金丝雀配置：

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: registry.example.com/myapp:v2.0.0
  strategy:
    canary:
      canaryService: myapp-canary    # 金丝雀 Service
      stableService: myapp-stable    # 稳定 Service
      trafficRouting:
        istio:
          virtualService:
            name: myapp-vsvc
            routes:
            - primary
      steps:
      - setWeight: 10
      - pause: {duration: 5m}         # 10% 流量观察 5 分钟
      - setWeight: 30
      - pause: {duration: 10m}        # 30% 流量观察 10 分钟
      - setWeight: 60
      - pause: {duration: 5m}         # 60% 流量观察 5 分钟
      - setWeight: 100                # 全量发布
      analysis:
        templates:
        - templateName: success-rate  # 自动指标分析模板
```

**Analysis Template 的设计**：

这是渐进式交付最核心的部分——自动决定"通过还是回滚"：

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
    - name: service-name
  metrics:
  - name: success-rate
    interval: 30s
    successCondition: result[0] >= 0.95    # 成功率 >= 95%
    failureLimit: 3
    provider:
      prometheus:
        query: >
          sum(rate(
            istio_requests_total{
              reporter="destination",
              destination_service_name~"{{args.service-name}}",
              response_code!~"5.*"
            }[1m]
          )) / 
          sum(rate(
            istio_requests_total{
              reporter="destination",
              destination_service_name~"{{args.service-name}}"
            }[1m]
          ))
  - name: latency-p99
    interval: 30s
    successCondition: result[0] <= 500    # P99 延迟 <= 500ms
    failureLimit: 3
    provider:
      prometheus:
        query: >
          histogram_quantile(0.99,
            sum(rate(
              istio_request_duration_milliseconds_bucket{
                destination_service_name~"{{args.service-name}}"
              }[1m]
            )) by (le)
          )
```

当金丝雀步骤到达某个权重时，Argo Rollouts 开始执行 AnalysisTemplate 中的指标查询。如果成功率低于 95% 或 P99 延迟超过 500ms，Rollouts 会自动将流量切回稳定版本并标记 Rollout 为 "Degraded"。

**实战经验**：

自动化的金丝雀分析听起来很完美，但在实际跑起来时我们遇到了几个问题：

第一，**误报问题**。有一次发布期间正好赶上某个上游服务故障，导致金丝雀版本的错误率飙升。但金丝雀版本本身没问题——请求是因为上游挂了而失败的。Rollouts 自动回滚了金丝雀，但其实回滚也没用（稳定版本同样依赖上游）。我们的解决方案是：AnalysisTemplate 中加入基线对比——比较新版本和旧版本在相同时间窗口内的错误率变化，而不是绝对阈值。

第二，**小流量下的统计偏差**。当金丝雀权重只有 1% 时，金丝雀版本的请求量很小（比如 10 req/min），一个 4xx 错误可能让成功率从 100% 掉到 90%。我们的做法是：不在第一个低权重步骤做严格指标分析，或者设置 minimum pod 数量保证统计数据有意义。

第三，**灰度过程中的渐进式暴露**。不是所有变更都适合金丝雀——比如数据库 Migration、配置变更。这类变更一经应用就是对所有 Pod 生效的，无法做"10% 的金丝雀"。Argo Rollouts 的解决方案是提供 "Ephemeral Metadata" 让金丝雀版本的 Pod 带上特定标签，但代码层面需要感知。

**追问**:
- Q: Argo Rollouts 的 BlueGreen 策略和金丝雀策略在实现上有什么本质区别？K8s Service 的流量切换逻辑是怎样的？
- Q: Flagger 的 Canary CRD 和 Argo Rollouts 的 Rollout CRD 在设计理念上有什么不同？
- Q: 如果金丝雀发布过程中 AnalysisTemplate 检测到指标异常，自动回滚的流程是怎样的？已经创建的金丝雀 Pod 怎么处理？

---

## Q5: GitOps 的核心原则是什么？你们团队 GitOps 落地过程中遇到了哪些挑战？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、阿里、字节跳动

**答案要点**:
- GitOps 核心理念：Git 仓库是系统状态的唯一真实来源（Single Source of Truth）
- 四个原则：声明式描述、版本化、自动化同步、自愈
- GitOps 不只是部署工具，更是一种运维模型和文化
- 实施中的主要挑战包括 Secret 管理、多环境配置差异、操作习惯改变

**完整回答**:

GitOps 实际上是用 Git 的工作流来管理基础设施和应用的部署。它的核心原则来自 Weaveworks 的定义：

**原则一：系统必须以声明式的方式描述**。

K8s 的 YAML 声明（Deployment、Service、ConfigMap）天然符合这个要求。2019 年我们团队还在用 Ansible playbook 部署应用时，每个环境有不同版本的 playbook，部署结果依赖 Ansible 的执行顺序。迁移到 GitOps 后，系统状态完全由 YAML 文件的集合描述，没有"隐式状态"。

**原则二：系统期望状态的权威来源存储在 Git 中**。

这不是"把 YAML 文件放到 Git 里"这么简单。关键是：运维团队不再通过 SSH 登录服务器执行命令，不再通过 Jenkins 的"构建后操作"触发部署。所有变更——从扩容缩容到配置修改，从版本升级到回滚——都必须通过 Git 提交来完成。

我们刚开始推 GitOps 时最大的阻力就在这里。SRE 习惯 `kubectl scale` 和 `kubectl edit deployment` 来快速解决问题。GitOps 要求他们必须先修改 Git 仓库的 YAML 文件，提交 PR，等待 CI 流程通过，再由 ArgoCD 自动同步到集群。整个流程比直接 kubectl 慢了几分钟。但好处是：每一次变更都有记录，有审批，可追溯。

**原则三：有自动化系统确保集群状态与 Git 中描述的期望状态一致**。

ArgoCD 的 Sync 机制就是这个"自动化系统"。它每 3 分钟（默认值，可配置）轮询一次 Git 仓库，检测是否有新的提交；同时每 3 分钟检测一次集群中资源的状态是否与 Git 配置一致（Drift Detection）。如果不一致，根据 SyncPolicy 的设置进行自动修复。

**原则四：有闭环的"检视-修复"机制（Self-Healing）**。

ArgoCD 的 `selfHeal: true` 实现了这一点。但 Self-Healing 不是万能的——它只能处理 Git 仓库中已有定义的范围。如果某个 Pod 因为 OOM 被 Kernel 杀掉了，Deployment 的 ReplicaSet 控制器会重新创建 Pod，这个由 K8s 自身的 Controller Manager 处理，不需要 ArgoCD 介入。

**落地挑战**：

挑战一：**Secret 管理**。Git 不能存储明文 Secret，但 GitOps 要求所有配置（包括 Secret）在 Git 中管理。解决方案是使用 Sealed Secrets（Bitnami）或 External Secrets Operator 配合 Vault——Git 中只存储加密后的 Secret 或指向 Vault 的引用，实际的密钥数据在运行时解密。我们最终选择了 External Secrets Operator + AWS Secrets Manager 的方案，因为 ESO 支持自动轮换和多种后端。

挑战二：**多环境配置差异**。我们的三个环境（dev、staging、prod）的 K8s manifests 90% 相同，但差异部分（镜像版本、副本数、资源限制、环境变量）很难管理。早期的方案是三个文件夹各存一份——但经常出现"staging 改了 ConfigMap 但 prod 忘记改"的问题。后来引入 Kustomize 解决了这个问题——base 目录存公共配置，overlays 目录存环境差异：

```
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/
    │   ├── kustomization.yaml    # 镜像版本 + 2 副本
    │   └── configmap-patch.yaml
    └── production/
        ├── kustomization.yaml    # 不同镜像版本 + 10 副本
        └── configmap-patch.yaml
```

挑战三：**变更审批流程**。GitOps 和 PR 审批是天生一对，但 PR 审批本身也是一个瓶颈。我们规定：staging 环境的配置变更只需要 1 个 Approve，production 环境的变更需要 2 个 Approve，并且必须来自不同团队。

**追问**:
- Q: GitOps 如何管理基础设施级别的配置（集群节点、网络策略、存储卷）？ArgoCD 和 Terraform 的边界在哪里？
- Q: 如果 Git 仓库不可达（比如 GitHub 宕机），ArgoCD 还能正常工作吗？离线运行模式下 Drift Detection 怎么处理？
- Q: 多集群 GitOps 架构（Hub/Spoke）你们是怎么做的？ArgoCD ApplicationSet 解决了什么问题？

---

## Q6: 数据库 Migration 在部署流程中怎么处理？你们在 CI/CD 中是怎么集成数据库变更的？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、蚂蚁集团

**答案要点**:
- 数据库 Migration 是"有状态变更"，不能像无状态应用一样做蓝绿/金丝雀
- 核心原则：Migration 必须向前兼容、可回滚、幂等
- 常见的集成方式：PreSync Hook（ArgoCD）、Deployment Init Container、独立 Migration Job
- "Expand-Migrate-Contract" 模式是业界推荐的方法论

**完整回答**:

数据库 Migration 是部署流程中最棘手的问题，也是面试官区分"真 DevOps"和"假 DevOps"的关键话题。

**核心挑战**：

无状态应用的部署可以做到"全部替换"——新版本部署，旧版本下线。但数据库只有一个，schema 和数据的变更不是"切换"而是"演化"。如果新版本的代码需要新的表结构，但旧版本（等待回滚时）不兼容新结构，就出现了"朝前无法回退"的死锁。

**我们的方案：Expand-Migrate-Contract 模式（Phase-Based Migration）**。

这个模式分三个阶段，每个阶段对应一次独立的部署：

**Phase 1: Expand（扩展阶段）**。

这次部署只做一件事情：在数据库中添加新字段/新表，但不修改旧逻辑。比如我们要修改 `orders` 表，将 `status` 字段从 VARCHAR 改为 ENUM：

```sql
-- Phase 1: 新增字段，保留旧字段
ALTER TABLE orders 
    ADD COLUMN status_new ENUM('pending', 'paid', 'shipped', 'cancelled') 
    AFTER status;

-- 创建触发器同步新旧字段（可选，取决于业务需求）
-- 或者让应用代码同时写入两个字段
```

代码层面：应用同时写入 `status` 和 `status_new`，但读取时仍然从 `status` 读取。这个阶段的应用代码不需要知道 `status_new` 的存在。

**Phase 2: Migrate（迁移阶段）**。

这个阶段做两件事：将存量数据从旧字段迁移到新字段，然后将应用的读取逻辑切换到新字段：

```sql
-- Phase 2a: 批量迁移存量数据
UPDATE orders 
SET status_new = 
    CASE status
        WHEN 'pending' THEN 'pending'
        WHEN 'paid' THEN 'paid'
        WHEN 'shipped' THEN 'shipped'
        WHEN 'cancelled' THEN 'cancelled'
        WHEN 'refunded' THEN 'cancelled'   -- 旧值映射到新枚举
    END
WHERE status_new IS NULL;
```

代码层面：这次部署的应用代码，读取 `status_new`，写入写两个字段。如果回滚，旧版本仍然从 `status` 读取（数据仍然在写两个字段，兼容）。

```sql
-- Phase 2b: 添加 NOT NULL 约束（在确认没有 NULL 数据后）
ALTER TABLE orders MODIFY status_new VARCHAR(20) NOT NULL;
```

**Phase 3: Contract（收缩阶段）**。

确认新字段稳定运行一段时间后，删除旧字段：

```sql
-- Phase 3: 删除旧字段
ALTER TABLE orders DROP COLUMN status;
```

**CI/CD 中的集成方式**：

我们使用 ArgoCD 的 PreSync Hook 来执行 Migration：

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration-${CI_COMMIT_SHORT_SHA}
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
      - name: migration
        image: registry.example.com/migration:1.2.3
        env:
        - name: DB_DSN
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: dsn
        - name: MIGRATION_PHASE
          value: "2"     # 执行 Phase 2 Migration
      restartPolicy: Never
  backoffLimit: 2
```

**几个铁律**：

第一，Migration 必须幂等。同一个脚本跑一次和跑两次结果一致。`ALTER TABLE ADD COLUMN IF NOT EXISTS` 比 `ALTER TABLE ADD COLUMN` 安全。

第二，Migration 必须和旧版代码兼容。这是最重要的一条——如果你部署了新版本（含 Migration），然后立即回滚到旧版本，旧版本的代码必须能正常读写数据库。

第三，大表 DDL 操作不能锁表。MySQL 5.6+ 的 `ALTER TABLE` 默认会锁全表，对大表（百万行以上）是灾难。我们使用 `pt-online-schema-change`（Percona Toolkit）或 GitHub 的 `gh-ost` 来做在线 DDL：

```bash
# gh-ost 在线 DDL，不锁表
gh-ost \
  --host=mysql-host \
  --database=myapp \
  --table=orders \
  --alter="ADD COLUMN status_new VARCHAR(20) AFTER status" \
  --execute
```

**回滚场景**：

如果 Phase 2 部署有问题需要回滚：应用代码回滚到 Phase 1 版本（读取旧字段），不需要回滚数据库（Migration 脚本不会自动回退 schema 变更）。需要手动执行 reverse migration（如果有的话）。这也是 Expand-Migrate-Contract 模式的优点——每个阶段都可以单独回滚，不需要"整体回滚"。

**追问**:
- Q: 如果一次 Migration 执行到一半（比如改了 50% 的数据）失败了，如何处理？你的 Migration 框架支持事务性吗？
- Q: 多数据库环境（读写分离 + 分库分表）下的 Migration 怎么执行？主从延迟会导致什么问题？
- Q: 你们怎么验证 Migration 脚本的正确性？CI 中是如何模拟生产数据量级来测试 Migration 性能的？

---

## Q7: 生产环境部署失败后，你们的 Rollback 策略是怎样的？什么情况下回滚，什么情况下"向前修复"？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、美团、快手

**答案要点**:
- 回滚 vs 向前修复（Forward Fix）的决策取决于故障的严重程度、修复成本和修复时间
- 回滚是最快的止损方式，但不是所有场景都适用
- 数据库 Migration 后的回滚需要特殊处理
- 回滚能力需要在架构设计时就考虑，而不是故障后才去想

**完整回答**:

这是面试官最喜欢深挖的一个话题——纸上谈兵的回滚流程每个人都能说，但真正在凌晨两点被报警叫醒做决策时完全是另一回事。

**回滚 vs 向前修复的决策框架**：

我们在故障 On-Call 手册中定义了一个决策矩阵：

| 场景 | 推荐策略 | 理由 |
|------|----------|------|
| 新功能有 Bug，影响核心流程 | 立即回滚 | 回滚 2 分钟，修 Bug 可能要 2 小时 |
| 性能退化，但功能正常 | 向前修复 | 缓慢回滚可能引发数据不一致，向前发布修复更安全 |
| 数据库 Migration 后出问题 | 向前修复 / Phase Rollback | Expand 阶段可直接回滚，Migrate 阶段需要 reverse migration |
| 配置变更导致的故障 | 立即回滚配置 | 配置变更是最便宜的回滚对象 |
| 安全漏洞（如 Log4j） | 向前修复 | 回滚到有漏洞版本没有意义 |

需要强调的是：**回滚是你的逃生通道，但不能是唯一的逃生通道**。

**技术实现**：

镜像级别的回滚最简单——修改 K8s Deployment 的镜像版本到上一个版本：

```bash
# ArgoCD 回滚到上一个版本
argocd app rollback myapp-production --prune
```

ArgoCD 内部维护了一个版本列表（默认 10 个），每次 Sync 生成一个新版本。回滚时，ArgoCD 将集群状态恢复到选中版本对应的 Git 提交状态。

如果使用 GitOps，回滚就是"重新提交一个 PR 把镜像版本改回去"。流程上：

1. 运维确认故障后，在 GitOps 仓库创建一个 Hotfix 分支
2. 将生产环境的镜像版本改回上一个稳定版本
3. 提交 PR，紧急审批（1 个 Approve 即可）
4. 合并到 main 分支
5. ArgoCD 检测到变更，自动 Sync，集群回滚到旧版本

整个流程约 5-8 分钟。但如果问题是数据库 Migration 导致的复杂回滚，这个时间会被显著拉长。

**数据库回滚的特殊性**：

没有"一键回滚数据库"这种操作。如果你在 Phase 2 加了新字段并迁移了数据，回滚操作需要：

1. 部署旧版本应用代码（从旧字段读取，继续写入两个字段）
2. 保留新字段（不要 DROP——旧代码不会读它）
3. 如果新字段导致了数据问题，需要执行自定义 Reverse Migration 脚本

所以我们在设计 Migration 时要求：每一批 Migration 必须带有对应的 Rollback Migration 脚本：

```
migrations/
├── v1.0.0/
│   ├── up.sql          # 正向 Migration
│   └── down.sql        # 反向 Migration
├── v1.1.0/
│   ├── up.sql
│   └── down.sql
```

**快速回滚的基石**：

回滚的速度取决于你有多好的"可回滚性"架构。以下几点是我们在每个服务上线前必检的项目：

- 服务是否支持蓝绿或金丝雀部署（决定了回滚粒度和速度）
- 是否使用 Feature Flags（支持代码级的快速回滚——关开关就行）
- 数据库 Migration 是否有对应的反向脚本
- 是否有充分的监控指标来判定"回滚成功的标准"（错误率恢复到基线、P99 延迟恢复正常）
- 是否有回滚后的自动化 Smoke Test

**追问**:
- Q: 你们回滚后，CI/CD 流水线中有没有"自动阻止相同问题再次上线"的机制？如何做到的？
- Q: 如果回滚本身也失败了（旧版本有新问题），你们有没有"回滚回滚"的预案？
- Q: K8s 的 `kubectl rollout undo` 和 ArgoCD 的回滚在实现上有什么不同？各自在什么场景下适用？

---

## Q8: 你们的多环境 Promotion 策略是怎样的？代码从 Dev 到 Staging 到 Production 的"晋阶"流程怎么设计的？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- 多环境 Promotion 的核心是"同一个二进制，不同配置"——构建一次，部署多次
- 环境差异通过配置管理（ConfigMap、Kustomize overlay、Helm values）处理
- 每个环境的 Promotion 需要不同的质量门禁和审批策略
- Promotion 策略决定了发布速度和风险控制能力的平衡

**完整回答**:

多环境 Promotion 设计得好不好，直接决定了团队发布效率。我们经历了几次迭代才形成现在的流程。

**核心原则：Build Once, Deploy Anywhere**。

这是十二因素应用（12-Factor App）的原则之一。CI 流水线构建的镜像只构建一次，通过不可变的镜像标签在环境间传递。环境差异（数据库连接串、API key、日志级别）通过 K8s ConfigMap 和 Secret 管理，不通过不同的 Docker 镜像。

镜像标签策略：

```
# 我们使用内容可寻址的标签
registry.example.com/myapp:sha-<git_commit_sha>
# 同时打上语义版本标签
registry.example.com/myapp:1.2.3
# 环境标签（移动的）
registry.example.com/myapp:staging
registry.example.com/myapp:production
```

关键点：`sha-<commit>` 是唯一不变的标识符，`staging` 和 `production` 是可变的指针——指向当前环境正在运行的版本。

**Promotion 流程设计**：

```
                      ┌──────────────┐
                      │   Dev/PR     │ (自动部署，自动测试)
                      └──────┬───────┘
                             │ PR merged
                      ┌──────▼───────┐
                      │   Staging    │ (自动部署，E2E 测试 + 集成测试)
                      └──────┬───────┘
                             │ 手动审批
                      ┌──────▼───────┐
                      │   Canary     │ (金丝雀发布，自动分析)
                      └──────┬───────┘
                             │ 自动批准
                      ┌──────▼───────┐
                      │  Production  │ (全量发布，监控验证)
                      └──────────────┘
```

**自动化 Promotion 的代码实现**：

我们使用 Go 编写了一个内部的 Promotion Operator，它的核心逻辑是：

1. CI 构建完成后，自动更新 argocd 配置仓库中 staging 的镜像标签，触发 Staging 部署
2. Staging 部署完成后，运行 E2E 测试 + 集成测试 + 安全扫描
3. 如果所有测试通过，自动创建一个 GitHub Issue/PR，请求批准 Promotion 到 Canary
4. 指定审批人收到通知，在 PR 上 Approve 后，自动更新 Canary 环境的镜像标签
5. Canary 发布通过 Argo Rollouts 的金丝雀分析后，自动 Promotion 到 Production
6. Production 发布后运行 Smoke Test，确认核心功能正常

**环境差异管理的演进**：

第一代：每个环境一套完整的 K8s manifests，手动维护——"环境漂移"问题严重。

第二代：使用 Helm Chart + values 文件区分环境——比第一代好，但 values 文件数量膨胀后维护困难。

第三代：Kustomize + Kustomize overlay（目前的方案）。base 目录定义通用的 Deployment、Service、Ingress 模板，overlays 目录按环境覆盖差异：

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
patches:
- path: replica-patch.yaml     # 生产环境 10 副本
- path: resources-patch.yaml   # 生产环境资源限制更高
- path: hpa-patch.yaml         # 生产环境启用 HPA
images:
- name: registry.example.com/myapp
  newTag: sha-a1b2c3d4         # Promotion 时只改这一行
configMapGenerator:
- name: app-config
  behavior: merge
  literals:
  - LOG_LEVEL=INFO
  - DB_POOL_SIZE=50
```

**质量门禁的定义**：

每个环境升级到下一个环境时必须通过的门禁：

| 门禁 | Dev → Staging | Staging → Canary | Canary → Production |
|------|:---:|:---:|:---:|
| 单元测试通过 | ✓ | ✓ | ✓ |
| 集成测试通过 | ✓ | ✓ | ✓ |
| 代码覆盖率报告 | ✓ | ✓ | ✓ |
| 安全扫描通过 | ✓ | ✓ | ✓ |
| E2E 测试通过 | | ✓ | ✓ |
| 性能测试达标 | | ✓ | ✓ |
| 人工审批 | | | ✓ (可选) |
| 金丝雀分析通过 | | | ✓ |

**关键经验**：

Promotion 不能完全自动化。我们在 Staging → Canary 之间保留了手工审批——因为 Staging 环境验证通过的版本，不代表在生产流量下也没问题。审批人是本周的 On-Call SRE + 该服务的 Tech Lead。

另一个经验是"不可变 Promotion"——一个版本一旦晋升到生产环境，就不再允许"在同一镜像上修修补补"。如果生产版本发现 Bug，必须从 CI 重新构建并重新走一遍 Promotion 流程。这虽然慢一点，但保证了「生产运行的代码就是 CI 构建 + 测试验证过的代码」。

**追问**:
- Q: 如果 Staging 和 Production 的配置差异很大（比如 Staging 是单节点、Production 是集群），Promotion 后的验证还能覆盖所有问题吗？如何减少环境漂移？
- Q: 你们的 Promotion 流程中，如果 Canary 阶段发现异常自动回滚了，Staging 环境的版本如何处理？会不会出现"Staging 的版本比 Production 还新"的情况？
- Q: 面向多 Region 部署时的 Promotion 策略怎么做？灰度 Region 和全量 Region 的发布节奏如何控制？

---

## 本题难度等级说明

| 难度 | 图标 | 对应层级 |
|------|------|----------|
| ⚫⚪⚪ 初级 | 初级 | 1-3 年经验 |
| ⚫⚫⚪ 中级 | 中级 | 3-5 年经验 |
| ⚫⚫⚫ 高级 | 高级 | 5 年+ 经验 |
