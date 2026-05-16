---
id: interview-ops
title: Kubernetes 运维面试题
description: 集群运维、PDB、资源配额、自动扩缩容、优先级、污点容忍、备份恢复、集群升级等高级运维面试题
---

# Kubernetes 运维面试题

## Q1: PodDisruptionBudget（PDB）的工作原理是什么？在生产环境中如何配置 PDB 来保证应用的高可用性？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、腾讯、阿里

**答案要点**:
- PDB 定义了一个应用在自愿中断（voluntary disruption）期间最多可以有多少 Pod 不可用
- 自愿中断包括节点维护（drain）、集群升级、节点池缩容、Pod 优先级抢占等
- 非自愿中断（节点硬件故障、内核崩溃等）不受 PDB 限制
- PDB 通过 minAvailable 或 maxUnavailable 两种方式指定容忍度
- eviction API 强制检查 PDB，而直接删除 Pod（delete pod）可以绕过 PDB 检查

**完整回答**:

**PDB 的作用范围**：

PDB（PodDisruptionBudget）只约束自愿中断（Voluntary Disruptions），不约束非自愿中断（Involuntary Disruptions）。这个区分非常重要——很多面试者混淆了 PDB 和 Node/ Pod 的高可用机制。

自愿中断的例子：
- 运维人员执行 `kubectl drain node1` 进行节点维护
- 集群自动缩放器（Cluster Autoscaler）缩容节点
- 节点池升级或降级
- Pod 优先级抢占（Priority Preemption）

非自愿中断的例子：
- 物理服务器宕机
- 内核崩溃导致节点 NotReady
- 磁盘损坏导致数据丢失
- 网络分区

PDB **不能**防止非自愿中断。对于非自愿中断的保护能力来自于：跨节点部署（podAntiAffinity）、跨可用区部署、多个副本数。

**PDB 配置**：

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
spec:
  minAvailable: 2        # 最少保持 2 个可用 Pod
  # 或使用百分比
  # minAvailable: "50%"
  # 或指定最大不可用数目
  # maxUnavailable: 1
  selector:
    matchLabels:
      app: myapp
```

`minAvailable` 和 `maxUnavailable` 是互斥的。选择哪个取决于业务偏好——如果更关注可用性底线，用 minAvailable；如果更关注灵活性和资源利用率，用 maxUnavailable。

**PDB 与 eviction API**：

当运维人员执行 `kubectl drain` 时，kubelet 通过 eviction API 逐出 Pod。eviction API 会检查 PDB：

```
eviction API 请求 → API Server 检查 PDB → 如果违反 PDB 则拒绝
```

如果 drain 操作触发 eviction 被 PDB 拒绝，drain 命令会卡住等待。可以通过 `--force` 选项强制跳过 PDB 检查，但这相当于主动选择可能违反 SLO。

直接使用 `kubectl delete pod` 可以绕过 PDB 检查——这是绕过 PDB 的最常见方式，也是 PDB 保护的一个薄弱点。权限控制层面应当限制直接删除 Pod 的权限。

**生产环境中的 PDB 配置经验**：

**多副本无状态应用**（replicas=3）：
```yaml
spec:
  maxUnavailable: 1
```
同时保持 maxSurge=1（Deployment 滚动更新策略），允许滚动更新过程中同时有 4 个 Pod 运行，但不允许同时少于 2 个 Pod 可用。

**有状态应用**（如数据库集群 replicas=3）：
```yaml
spec:
  minAvailable: 2
```
有状态应用通常不能有多余副本（因为数据同步限制），所以 minAvailable 更安全。

**关键基础设施组件**（如 CoreDNS、ingress-nginx）：
对于这些组件需要特别小心。如果 CoreDNS 的 PDB 太严格（如 minAvailable: 2），可能导致节点维护时无法逐出任何一个 CoreDNS Pod，节点 drain 卡住。常见做法是为集群关键组件设置相对宽松的 PDB，或者配合 PriorityClass 让关键组件在资源短缺时优先保留。

**PDB 不生效的排查路径**：

```bash
# 1. 检查 PDB 状态
kubectl get pdb myapp-pdb
# 输出示例：
# NAME         MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
# myapp-pdb    2               N/A               1                     10d

# 2. 检查 PDB 的 selector 是否匹配到 Pod
kubectl get pods -l app=myapp

# 3. 检查 Pod 是否有 controller（PDB 仅对具有 controller 的 Pod 完全生效）
kubectl get pods myapp-xxx -o jsonpath='{.metadata.ownerReferences}'

# 4. 检查 drain 时的卡住原因
kubectl describe node node1 | grep -A 10 "Taints"
```

**追问**:
- Q: 如果一个 StatefulSet 有 5 个副本，minAvailable=3，此时执行节点 drain，最多能同时逐出几个 Pod？
- Q: `kubectl drain` 命令的 `--disable-eviction` 选项和 `--force` 选项分别绕过什么检查？
- Q: Cluster Autoscaler 在缩容节点时如何与 PDB 交互？如果 PDB 阻止了 Pod 迁移，节点还能被缩容吗？

---

## Q2: ResourceQuota 和 LimitRange 在 Kubernetes 中的职责分别是什么？它们之间如何协同工作？在生产环境中如何设计多租户资源隔离？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、华为、字节跳动

**答案要点**:
- ResourceQuota 为 Namespace 级别的资源总量设置硬上限
- LimitRange 为 Namespace 内单个 Pod/Contianer 设置默认 requests/limits 和范围约束
- ResourceQuota 和 LimitRange 通过 Admission Controller（ResourceQuota + LimitRanger）强制执行
- 多租户隔离的最佳实践：每个租户一个 Namespace，结合 RBAC + ResourceQuota + NetworkPolicy
- ResourceQuota 可以限制计算资源（CPU/内存）和对象数量（Pod/Service/ConfigMap 等）

**完整回答**:

**ResourceQuota 的职责**：

ResourceQuota 控制整个 Namespace 的资源消耗上限。它是一个保护机制，防止单个 Namespace 或应用团队消耗过多集群资源，影响其他团队。

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
  namespace: team-a
spec:
  hard:
    # 计算资源
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"
    # 存储资源
    requests.storage: "100Gi"
    persistentvolumeclaims: "10"
    # 对象数量限制
    pods: "50"
    services: "10"
    configmaps: "20"
    secrets: "20"
    replicationcontrollers: "20"
    count/deployments.apps: "10"
    count/statefulsets.apps: "5"
    count/jobs.batch: "20"
    count/cronjobs.batch: "5"
```

当 ResourceQuota 创建后，Namespace 内的所有 Pod 创建请求都会被 ResourceQuota Admission Controller 拦截检查。如果 Namespace 的当前资源总和加上新 Pod 的 requests/limits 超过了配额，请求会被拒绝。

这里有一个需要特别注意的陷阱：在开启了 ResourceQuota 的 Namespace 中创建 Pod 时，如果 Pod 没有设置 requests/limits，API Server 会拒绝创建。因为 ResourceQuota 需要知道每个 Pod 的资源消耗才能做配额核算。

**LimitRange 的职责**：

LimitRange 解决了 ResourceQuota 带来的上述问题——它为 Namespace 中未显式设置资源请求和限制的 Pod 或 Container 注入默认值。

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: team-a-limits
  namespace: team-a
spec:
  limits:
  - type: Container
    default:                    # 默认 limits
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:             # 默认 requests
      cpu: "200m"
      memory: "256Mi"
    max:                        # 单个 Container 的上限
      cpu: "4"
      memory: "8Gi"
    min:                        # 单个 Container 的下限
      cpu: "50m"
      memory: "64Mi"
  - type: Pod
    max:
      cpu: "8"
      memory: "16Gi"
  - type: PersistentVolumeClaim
    min:
      storage: "1Gi"
    max:
      storage: "50Gi"
```

LimitRange 支持三种 scope type：
- **Container**：应用到单个 Container 的 resource requirements
- **Pod**：应用到 Pod 中所有 Container 的资源总和
- **PersistentVolumeClaim**：应用到 PVC 的存储请求

LimitRange 的 min 和 max 是硬约束，超过范围的请求会被拒绝。default 和 defaultRequest 只在 Container 未显式设置时生效。

**ResourceQuota + LimitRange 的协同工作流**：

```
用户提交 Pod YAML（未设置 requests/limits）
    │
    ▼
LimitRanger Admission Controller 拦截
    ├── 注入 Container 的 default request（200m CPU, 256Mi 内存）
    ├── 注入 Container 的 default limit（500m CPU, 512Mi 内存）
    └── 检查 Pod 的总体是否在 min/max 范围内
    │
    ▼
ResourceQuota Admission Controller 拦截
    ├── 计算 Namespace 已使用的资源总和
    ├── 加上新 Pod 的资源请求
    └── 检查是否超过配额上限
    │
    ▼
API Server 持久化到 etcd 或返回错误
```

**多租户隔离的生产设计**：

推荐使用租户即 Namespace 的隔离模型，每个租户一个 Namespace。核心组件如下：

1. **计算资源隔离**：ResourceQuota 设置 CPU/内存上限
2. **存储隔离**：ResourceQuota 限制 PVC 数量和总容量
3. **网络隔离**：NetworkPolicy 限制 Pod 之间的通信，默认 deny-all
4. **权限隔离**：RBAC Role + RoleBinding 限制每个租户只能操作自己的 Namespace
5. **运行时隔离**：Pod Security Standards（Restricted profile）限制特权操作

对于更严格的多租户（如 SaaS 平台的不同客户），Namespace 级别的隔离不足够，因为不同 Namespace 的 Pod 仍然共享同一个节点。这种情况需要：
- 使用节点池隔离：高优先级租户使用独占节点池（通过 taint + toleration + nodeSelector）
- 使用安全管理器：如 Kyverno 或 OPA Gatekeeper 强制执行跨 Namespace 的安全策略
- 考虑虚拟集群方案：如 vCluster，每个租户有自己的控制平面

**追问**:
- Q: ResourceQuota 的 scopeSelector 如何实现对特定 QoS 等级 Pod 的配额控制？
- Q: 如果一个 Namespace 配置了 ResourceQuota 但未配置 LimitRange，用户创建的 Pod 没有设置 resources 字段，会发生什么？
- Q: 跨多个 Namespace 的全球资源配额（如整个集群的配额）如何实现？有没有类似 ResourceQuota 的集群级别机制？

---

## Q3: 请详细比较 Cluster Autoscaler、Horizontal Pod Autoscaler（HPA）和 Vertical Pod Autoscaler（VPA）的工作原理、适用场景和协同方式。

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、字节跳动、腾讯云

**答案要点**:
- Cluster Autoscaler 在节点资源不足时扩容节点，在节点利用率低时缩容节点
- HPA 基于 CPU/内存或自定义指标调整 Pod 副本数量
- VPA 根据历史指标自动调整 Pod 的 requests/limits 值
- 三者协同时推荐：HPA 处理水平扩缩、VPA 辅助优化资源配置、Cluster Autoscaler 兜底节点容量
- HPA 和 VPA 不能同时作用于同一个 Deployment 的同一个指标维度

**完整回答**:

**Cluster Autoscaler（CA）**：

Cluster Autoscaler 工作在基础设施层，它与云厂商的 API 对接，当集群中的 Pod 因为节点资源不足而处于 Pending 状态时，CA 触发节点扩容。

CA 的扩容触发条件：
```
有 Pod 处于 Pending 状态 +
Pending 的原因是资源不足（CPU/内存不足、端口冲突等）+
该 Pod 可以被调度到新节点上（排除亲和性限制导致的 Pending）
```

CA 的缩容判断条件更加保守——CA 不会缩容正在运行关键工作负载的节点。默认情况下，一个节点满足以下所有条件时被缩容：
- 所有 Pod 的 CPU 和内存请求总和低于节点容量的 50%（可配置 `--scale-down-utilization-threshold`）
- 节点上的所有 Pod 都可以被调度到其他节点（PDB、亲和性等约束允许）
- 节点上没有 kube-system 的严格不可迁移 Pod

生产环境配置建议：
- `--max-nodes-total` 设置集群节点上限，防止成本失控
- `--scale-down-delay-after-add` 避免节点刚加入就被缩容，建议 10-15 分钟
- `--scale-down-unneeded-time` 节点低负载多久后被标记为可缩容，建议 10-15 分钟
- 使用 `cluster-autoscaler.kubernetes.io/safe-to-evict: "true"` annotation 标记允许被驱逐的 Pod

**Horizontal Pod Autoscaler（HPA）**：

HPA 是应用层的水平扩缩容机制。它周期性地（默认 15 秒）采集 Pod 的指标数据，根据目标值和当前值的比值计算需要的副本数。

```
期望副本数 = ceil(当前副本数 × (当前指标值 / 目标指标值))
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: requests_per_second
      target:
        type: AverageValue
        averageValue: 1000
  behavior:                    # 1.18+ 引入的扩缩容行为控制
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Pods
        value: 4              # 每 15 秒最多新增 4 个 Pod
        periodSeconds: 15
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300  # 缩容冷却窗口 5 分钟
      policies:
      - type: Percent
        value: 10             # 每 5 分钟最多缩容 10%
        periodSeconds: 60
```

HPA 的核心配置参数：
- **metrics**：支持 Resource（CPU/内存）、Pods（Pod 级别自定义指标）、Object（如 Ingress QPS）、External（如 SQS 队列长度）
- **behavior**：Kubernetes 1.18+ 引入，独立控制扩容和缩容的行为策略
- **stabilizationWindowSeconds**：稳定窗口，防止指标抖动导致频繁扩缩容

**Vertical Pod Autoscaler（VPA）**：

VPA 解决的是资源规格的优化问题——很多团队为 Pod 设置 requests/limits 时要么过高（浪费资源）要么过低（导致 OOMKilled 或 CPU 限流）。VPA 通过监控 Pod 的实际资源使用情况，动态调整 requests/limits 值。

VPA 有三种更新模式：
- **Off**：仅做推荐，不自动更新
- **Initial**：只在 Pod 创建时设置推荐值，不更新已有 Pod
- **Auto**：自动更新正在运行的 Pod（通过 eviction 重新创建）

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: Auto
  resourcePolicy:
    containerPolicies:
    - containerName: "*"
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "4"
        memory: "8Gi"
```

**三重缩放机制的协同**：

```
用户请求增加 → Pod CPU 使用率上升
    │
    ▼
HPA 检测到 CPU > 70%，扩容 Pod 副本
    │
    ▼
新 Pod 调度到节点上 → 节点资源不足
    │
    ▼
Cluster Autoscaler 检测到 Pending Pod → 扩容节点
    │
    ▼
节点加入集群 → Pending Pod 被调度 → 请求恢复
```

同时，VPA 在后台持续观察 Pod 的实际资源使用模式，经过一个学习周期（通常 8 天以上）后，给出资源推荐值。如果 minAllowed 和 maxAllowed 配置得当，可以逐步优化 Pod 的 requests/limits，提高节点利用率。

**重要约束**：HPA 和 VPA 不能同时基于 CPU/内存指标作用于同一个 Deployment。因为两者都在调整 CPU/内存维度（HPA 调整 Pod 数量，VPA 调整单个 Pod 的资源规格），会导致冲突。如果确实需要同时使用，必须确保 HPA 只基于自定义指标（如 QPS），或者 VPA 只基于 memory 而 HPA 只基于 CPU。

**追问**:
- Q: Cluster Autoscaler 缩容时，节点上的 Pod 是否有优雅终止期？如果 PDB 阻止了 Pod 迁移会发生什么？
- Q: HPA 的 `behavior` 配置中 `scaleUp.stabilizationWindowSeconds` 和 `scaleDown.stabilizationWindowSeconds` 分别如何影响扩缩容决策？
- Q: VPA Recommender 基于什么算法计算推荐值？Percentile 的选择（P50 vs P90 vs P99）对资源配置有什么影响？

---

## Q4: Pod 优先级和抢占（Priority and Preemption）机制是如何工作的？在生产环境中如何设计优先级体系来保证关键业务的稳定性？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- PriorityClass 定义 Pod 的优先级，优先级高的 Pod 在调度队列中优先被调度
- 抢占（Preemption）发生在高优先级 Pod 无法调度时，调度器驱逐低优先级 Pod 腾出空间
- 被抢占的 Pod 会收到一个优雅终止期（默认 30 秒）后强制终止
- 系统组件（kube-system）通常使用最高优先级，保证集群核心功能不受影响
- 优先级设计的原则是层次不宜过多（建议 4-5 级），且不要混用

**完整回答**:

**优先级体系**：

Pod 的优先级通过 PriorityClass 资源定义：

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: critical
value: 1000000            # 值越大优先级越高
globalDefault: false      # 是否作为集群默认优先级
description: "关键业务 Pod，如 API Gateway"
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high
value: 100000
globalDefault: false
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: medium
value: 10000
globalDefault: true       # 未指定优先级的 Pod 默认使用这个
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: low
value: 1000
description: "批处理作业、非关键任务"
```

**抢占（Preemption）的执行流程**：

1. 高优先级 Pod P 需要调度，但所有节点资源不足
2. 调度器进入 PostFilter 扩展点，调用 DefaultPreemption 插件
3. 调度器尝试寻找一个节点，在该节点上驱逐一个或多个低优先级 Pod 后可以容纳 P
4. 找到目标节点后，调度器在 API Server 中删除被抢占的 Pod（优雅终止）
5. 被抢占的 Pod 对应的控制器（如 Deployment、ReplicaSet）检测到 Pod 被删除，创建替代 Pod
6. 替代 Pod 不继承原来的优先级，而是使用自身配置的优先级
7. 调度器选择优先级最高的 Pod 进行调度
8. 如果替代 Pod 的优先级较低，其调度顺序在新 Pod P 之后

**Preemption 的默认配置的局限性**：

默认的抢占调度器的行为是"驱逐节点上所有优先级低于 P 的 Pod 直到满足 P 的资源需求"。如果一个节点上有一个优先级 1000 的 Pod 占用了 1GB 内存，而 P 需要 512MB 内存，调度器会先尝试驱逐这个 Pod，而不会考虑是否有其他优先级更低的 Pod 可以先被驱逐。

通过 KubeSchedulerConfiguration 可以调整抢占行为：

```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- pluginConfig:
  - name: DefaultPreemption
    args:
      minCandidateNodesAbsolute: 100
      minCandidateNodesPercentage: 10
```

**优先级设计实践**：

生产环境建议将优先级分为 4-5 层：

| 等级 | PriorityClass | Value | 适用组件 |
|------|--------------|-------|----------|
| 系统关键 | system-cluster-critical | 2000000000 | CoreDNS、kube-dns |
| 系统重要 | system-node-critical | 2000001000 | kubelet 预留 |
| 关键业务 | critical | 1000000 | API Gateway、Auth Service |
| 普通业务 | high | 100000 | 业务核心服务 |
| 默认 | default/medium | 10000 | 常规微服务 |
| 批处理 | low/batch | 1000 | 定时任务、CI/CD |

两个系统保留的 PriorityClass：`system-cluster-critical`（Value=2000000000）和 `system-node-critical`（Value=2000001000）。这两个是 Kubernetes 内置的，集群关键组件（如 CoreDNS）应该使用它们。

**抢占的副作用和注意事项**：

抢占是有代价的——被抢占的 Pod 可能会造成请求失败、连接中断。如果多个高优先级 Pod 同时抢占资源，可能导致低优先级 Pod 被反复创建和驱逐，这种现象称为 Pod 颠簸（Pod Thrashing）。

为了防止 Pod 颠簸，建议：
- 不要设置太多优先级层次（层级过多会导致更频繁的抢占）
- 设置 PDB 减少逐出时的影响面
- 对批处理作业使用 PriorityClass 降低优先级，防止关键业务被批处理任务影响
- 配合 Cluster Autoscaler 使用，让 CA 在抢占发生前先扩容节点，减少抢占的必要性

**追问**:
- Q: 如果 PriorityClass 不存在或被删除，已经在运行的 Pod 会怎么样？新创建的引用了不存在的 PriorityClass 的 Pod 会
   如何处理？
- Q: 抢占发生时，调度器如何选择被驱逐的 Pod？选择策略有哪些？
- Q: Pod 的 Priority 值是否影响 kubelet 的节点级资源回收顺序（如 OOM Killer 的选择）？

---

## Q5: Taints 和 Tolerations 在实战中如何设计？从节点隔离的角度出发，如何通过 Taint 实现专用节点池（如 GPU 节点、高 IO 节点、敏感数据节点）？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- Taint 使节点排斥一组 Pod，只有拥有对应 Toleration 的 Pod 才能被调度到该节点
- 三种 Taint Effect：NoSchedule（不调度新 Pod）、PreferNoSchedule（尽量不调度）、NoExecute（驱逐已有不匹配的 Pod）
- 专用节点池通过组合 Taint + Toleration + NodeSelector 实现
- Taint 和 Toleration 的匹配通过 key、value 和 effect 三者组合判定
- NoExecute 的 tolerationSeconds 可以控制 Pod 在被驱逐前的宽限时间

**完整回答**:

Taint 和 Toleration 是 Kubernetes 中"谁可以运行在哪些节点上"的精细控制机制。它与 Node Affinity 不同——Node Affinity 是 Pod 主动选择节点（吸引力），Taint 是节点主动排斥 Pod（排斥力）。两者互补使用。

**Taint 的三种 Effect**：

- **NoSchedule**：不匹配 Toleration 的 Pod 不会被调度到这个节点，节点上已有 Pod 不受影响。这是最常用的 Effect，适用于常规的专用节点池。
- **PreferNoSchedule**：调度器尽量不将 Pod 调度到这个节点，但不强制。当其他节点资源不足时，调度器可能突破这个限制。适用于"软性"的节点隔离需求。
- **NoExecute**：效果最强。不匹配 Toleration 的 Pod 既不会被调度到这个节点，已有的 Pod 也会被驱逐。如果 Toleration 指定了 `tolerationSeconds`，Pod 可以在宽限期内继续运行，到期后被驱逐。适用于隔离敏感数据节点或进行节点紧急维护。

**专用节点池的设计模式**：

以 GPU 节点池为例，实现"只有需要 GPU 的 Pod 才能调度到 GPU 节点"：

```bash
# 1. 为 GPU 节点打标签并添加污点
kubectl label nodes gpu-node-1 accelerator=nvidia
kubectl taint nodes gpu-node-1 nvidia.com/gpu=present:NoSchedule
```

```yaml
# 2. GPU 训练 Pod 配置 Toleration + NodeSelector
apiVersion: v1
kind: Pod
metadata:
  name: gpu-training-job
spec:
  nodeSelector:
    accelerator: nvidia
  tolerations:
  - key: nvidia.com/gpu
    operator: Equal
    value: "present"
    effect: NoSchedule
  containers:
  - name: training
    image: tensorflow:2.9-gpu
    resources:
      limits:
        nvidia.com/gpu: 2
```

这样非 GPU Pod 永远不会调度到 GPU 节点，而需要 GPU 的 Pod 因为配置了 Toleration 可以正常调度到 GPU 节点。

类似的设计模式适用于：

**高 IO 节点池（配备本地 SSD 或 NVMe）**：
```bash
kubectl taint nodes high-io-node-1 storage.highio=true:NoSchedule
```
仅让配置了 Toleration 和 volume 要求的 Pod 调度到这些节点。

**敏感数据节点（包含 PCI DSS、HIPAA 合规数据）**：
```bash
kubectl taint nodes sensitive-node-1 compliance=sensitive:NoExecute
```
使用 NoExecute 确保任何未明确授权在此节点运行的 Pod 立即被驱逐，强化安全边界。

**管理组件专用节点（如 Ingress Controller、监控 Agent）**：
```bash
kubectl taint nodes infra-node-1 node-role.kubernetes.io/infra=:NoSchedule
```
配合 Toleration 将集群管理组件固定到基础设施节点池。

**节点排空后驱逐已有 Pod 的宽限时间**：

当需要将节点置为维护状态时，可以先添加一个带有 tolerationSeconds 的 Taint：

```bash
kubectl taint nodes node1 node.kubernetes.io/maintenance=maintenance:NoExecute
```

Pod 如果携带以下 Toleration 可以继续运行最多 300 秒：

```yaml
tolerations:
- key: "node.kubernetes.io/maintenance"
  operator: "Equal"
  value: "maintenance"
  effect: "NoExecute"
  tolerationSeconds: 300
```

300 秒后 Pod 被驱逐，足够应用完成清理或等待调度到其他节点。

**生产陷阱和经验**：

**Taint 和 Toleration 的 operator 理解**：
- `Equal`：key、value、effect 三者全部匹配
- `Exists`：只匹配 key 和 effect，不关心 value。当使用 Exists 时不需要设置 value 字段

```
# operator: Exists 可容忍所有带 key=nvidia.com/gpu 的 Taint 不论 value
# operator: Equal   仅当 value 也匹配时才容忍
```

**系统组件被误驱逐的预防**：kube-system 命名空间的组件（如 CoreDNS、calico-node）通常自带 `tolerations:
- operator: Exists`，这允许它们容忍所有污点。但如果自定义了 NoExecute 的 Taint，需要确保系统组件设置了对应的 Toleration，否则集群关键组件会被驱逐导致集群故障。

**追问**:
- Q: 如果一个节点同时设置了 NoSchedule 和 NoExecute 两种 Effect 的 Taint，Pod 如何通过 Toleration 匹配？
- Q: `kubectl taint nodes` 命令中的 `-` 后缀（如 `key=value:NoSchedule-`）是什么意思？
- Q: 在节点自动扩缩容（Cluster Autoscaler）场景中，Taint 如何影响节点的扩缩容决策？

---

## Q6: Node Affinity 和 Pod Anti-Affinity 在生产环境中如何配合使用？如何设计跨可用区高可用部署策略？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- Node Affinity 控制 Pod 被调度到哪些节点，支持硬性约束和软性偏好
- Pod Affinity 和 Anti-Affinity 控制 Pod 相对于其他 Pod 的调度位置
- 跨可用区高可用的核心是：Pod Anti-Affinity 配合 topologyKey: topology.kubernetes.io/zone
- Node Affinity 的 requiredDuringScheduling 和 preferredDuringScheduling 分别对应硬约束和软约束
- topologyKey 决定了反亲和性的拓扑范围（节点、可用区、地域）

**完整回答**:

**Node Affinity 的两种表达方式**：

requiredDuringSchedulingIgnoredDuringExecution（硬约束）是调度必须满足的条件，如果没有节点满足条件，Pod 保持 Pending 状态。preferredDuringSchedulingIgnoredDuringExecution（软约束）是调度器尽力满足但不强制的条件，如果不满足，Pod 仍然可以调度到其他节点。

```yaml
spec:
  affinity:
    nodeAffinity:
      # 硬约束：Pod 必须运行在 zone-a 或 zone-b
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values:
            - zone-a
            - zone-b
      # 软约束：优先选择有 ssd=true 标签的节点，权重 80
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
          - key: disktype
            operator: In
            values:
            - ssd
      - weight: 20
        preference:
          matchExpressions:
          - key: environment
            operator: In
            values:
            - production
```

**Pod Anti-Affinity 的高可用部署实现**：

跨可用区高可用的目标是：即使一个可用区整体故障，应用仍然能够提供服务。核心手段是将同一应用的多个副本分散到不同可用区。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 6
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      affinity:
        podAntiAffinity:
          # 硬约束：同一 app=myapp 的 Pod 不能在同一可用区
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - myapp
            topologyKey: topology.kubernetes.io/zone
          # 软约束：尽量不在同一节点
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - myapp
              topologyKey: kubernetes.io/hostname
```

这个配置实现了：
1. 6 个副本分散到至少 3 个不同的可用区（硬约束），每个可用区最多 2 个副本
2. 同一个可用区内，Pod 尽量分散到不同节点（软约束）

topologyKey 的可选值：
- `kubernetes.io/hostname`：节点级别，Pod 不会调度到同一节点
- `topology.kubernetes.io/zone`：可用区级别
- `topology.kubernetes.io/region`：地域级别

**Pod Affinity 的本地性部署实现**：

有些服务希望靠近部署以减少延迟（如缓存和计算服务）：

```yaml
spec:
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
          - key: app
            operator: In
            values:
            - redis-cache
        topologyKey: topology.kubernetes.io/zone
```

这表示 Pod 必须调度到有 redis-cache Pod 运行的可用区。

**性能考虑**：

Pod 反亲和性对调度器的性能有显著影响。调度器需要为每个待调度的 Pod 检查所有已运行的 Pod 的 Label。当集群中 Pod 数量超过 10000 时，PodAntiAffinity 的调度延迟会显著增加。

生产环境中的优化策略：
1. 尽量使用 `requiredDuringSchedulingIgnoredDuringExecution` 做跨可用区反亲和，而不是跨节点。跨节点反亲和可以用 `topologyKey: kubernetes.io/hostname` 的 required，但这会限制副本的最大数量（不能超过节点数）
2. 对于大规模集群，尽量使用 `preferredDuringSchedulingIgnoredDuringExecution`（软约束）而不是硬约束，给调度器更多灵活性
3. 结合 PDB（PodDisruptionBudget）使用，确保自愿中断时的高可用

**常见的设计模式：有状态服务的跨可用区部署**：

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: kafka
spec:
  replicas: 3
  serviceName: kafka
  podManagementPolicy: Parallel
  selector:
    matchLabels:
      app: kafka
  template:
    metadata:
      labels:
        app: kafka
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - kafka
            topologyKey: topology.kubernetes.io/zone
      topologySpreadConstraints:   # 1.19+ 的 Pod Topology Spread Constraints
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: kafka
```

Pod Topology Spread Constraints 是 Pod Anti-Affinity 的更好的替代方案。它保证 Pod 在拓扑域之间的分布尽可能均匀（通过 maxSkew 控制偏差），更加灵活和精细。推荐在新项目中使用 Topology Spread Constraints 而不是 Pod Anti-Affinity 来实现跨可用区均衡部署。

**追问**:
- Q: Topology Spread Constraints 和 Pod Anti-Affinity 有什么区别？什么时候应该用 Spread Constraints 而不是 Anti-Affinity？
- Q: 如果一个 Deployment 有 10 个副本，集群有 3 个可用区，topologySpreadConstraints 的 maxSkew=1 时各可用区的 Pod 分布是怎样的？
- Q: Node Affinity 的 `matchExpressions` 支持哪些 operator？`NotIn`、`Exists`、`DoesNotExist`、`Gt`、`Lt` 各有什么用途？

---

## Q7: Velero 备份和恢复 Kubernetes 集群的原理是什么？在生产环境中如何设计备份策略来应对灾难恢复场景？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 华为、字节跳动、腾讯云

**答案要点**:
- Velero 通过调用 Kubernetes API 备份资源对象，通过快照 API 备份持久卷数据
- 备份由 Velero Server（集群内 Deployment）和 Velero CLI（客户端工具）组成
- 备份存储支持 AWS S3、GCS、Azure Blob 以及 MinIO 等兼容 S3 的对象存储
- 恢复时支持 namespace 映射、资源过滤、PV 重新挂载等灵活配置
- 备份策略需要考虑备份频率、保留策略、跨区域容灾和备份加密

**完整回答**:

**Velero 的架构设计**：

Velero 原名 Heptio Ark，是目前 Kubernetes 社区最成熟的集群备份与恢复工具。它的架构分为两个主要部分：

```
Velero CLI（客户端）
    │
    ▼
┌──────────────────────────────────────────┐
│            Kubernetes 集群                  │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │    Velero Deployment              │   │
│  │  - 备份控制器                      │   │
│  │  - 恢复控制器                      │   │
│  │  - 调度控制器（Schedule）          │   │
│  └────────────────────────────────────┘   │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │    Velero Node Agent (DaemonSet)   │   │
│  │  - 卷快照处理                      │   │
│  │  - 数据上传                        │   │
│  └────────────────────────────────────┘   │
│                                            │
└──────────────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────┐
        │   对象存储 (S3)     │
        │  backups/         │
        │  restores/        │
        │  schedules/       │
        └────────────────────┘
```

**备份的数据类型**：

1. **Kubernetes 资源对象**：Velero 通过 API Server 直接获取所有资源对象（Pod、Service、ConfigMap、Deployment、CRD 等）的 YAML 定义，序列化为 JSON 文件后上传到对象存储。

2. **持久卷数据**：Velero 通过云厂商的 Volume Snapshot API（如 AWS EBS Snapshot、GCP PD Snapshot）创建持久卷的快照。如果卷不支持快照 API，可以使用 restic 或 Kopia（Velero 1.12+）通过文件系统级别备份卷数据。

**Velero 备份的三种方式**：

**按需备份**：
```bash
# 备份整个集群（不包含卷）
velero backup create daily-backup-$(date +%Y%m%d)

# 备份特定命名空间
velero backup create ns-production --include-namespaces production

# 备份包含卷快照
velero backup create with-volumes --snapshot-volumes --include-namespaces mysql

# 备份时排除特定资源
velero backup create without-pods --exclude-resources pods

# 使用 Label 选择器备份
velero backup create by-label --selector app=myapp
```

**按 Schedule 定时备份**：
```bash
# 每天凌晨 2 点备份，保留 30 天
velero schedule create daily-backup \
  --schedule="0 2 * * *" \
  --ttl=720h \
  --include-namespaces production,staging

# 每周日凌晨 3 点全量备份，保留 90 天
velero schedule create weekly-full \
  --schedule="0 3 * * 0" \
  --ttl=2160h \
  --snapshot-volumes
```

**生产环境备份策略设计**：

| 备份类型 | 频率 | 保留时间 | 包含内容 |
|----------|------|----------|----------|
| 关键业务全量备份 | 每 6 小时 | 7 天 | resources + volume snapshots |
| 日备份 | 每日凌晨 | 30 天 | resources + volume snapshots |
| 周备份 | 每周日 | 90 天 | resources + volume snapshots |
| 月备份 | 每月 1 日 | 365 天 | resources + volume snapshots |

**灾难恢复流程**：

场景：整个集群不可用（如区域级故障），需要在新集群中恢复。

```bash
# 1. 在新集群中安装 Velero（使用相同的对象存储）
velero install \
  --provider aws \
  --bucket devops-handbook-backup \
  --secret-file ./credentials-velero \
  --backup-location-config region=us-east-1 \
  --use-volume-snapshots=false \
  --plugins velero/velero-plugin-for-aws:v1.7.0

# 2. 查看可用的备份
velero backup get

# 3. 恢复所有资源（新集群中恢复）
velero restore create --from-backup daily-backup-20260515 \
  --namespace-mappings production:production-dr \
  --preserve-node-ports=false

# 4. 恢复特定资源
velero restore create --from-backup daily-backup-20260515 \
  --include-resources deployments,configmaps,services \
  --include-namespaces production
```

**关键参数**：
- `--namespace-mappings`：在恢复时重命名 Namespace，适用于多集群容灾场景
- `--preserve-node-ports`：是否保留 NodePort 端口号，多集群恢复时避免端口冲突
- `--restore-volumes`：恢复卷快照
- `--existing-resource-policy`：遇到已存在的资源时的处理策略（none/update）

**生产环境的注意事项和经验**：

**备份加密**：如果备份中包含 Secret，建议在对象存储层面启用加密（AWS S3 SSE-S3/SSE-KMS），或者使用 Velero 的插件加密功能。

**备份验证**：定期（至少每月一次）在新集群中执行恢复演练，验证备份的有效性。很多团队发现备份可用但恢复失败——备份是过程，恢复才是目的。

**CRD 的备份问题**：Velero 会备份 CRD 本身和 CRD 实例。但恢复时如果 CRD 定义不存在，CRD 实例无法被恢复。恢复顺序应该是：先恢复 CRD 定义，再恢复 CRD 实例。Velero 默认会处理这个顺序，但在复杂的 Operator 场景下可能不够完善。

**velero-plugin-for-csi**：如果你使用的是 CSI 驱动（如 EBS CSI、GCP PD CSI），Velero 1.10+ 提供了 CSI 插件，支持通过 CSI 快照 API 备份卷。这比传统的 VolumeSnapshot 方式更通用，兼容更多的存储后端。

**追问**:
- Q: 如果将备份恢复到不同配置的集群（如从 GKE 恢复到自建 Kubernetes 集群），需要注意哪些兼容性问题？
- Q: Velero 备份的 TTL（Time To Live）到期后，备份数据如何清理？对象存储中的文件和 Kubernetes 中的 Backup 资源是如何关联的？
- Q: 如果只备份了 etcd（如使用 etcd snapshot）而不使用 Velero，会丢失哪些信息？两者的备份粒度有什么不同？

---

## Q8: Kubernetes 集群升级的策略和最佳实践是什么？如何控制升级过程中的风险？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、腾讯、华为云

**答案要点**:
- Kubernetes 版本升级遵循 N-2 支持策略（当前版本 + 前两个次要版本）
- 控制平面组件版本不能高于 kube-apiserver 版本
- kubelet 版本不能高于 kube-apiserver 版本，且不能低于 kube-apiserver 的两个次要版本
- 升级路径建议一个次要版本递进，跳过版本升级风险高
- 升级前必须备份 etcd，验证节点就绪状态

**完整回答**:

**版本兼容性矩阵**：

Kubernetes 官方对组件版本的兼容性约定：

| 组件 | 版本范围 |
|------|----------|
| kube-apiserver | 升级目标版本 |
| kube-controller-manager | 必须 &lt;= apiserver 版本 |
| kube-scheduler | 必须 &lt;= apiserver 版本 |
| kubelet | 不能高于 apiserver，且不能低于 apiserver 的两个次要版本 |
| kube-proxy | 必须与 kubelet 同版本 |

举个例子：如果升级 apiserver 到 1.28，则 kubelet 可以运行 1.26、1.27 或 1.28。这意味着在多节点集群中，可以逐个升级节点而不需要一次性升级所有组件。

**升级前的准备工作**：

1. **检查当前版本和要升级的版本差距**：一次最多跨越一个次要版本。例如 1.25 -> 1.26 可以，1.25 -> 1.27 不支持。

2. **查看变更日志**：阅读 CHANGELOG，特别是废弃（Deprecation）和移除（Removal）的 API。例如 1.22 移除了大量旧的 API 版本（extensions/v1beta1、apps/v1beta2 等）。不提前检查的后果是：升级后旧的 YAML 文件无法被 API Server 识别。

3. **检查集群健康状态**：
```bash
# 所有节点是否 Ready
kubectl get nodes

# 核心组件状态
kubectl get pods -n kube-system

# etcd 集群状态（需要在 etcd 节点执行）
etcdctl endpoint health --cluster

# 检查是否有异常事件
kubectl get events --sort-by='.lastTimestamp' | tail -50

# 控制平面 Pod 日志
kubectl logs -n kube-system -l component=kube-apiserver
```

4. **备份 etcd 数据**：
```bash
# 在所有 etcd 节点执行
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-snapshot-$(date +%Y%m%d).db

# 验证备份
ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-snapshot-*.db
```

5. **确认所有 Deployment 使用新的 API 版本**：运行 `kubectl convert` 或在测试集群中验证 YAML 文件的兼容性。

6. **确认存储和数据面组件兼容性**：检查 CNI 插件（Calico、Cilium）、CSI 驱动、Ingress Controller 等是否声明了与目标版本的兼容性。

**控制平面升级步骤**：

以 kubeadm 工具为例：

```bash
# 1. 升级第一个控制平面节点
kubeadm upgrade plan                 # 查看可升级版本和 API 变更
kubeadm upgrade apply v1.28.3        # 升级到 1.28.3
    # 自动执行：更新证书、更新 kube-apiserver/kube-controller-manager/kube-scheduler 静态 Pod
    # 自动备份 etcd

# 2. 升级其他控制平面节点
kubeadm upgrade node                 # 在工作节点或额外控制面节点上执行

# 3. 升级 kubelet 和 kubectl
apt-mark unhold kubelet kubectl && \
  apt-get update && \
  apt-get install -y kubelet=1.28.3-00 kubectl=1.28.3-00 && \
  apt-mark hold kubelet kubectl

systemctl daemon-reload
systemctl restart kubelet
```

**节点池升级（控制面节点和工作节点）**：

对于工作节点的升级，推荐采用"先腾空、后升级、再恢复"的流程。对于有 50 个节点的集群，分批升级是标准做法：

```bash
# 批次 1：升级 10 个节点，观察 24 小时
for node in node-{1..10}; do
  kubectl drain $node --ignore-daemonsets --delete-emptydir-data
  ssh $node "apt-get update && apt-get install -y kubelet=1.28.3-00 kubectl=1.28.3-00 && systemctl restart kubelet"
  kubectl uncordon $node
done

# 验证批次 1 是否正常
kubectl get nodes
kubectl get pods -A -o wide | grep $node  # 检查 Pod 恢复

# 批次 2 + 批次 3 同理
```

**使用节点池管理工具**：

如果使用云托管集群（AKS、EKS、GKE），节点池升级大多由云厂商工具管理：

```bash
# AKS 升级
az aks upgrade --resource-group mygroup --name mycluster --kubernetes-version 1.28.3

# EKS 升级
eksctl upgrade cluster --name mycluster --version 1.28

# GKE 升级
gcloud container clusters upgrade mycluster --master --cluster-version 1.28.3
```

**升级过程中的风险控制策略**：

**1. 蓝绿集群升级**：同时运行两个集群，新版本集群（蓝）搭建完成后，将流量从旧版本集群（绿）切换到新集群。这种方式的成本是双倍的集群资源，但风险最小，回滚最快。

**2. 金丝雀节点升级**：先升级 1-2 个非关键工作节点，将部分生产流量调度到这些节点上运行一段时间（通常 1-3 天），监控是否有异常指标。确认正常后再进行全部升级。

**3. PDB 确保应用可用性**：在升级过程中对工作节点执行 drain 操作时，kubelet 会通过 eviction API 逐出 Pod。PDB 确保在同一时间可用 Pod 数不低于阈值。

**4. 回滚计划**：升级前必须有回滚方案。对于 kubeadm 部署的集群，回滚意味着：
- 从备份恢复 etcd 快照
- 回退 kubelet 和控制平面组件的二进制版本
- 对于云托管集群，回滚通常意味着通过 Infrastructure as Code（Terraform）重建集群到旧版本

**云托管集群 vs 自建集群的升级策略差异**：

| 维度 | 云托管（EKS/AKS/GKE） | 自建（kubeadm） |
|------|----------------------|-----------------|
| 控制平面升级 | 云厂商自动处理，短暂不可用 | 需要手动升级所有控制面节点 |
| etcd 升级 | 云厂商负责 | 手动升级 |
| 回滚能力 | 有限（依赖云厂商支持） | 完全可控（etcd 快照恢复） |
| 升级窗口 | 通常在云厂商维护窗口内 | 自定义 |
| 兼容性检查 | 云厂商在升级前自动检查 | 需要手动检查 |

**追问**:
- Q: 升级过程中 kube-apiserver 短暂不可用会影响集群业务的正常运行吗？kubelet 和 controller-manager 的行为是什么？
- Q: 如果一个集群跳过了两个次要版本（如从 1.24 直接升级到 1.26），可能遇到哪些问题？有没有官方支持的路径？
- Q: kubeadm upgrade apply 在执行过程中如果失败，集群会处于什么状态？如何处理失败的升级？

---

## 本题难度等级说明

| 难度 | 图标 | 对应层级 |
|------|------|----------|
| ⚫⚪⚪ 初级 | 初级 | 1-3 年经验 |
| ⚫⚫⚪ 中级 | 中级 | 3-5 年经验 |
| ⚫⚫⚫ 高级 | 高级 | 5 年+ 经验 |
