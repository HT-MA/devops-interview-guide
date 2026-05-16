---
id: interview-core
title: Kubernetes 核心机制面试题
description: etcd 共识、API Server 认证授权、调度框架、控制器模式、CRD 等 K8s 核心组件高级面试题
---

# Kubernetes 核心机制面试题

## Q1: 请详细解释 etcd 在 Kubernetes 中的架构设计，以及 Raft 共识算法是如何工作的？一个三节点 etcd 集群最多能容忍几个节点故障？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、腾讯、字节跳动、华为

**答案要点**:
- etcd 是基于 Raft 协议的分布式键值存储，Kubernetes 用它存储所有集群状态
- Raft 通过 Leader 选举、日志复制、安全性三个子问题保证一致性
- 三节点集群最多容忍 1 个节点故障（需要大多数即 quorum = N/2 + 1）
- etcd 的 watch 机制是 kube-apiserver 事件驱动的基础
- 磁盘性能是 etcd 的关键瓶颈，推荐使用 SSD

**完整回答**:

etcd 是 Kubernetes 控制平面的基石，所有集群数据——Pod、Service、ConfigMap、Secret、CRD 等资源的状态——都存储在 etcd 中。kube-apiserver 是唯一与 etcd 直接交互的组件，其他组件（kube-scheduler、kube-controller-manager、kubelet）都通过 API Server 间接读写 etcd。

Raft 算法将一致性问题分解为三个子问题：

**Leader 选举**：集群中的每个节点有三种状态——Leader、Follower、Candidate。Leader 负责处理所有写请求，Follower 被动复制日志。Leader 通过定期发送心跳（Heartbeat）维持权威，默认心跳间隔 100ms。如果 Follower 在 Election Timeout（通常 150-300ms 随机）内未收到心跳，就会转为 Candidate 并发起选举，向其他节点请求投票。获得大多数（quorum）投票的 Candidate 成为新 Leader。

**日志复制**：客户端的所有写请求先到达 Leader，Leader 将操作写入自己的日志条目，然后并行向所有 Follower 发送 AppendEntries RPC。当日志条目被复制到大多数节点后，该条目进入 committed 状态，Leader 应用该条目并将结果返回客户端。Follower 随后也会将 committed 条目应用到状态机。

**安全性**：Raft 保证了五个安全属性——选举安全（一个任期最多一个 Leader）、Leader 只追加（Leader 不覆盖或删除日志条目）、日志匹配（如果两个节点有相同 index 和 term 的日志条目，则之前的日志也一致）、Leader 完备性（committed 的日志条目在后续任期的 Leader 中一定存在）、状态机安全性（如果节点在某个 index 应用了日志条目，其他节点不会对相同 index 应用不同条目）。

**Quorum 计算**：quorum = floor(N/2) + 1。三节点集群：quorum = 2，容忍 1 个节点故障。五节点集群：quorum = 3，容忍 2 个节点故障。这也是为什么生产环境 etcd 通常是奇数节点——三节点或五节点。三节点够用但只抗单节点故障，五节点更安全但写延迟略高。

**Watch 机制与 kube-apiserver 的交互**：kube-apiserver 通过 etcd 的 watch API 监听资源变化。当有资源变更时，etcd 通过 gRPC stream 将事件推送给 API Server，API Server 再通知相应的 informer。这个机制保证了 kube-controller-manager 和 kube-scheduler 能够实时响应集群状态变化。

**生产环境 etcd 优化经验**：etcd 对磁盘延迟极其敏感。推荐使用 NVMe SSD 且有独立的 IO 带宽。etcd 的 db 大小默认 2GB，当超过时会触发压缩和碎片整理。定期执行 `etcd defrag` 恢复空间，但注意 defrag 期间会阻塞读写。Kubernetes 中建议开启 `--auto-compaction-retention=1` 保留 1 小时的修订版本历史。

**追问**:
- Q: etcd 的 MVCC（多版本并发控制）是如何实现的？为什么需要压缩历史版本？
- Q: 如果 etcd 集群出现网络分区，Raft 如何处理？Kubernetes 集群会受影响吗？
- Q: 如何处理 etcd 集群脑裂（split-brain）场景？恢复步骤是什么？

---

## Q2: kube-apiserver 的认证（Authentication）和授权（Authorization）链路是如何串联的？Webhook 模式在两端分别扮演什么角色？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、腾讯、蚂蚁集团

**答案要点**:
- 请求处理链路为：认证 → 限流 → 授权 → Admission Webhook → 存储到 etcd
- 认证支持多个方式链式尝试：TLS 客户端证书、Bearer Token、Webhook、OIDC
- 授权支持多个模式并行检查：ABAC、RBAC、Webhook、Node
- Webhook 认证用于集成企业身份认证系统，Webhook 授权用于实现自定义访问控制策略
- 匿名请求的认证优先级最低，通过 `--anonymous-auth` 控制

**完整回答**:

kube-apiserver 处理每个 REST 请求时，遵循一个固定的处理管线。理解这个链路的顺序对排查认证授权问题至关重要。

**完整的请求处理链路**：

```
Client Request
    │
    ▼
1. Authentication (认证) ─── TLS 握手证书认证
    │                         │
    │                         ├── Client-CA 签名的证书 → 提取 CN/O 作为用户名
    │                         ├── Bearer Token → 从持有者令牌提取用户信息
    │                         ├── Webhook TokenReview → 调用外部认证服务
    │                         └── OIDC → 通过 OIDC Provider 验证 ID Token
    │
    ▼
2. Authorization (授权) ──── 多个 Authorizer 串行或并行判断
    │                         │
    │                         ├── Node Authorizer (kubelet 专用)
    │                         ├── RBAC Authorizer (最常用)
    │                         ├── ABAC Authorizer (已弃用)
    │                         └── Webhook Authorizer (通过 SubjectAccessReview)
    │
    ▼
3. Admission Controllers (准入控制)
    │
    ├── Mutating Admission Webhooks (修改请求)
    ├── Object Schema Validation (API Server 内置校验)
    └── Validating Admission Webhooks (校验请求)
    │
    ▼
    etcd Storage
```

**认证阶段（Authentication）**：

kube-apiserver 启动时通过 `--token-auth-file`、`--client-ca-file`、`--oidc-*`、`--authentication-token-webhook-config-file` 等参数配置认证方式。认证器按配置顺序依次尝试，任何一个认证器返回成功则停止后续尝试。

最常见的认证方式是 X.509 TLS 客户端证书认证，kubelet、kube-scheduler、kube-controller-manager 以及 kubectl 都使用这种方式。客户端证书的 Common Name（CN）映射为用户名，Organization（O）映射为用户组。

Bearer Token 认证包括 ServiceAccount 令牌（JWT）、Bootstrap Token 以及静态令牌文件。ServiceAccount 令牌是 Pod 访问 API Server 的默认方式，自动挂载到 `/var/run/secrets/kubernetes.io/serviceaccount/token`。

Webhook TokenReview 认证用于集成企业已有的身份认证系统，比如 LDAP、SAML、OAuth2 等。API Server 将 TokenReview 请求发送到外部 Webhook 服务，Webhook 返回 UserInfo。生产环境中，很多公司使用 Dex 或 Keycloak 配合 OIDC 实现单点登录。

**授权阶段（Authorization）**：

授权模式通过 `--authorization-mode` 参数配置，支持逗号分隔的多个模式。多个模式并行检查，任何一个授权器通过请求即放行，所有授权器拒绝才最终拒绝，按配置顺序优先返回。

RBAC 是生产环境最常用的授权模式。RBAC 通过 Role/ClusterRole + RoleBinding/ClusterRoleBinding 控制权限。需要特别注意的是 RBAC 的鉴权机制是白名单式的——没有显式授权就是拒绝。

Node Authorizer 专门处理 kubelet 的 API 请求，确保 kubelet 只能操作自己所在节点的 Pod 和 Node 资源。

Webhook Authorizer 通过 SubjectAccessReview API 调用外部授权服务，适合实现复杂的、动态的访问控制策略，比如基于请求路径、请求方法、请求时间甚至是请求内容的精细控制。很多服务网格和策略引擎（如 OPA、Kyverno）利用 Webhook 授权实现治理。

**追问**:
- Q: RBAC 中存在 Role 和 ClusterRole 两种资源，它们的绑定范围有什么区别？跨 Namespace 访问如何实现？
- Q: ServiceAccount 令牌的 TokenRequest API 和传统 Secret 方式有什么不同？为什么推荐使用 TokenRequest？
- Q: 如何在 API Server 层对请求进行审计（Audit）？Audit 日志可以按阶段配置吗？

---

## Q3: Kubernetes 调度框架（Scheduling Framework）的插件机制是如何运行的？请详细说明各个扩展点（Extension Point）的作用以及如何编写自定义调度插件。

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、字节跳动、华为云

**答案要点**:
- 调度框架将调度流程拆解为多个扩展点，每个扩展点可以注册插件
- 核心扩展点包括：QueueSort、PreFilter、Filter、PostFilter、PreScore、Score、NormalizeScore、Reserve、Permit、PreBind、Bind、PostBind
- 插件通过 KubeSchedulerConfiguration 注册和配置
- Filter 扩展点对应预选（Predicates），Score 扩展点对应优选（Priorities）
- Permit 扩展点支持等待和超时机制，用于实现 Gang Scheduling

**完整回答**:

自 Kubernetes 1.15 引入调度框架（Scheduling Framework）以来，调度器的架构从原先硬编码的 Predicates + Priorities 模型演进为高度可扩展的插件化架构。调度框架将一次调度周期拆解为若干扩展点，插件可以在这些扩展点注入自定义逻辑。

**调度周期（Scheduling Cycle）的完整流程**：

```
Pod 加入调度队列
    │
    ▼
QueueSort  ──── 对调度队列中的 Pod 排序
    │
    ▼
PreFilter  ──── 预处理和预检查，如 Pod 的资源请求聚合
    │
    ▼
Filter     ──── 过滤掉不满足条件的节点（Predicates 的替代）
    │
    ▼
PostFilter ──── 如果 Filter 后没有可用节点，执行抢占或备用策略
    │
    ▼
PreScore   ──── 评分前的数据准备
    │
    ▼
Score      ──── 为每个过滤后的节点打分（0-100）
    │
    ▼
NormalizeScore ── 归一化分数，合并多个评分插件的分数
    │
    ▼
Reserve    ──── 在绑定前预留节点资源（防止竞争）
    │
    ▼
Permit     ──── 批准或延迟调度（支持 Gang Scheduling）
    │
    ▼
(等待绑定周期) PreBind ── Bind ── PostBind
```

**各个扩展点的详细职责**：

**QueueSort**：对调度队列中的 Pod 进行排序。默认插件是 PrioritySort，按 Pod 优先级排序。整个调度框架中只能启用一个 QueueSort 插件。

**PreFilter**：在过滤前进行预处理，例如 NodeResourcesFit 插件会计算 Pod 的总资源请求，检查是否超过节点容量。如果返回不可调度，调度周期提前终止。

**Filter**：相当于 Predicates，过滤不符合条件的节点。常见的 Filter 插件包括 NodeResourcesFit（检查 CPU/内存是否充足）、NodePorts（检查端口冲突）、NodeAffinity（匹配节点选择器）、TaintToleration（检查污点容忍）。Filter 插件是并行执行的以提升性能。

**PostFilter**：当所有节点都被 Filter 淘汰时触发。最核心的用途是实现抢占（Preemption），即尝试驱逐低优先级 Pod 来为高优先级 Pod 腾出空间。默认的 DefaultPreemption 插件在这个扩展点工作。

**PreScore**：用于在评分前生成评分插件需要的数据缓存。例如 NodeResourcesBalancedAllocation 算分插件需要的节点资源使用数据在 PreScore 阶段准备。

**Score**：为每个通过了 Filter 的节点打分，分数范围 0-100。每个 Score 插件独立打分后通过 NormalizeScore 统一归一化。常见的 Score 插件包括 NodeResourcesBalancedAllocation（资源均衡）、ImageLocality（优先使用已有镜像的节点）、TaintToleration（优先调度到无污点节点）。

**NormalizeScore**：合并多个 Score 插件的分数。每个插件可以设置权重，最终的分数是加权总和。NormalizeScore 确保所有插件的分数在同一量级。

**Reserve**：在 Reserve 阶段，插件会在内部维护的状态中预留 Pod 需要的资源。这防止了在绑定阶段发生资源竞争。如果后续绑定失败，会调用 Unreserve 回调释放预留。

**Permit**：这是最有意思的扩展点。Permit 可以批准、拒绝或延迟调度决策。延迟机制通过超时控制实现，Pod 被标记为 Waiting 状态直到被批准或超时。这可以用来实现 Gang Scheduling（就是等一组 Pod 全部调度到同一批节点再执行绑定，如 Spark、MPI 作业）。Coscheduling 插件就是基于 Permit 扩展点实现的。

**PreBind**：绑定前的准备，例如动态创建存储卷（CSI 卷挂载准备）。

**Bind**：执行 Pod 到节点的绑定，默认的 DefaultBinder 插件将绑定写入 API Server。如果启用了自定义 Bind 插件，调度器会优先调用自定义绑定器。

**PostBind**：绑定后的通知回调，通常用于清理和日志记录。

**生产环境中的经验**：在 5000 节点规模的集群中，Filter 阶段的并行执行对调度性能至关重要。建议只启用必要的 Filter 插件以控制调度延迟。如果需要在调度器中集成自定义业务逻辑（如拓扑感知调度、GPU 拓扑感知），编写 Filter 和 Score 插件是最常见的方式。

**追问**:
- Q: 如何让调度器在调度 Pod 时感知 GPU/NUMA 拓扑？哪个扩展点最适合实现这类逻辑？
- Q: Pod 被 Permit 插件标记为 Waiting 状态后超时，调度器如何处理？
- Q: 如何保证多个调度器（多 Profile）不会调度同一个 Pod？

---

## Q4: client-go 的 Informer 机制是如何工作的？Reflector、Informer、Indexer 和 DeltaFIFO 各负责什么职责？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、腾讯、蚂蚁集团、华为

**答案要点**:
- Informer 是 client-go 的核心设计模式，实现了 List + Watch 的自动化事件驱动
- Reflector 负责通过 API Server 的 watch API 监听资源变化
- DeltaFIFO 作为生产者-消费者队列解耦 Reflector 和 Informer
- Indexer 提供本地缓存和索引查询能力，线程安全
- SharedInformer 支持同一资源被多个消费者共享，避免冗余连接

**完整回答**:

Informer 模式是 Kubernetes 控制器生态的基石。几乎所有的控制器——Deployment Controller、ReplicaSet Controller、kube-scheduler、kube-controller-manager 中的各种 controller——都是基于 Informer 模式构建的。

**整体架构**：

```
API Server
    ▲
    │ List & Watch
    │
┌──────────────────────────────────────────────────┐
│                   Informer                        │
│                                                    │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐  │
│  │ Reflector │──▶│DeltaFIFO │──▶│  Process      │  │
│  │           │   │          │   │  (回调函数)    │  │
│  └──────────┘   └────┬─────┘   └──────────────┘  │
│                      │                            │
│                      ▼                            │
│               ┌──────────────┐                    │
│               │   Indexer    │                    │
│               │  (本地缓存)   │                    │
│               └──────────────┘                    │
└──────────────────────────────────────────────────┘
```

**Reflector** 是 Informer 的最上游组件，负责与 kube-apiserver 通信。启动时先执行一次 List 操作获取全量数据（如所有 Pod 的 ResourceVersion），然后基于该版本号发起 Watch。Reflector 内部维护一个 `lastSyncResourceVersion`，在 Watch 连接断开或超时时，可以基于这个版本号重新发起 List 或 Watch，保证了数据不丢失和不重复。

生产中常见的问题：如果 Reflector 的 Watch 连接频繁断开，需要在 kube-apiserver 侧检查 `--max-requests-inflight` 和 `--watch-cache-size` 参数。ETCD 的压缩参数 `--auto-compaction-retention` 如果设置得过小，可能导致 Watch 请求因为版本号太旧而失败（too old resource version），此时 Reflector 会自动降级为全量 List。

**DeltaFIFO** 是一个生产者-消费者队列，Reflector 将资源变更事件封装为 Delta 对象放入队列。每个 Delta 包含变更类型（Added、Updated、Deleted、Replaced、Sync）和变更后的对象。FIFO 特性保证了事件处理的顺序性，而去重机制确保同一资源的多次变更不会导致重复处理。

**Indexer** 本质上是一个线程安全的本地缓存，基于 ThreadSafeStore 实现。Indexer 将对象按 Namespace/Name 索引存储，提供了快速查询能力（不需要每次都请求 API Server）。Indexer 支持自定义索引函数，例如按照 Label 建立索引，这在需要按特定标签查询 Pod 时非常有用。

Indexer 的数据来源是 DeltaFIFO 中 Pop 出来的事件。当 Informer 的处理函数调用完毕后，Indexer 内的数据就会更新。

**SharedInformer** 解决了同一资源类型需要被多个控制器监听的问题。如果没有 SharedInformer，每个控制器都会各自建立一条到 API Server 的 Watch 连接，这在控制器数量多时会对 API Server 造成巨大压力。SharedInformer 通过共享一个 Reflector + DeltaFIFO 实例，将变更事件广播给所有注册的 EventHandler。

**EventHandler** 分为三个回调方法：`OnAdd`、`OnUpdate`、`OnDelete`。在工作队列模式下，通常的做法是在回调中将资源的 key（namespace/name）放入 workqueue，由 worker goroutine 从队列中取出并处理，而不是在回调中直接操作资源。这种模式可以控制并发处理速率，实现失败重试和背压。

**追问**:
- Q: SharedInformerFactory 的 Resync 机制是什么？Resync 的真正用途是什么？
- Q: 如果 Informer 的本地缓存与 API Server 数据不一致，可能是什么原因导致的？
- Q: List + Watch 的初始同步过程中，如何避免处理到过期事件？

---

## Q5: client-go 的 workqueue 有哪几种类型？限流队列（RateLimitingQueue）的限流策略有哪些？在生产环境中如何配置？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、腾讯、华为

**答案要点**:
- client-go 提供三种队列：普通队列 Queue、延时队列 DelayingQueue、限流队列 RateLimitingQueue
- RateLimitingQueue 内部组合了 DelayingQueue 和 RateLimiter
- 内置限流器包括 BucketRateLimiter（令牌桶）、ItemExponentialFailureRateLimiter（指数退避）、ItemFastSlowRateLimiter（快慢路径）
- 生产环境推荐使用 MaxOfRateLimiter 组合多个限流器
- 每个控制器应独立设置 workqueue 的限流参数，避免互相影响

**完整回答**:

client-go 的 workqueue 是 Kubernetes 控制器的核心组件，用于解耦事件的生产和消费。理解 workqueue 对编写健壮的控制器至关重要。

**三种队列类型**：

**Queue（普通队列）**：最基本的 FIFO 队列，提供了 `Add`、`Get`、`Done` 三个核心方法。`Add` 会做去重处理，同一 key 被多次添加不会产生重复条目。`Done` 方法标记一个条目处理完成，允许后续的同 key 条目进入队列。这个去重机制非常重要——当 Pod 频繁更新时，不会导致队列膨胀。

**DelayingQueue（延时队列）**：在 Queue 的基础上增加了 `AddAfter` 方法，允许在指定延迟后将条目加入队列。底层的实现是一个优先级队列（基于最小堆）配合定时器。当我们需要等待依赖条件满足时，延时队列非常有用。比如等待 PVC 绑定完成后再处理 Pod。

**RateLimitingQueue（限流队列）**：在 DelayingQueue 之上嵌入了 RateLimiter，当条目处理失败需要重试时，`AddRateLimited` 方法会根据限流器计算出的延迟时间将条目加回队列。这是生产环境中最常用的队列类型。

**限流器的四种实现**：

**1. BucketRateLimiter（令牌桶）**：包装了 golang 标准的 `rate.Limiter`，限制每秒的操作次数。适合控制整体处理速率，防止控制器过度使用 API Server。例如 `rate.NewLimiter(rate.Limit(10), 100)` 表示每秒产生 10 个令牌，桶容量 100。

**2. ItemExponentialFailureRateLimiter（指数退避）**：这是最常用的限流器。当同一个条目处理失败时，重试延迟按指数增长。默认配置是 baseDelay 5ms，maxDelay 1000s。计算公式为 `min(baseDelay * 2^失败次数, maxDelay)`。第 1 次重试等待 5ms，第 2 次 10ms，第 3 次 20ms，直到达到 1000s 的上限。这种策略在 API Server 短暂不可用时天然有效，不会造成请求风暴。

**3. ItemFastSlowRateLimiter（快慢路径）**：提供两个阶段的限流策略。在重试次数较少的阶段使用短延迟（快路径），超过阈值后使用长延迟（慢路径）。例如 `fastDelay=5ms, slowDelay=10s, maxFastAttempt=3`，表示前 3 次重试间隔 5ms，之后变为 10s。适用于某些操作前几次可能失败但很快会成功（如 DNS 解析暂未生效），连续失败多次后就需要大幅降低重试频率。

**4. MaxOfRateLimiter（组合限流器）**：将多个限流器组合使用，最终的延迟时间取所有限流器计算结果中的最大值。生产环境的标准做法是将 BucketRateLimiter 和 ItemExponentialFailureRateLimiter 组合：

```go
rateLimiter := workqueue.NewMaxOfRateLimiter(
    workqueue.NewItemExponentialFailureRateLimiter(5*time.Millisecond, 1000*time.Second),
    &workqueue.BucketRateLimiter{Limiter: rate.NewLimiter(rate.Limit(10), 100)},
)
```

这样既能保证单个条目的指数退避（防止重复错误导致 API Server 压力），又能控制全局的处理速率（防止突发大量新事件）。

**生产环境配置建议**：

控制器的限流参数需要根据业务场景调整。对于处理关键路径的控制器（如 EndpointSlice Controller），队列消费者的 goroutine 数量应该更多（10-20），限流可以宽松一些。对于非关键控制器（如 Garbage Collector），消费者数量可以少一些（2-5），限流更严格。

使用 Prometheus 指标 `workqueue_queue_duration_seconds_bucket` 监控条目在队列中的等待时间。如果等待时间持续增长，说明消费者的处理速度跟不上生产者，需要增加 worker 数量或优化处理逻辑。

**追问**:
- Q: 当某个条目重试次数过多达到 MaxOfRateLimiter 的最大延迟后，应该如何处理该条目？
- Q: workqueue 的 ShutDown 方法是如何工作的？如何在优雅关闭时确保正在处理的任务完成？
- Q: 在处理完一个条目后调用 `Done` 方法的时机是什么？不调用 Done 有什么后果？

---

## Q6: Kubernetes 的 Finalizer 和 OwnerReference 机制是如何工作的？什么场景下会导致资源删除卡住？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、蚂蚁集团

**答案要点**:
- Finalizer 是资源删除的预删除钩子，阻止资源被立即从 etcd 中删除
- OwnerReference 定义了资源间的父子关系，支持级联删除
- 级联删除分为前台（Foreground）和后台（Background）两种模式
- Resource 删除卡住最常见的原因是 Finalizer 未被清理
- 手动移除 Finalizer 可以强制删除资源，但需要业务上确认安全

**完整回答**:

Finalizer 和 OwnerReference 是 Kubernetes 垃圾回收机制的基石，理解它们的工作原理对生产运维至关重要。

**OwnerReference（所有者引用）**：

OwnerReference 声明了一个资源对另一个资源的拥有关系。典型场景是：ReplicaSet 创建的 Pod 自动带有指向 ReplicaSet 的 OwnerReference，ReplicaSet 创建的 Pod 自动带有指向 Deployment 的 OwnerReference。

```yaml
# Pod 上自动生成的 OwnerReference
metadata:
  ownerReferences:
  - apiVersion: apps/v1
    kind: ReplicaSet
    name: myapp-7d9f8c6b4
    uid: a1b2c3d4-e5f6-7890-abcd-ef1234567890
    controller: true        # 标记为控制关系
    blockOwnerDeletion: true # 阻止所有者被删除直到子资源被清理
```

OwnerReference 的核心作用是定义级联删除行为。当父资源被删除时，Kubernetes 的垃圾回收器（Garbage Collector）根据级联策略处理子资源：

**后台级联删除（默认）**：父资源先被删除，垃圾回收器随后在后台清理孤儿。这是默认行为，效率最高但有一个短暂窗口子资源成为孤儿。

**前台级联删除**：在 `kubectl delete` 时指定 `--cascade=foreground`。此时父资源的 deletionTimestamp 被设置，处于 Terminating 状态，直到所有子资源都被删除后，父资源才被真正移除。

**孤儿删除（Orphan）**：`--cascade=orphan` 删除父资源但不删除子资源，子资源成为孤儿。

**Finalizer（终结器）**：

Finalizer 是一个更精细的预删除钩子机制。它本质上是一个字符串列表，存储在 `metadata.finalizers` 字段中。当资源被删除时，Kubernetes 不会立即将资源从 etcd 中移除，而是：

1. 设置 `metadata.deletionTimestamp` 为当前时间
2. 将资源标记为 Terminating 状态
3. 等待所有 Finalizer 被移除后再执行删除

每个 Finalizer 对应一个控制器，控制器观察到资源的 deletionTimestamp 被设置后，执行各自的清理逻辑（如释放云资源、清理外部存储、通知其他系统），然后从 finalizers 列表中移除自己的 Finalizer 条目。当 finalizers 列表为空时，资源自动被删除。

```yaml
# 带有 Finalizer 的资源
metadata:
  finalizers:
  - kubernetes.io/pv-protection          # 内置：防止 PV 被直接删除
  - foregroundDeletion                   # 内置：前台级联删除
  - custom.example.com/my-finalizer      # 自定义 Finalizer
```

常见的 Finalizer 场景：

**PV/PVC 保护**：`kubernetes.io/pv-protection` 防止 PV 在绑定 PVC 时被删除。类似的 `kubernetes.io/pvc-protection` 保护正在被 Pod 使用的 PVC。

**Namespace Terminating**：这是生产环境中最常见的卡死场景。当 Namespace 处于 Terminating 状态时，通常是 Namespace 下的某个资源有未清理的 Finalizer。排查命令为：

```bash
kubectl get namespace <name> -o json | jq '.spec.finalizers'
kubectl get namespace <name> -o json | jq '.status.conditions'
```

**资源删除卡住的排查方法**：

```bash
# 1. 查看资源是否设置了 deletionTimestamp
kubectl get pod <name> -o yaml | grep deletionTimestamp

# 2. 查看 finalizers
kubectl get pod <name> -o json | jq '.metadata.finalizers'

# 3. 查看 ownerReferences
kubectl get pod <name> -o json | jq '.metadata.ownerReferences'

# 4. 强制删除（谨慎使用）
kubectl delete pod <name> --grace-period=0 --force

# 5. 手动移除 Finalizer（强力操作，业务上确认安全后使用）
kubectl patch pod <name> -p '{"metadata":{"finalizers":[]}}' --type=merge
```

**追问**:
- Q: 自定义控制器如何实现自己的 Finalizer 逻辑？删除事件和更新事件的处理逻辑有何不同？
- Q: 如果一个自定义 Finalizer 的控制器宕机了，相关资源会一直卡在 Terminating 状态吗？如何恢复？
- Q: OwnerReference 的 `blockOwnerDeletion` 字段有什么作用？什么场景下需要设置？

---

## Q7: MutatingAdmissionWebhook 和 ValidatingAdmissionWebhook 有什么区别？Admission 控制链路的执行顺序是怎样的？如何设计一个安全的生产级 Admission Webhook？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、腾讯、字节跳动、华为云

**答案要点**:
- Mutating Webhook 在资源被 API Server 持久化之前修改请求对象
- Validating Webhook 在 Mutating Webhook 执行完毕后校验请求的合法性
- 完整的执行顺序：认证 → 授权 → Mutating Admission → Schema Validation → Validating Admission
- Webhook 配置支持 matchPolicy、failurePolicy、timeoutSeconds、reinvocationPolicy 等关键参数
- 生产级的 Webhook 必须处理高可用、超时、幂等和对象版本兼容问题

**完整回答**:

Admission Controller 是 Kubernetes API Server 请求处理链路中的最后一道防线，位于认证和授权之后、资源持久化之前。Webhook 类型的 Admission Controller 将控制逻辑外移至外部 HTTP 服务，允许集群管理员实现自定义的准入策略。

**Admission 控制链路的完整顺序**：

```
1. Authentication（认证）
2. Authorization（授权）
3. Mutating Admission Controllers（包括 MutatingWebhookConfiguration）
   ├── NamespaceLifecycle
   ├── MutatingWebhook（根据配置按顺序调用外部服务）
   ├── PodNodeSelector
   └── 其他内置 Mutating 控制器
4. Object Schema Validation（对象结构校验）
5. Validating Admission Controllers（包括 ValidatingWebhookConfiguration）
   ├── ValidatingWebhook（根据配置按顺序调用外部服务）
   ├── PodSecurity
   ├── ResourceQuota
   └── 其他内置 Validating 控制器
6. 持久化到 etcd
```

**Mutating vs Validating 的核心区别**：

MutatingAdmissionWebhook 可以修改请求中的资源对象。典型的应用场景包括：
- 为没有显式设置资源限制的 Pod 注入默认的 requests/limits（LimitRanger 的替代）
- 自动注入 Sidecar 容器（如 Istio 的 envoy 代理注入）
- 为 Pod 添加通用的 Label、Annotation 或者环境变量
- 自动挂载日志收集 agent、监控 Agent

ValidatingAdmissionWebhook 只能校验不能修改。典型的应用场景包括：
- 强制要求所有 Deployment 必须设置 PodDisruptionBudget
- 校验镜像仓库必须来自内部私有 Registry
- 禁止 Privileged 容器或 HostNetwork 模式
- 强制要求资源设置 CPU/内存 Limits

**关键配置参数及其生产建议**：

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: example-validation
webhooks:
- name: validate.example.com
  clientConfig:
    service:
      name: webhook-service
      namespace: webhook-system
      path: /validate
    caBundle: <CA_BUNDLE>   # 必须使用 TLS，杜绝 HTTP
  rules:
  - operations: ["CREATE", "UPDATE"]  # 慎用 DELETE，避免级联删除阻塞
    apiGroups: ["apps", ""]
    apiVersions: ["v1"]
    resources: ["pods", "deployments"]
  failurePolicy: Fail         # 生产环境用 Fail，测试用 Ignore
  matchPolicy: Equivalent     # 匹配等价的 API 版本
  timeoutSeconds: 10          # 不能超过 30 秒，建议 5-10 秒
  sideEffects: None           # 必须声明无副作用，否则 Kubernetes 1.12+ 会拒绝
  reinvocationPolicy: IfNeeded # 仅当对象被其他 Mutating Webhook 修改后重新调用
  namespaceSelector:
    matchExpressions:
    - key: kubernetes.io/metadata.name
      operator: NotIn
      values:
      - kube-system            # 排除系统组件
      - webhook-system         # 排除自身所在的 Namespace
  objectSelector:              # 对象级别过滤
    matchLabels:
      admission-webhook/enabled: "true"
```

**生产环境部署 Webhook 的关键注意事项**：

**高可用和故障隔离**：Webhook 服务的 Deployment 至少要 2 个副本，跨可用区部署。failurePolicy 设置为 Fail 时，Webhook 不可用会直接影响整个集群的 API 操作。虽然不是断路器，但应该使用 `namespaceSelector` 排除 kube-system 等关键命名空间，即使 Webhook 故障也不会影响集群核心组件的正常创建。

**TLS 证书管理**：Webhook 的 gRPC/HTTP 端点必须使用 TLS。推荐使用 cert-manager 自动管理证书轮换。证书过期是 Webhook 故障的最常见原因之一。

**幂等性和重入安全**：MutatingWebhook 可能被多次调用（如 reinvocation），因此注入逻辑必须是幂等的——多次注入不能产生副作用。常用的做法是在注入前检查资源是否已经包含预期内容。

**Timeout 和背压控制**：Webhook 的 timeoutSeconds 上限是 30 秒，但生产环境不应超过 10 秒。Webhook 自身需要实现 HTTP 请求的超时控制和并发限制，防止慢查询积压导致 OOM。

**Side Effects 声明**：从 Kubernetes 1.12 开始，Webhook 必须声明 `sideEffects: None`。这意味着 Webhook 不能产生修改外部系统的副作用（例如写入数据库）。如果 Webhook 确实有副作用，需要声明为 `sideEffects: NoneOnReinvocation`。

**追问**:
- Q: 如果多个 MutatingWebhook 同时修改同一个字段，如何控制执行顺序？Webhook 的 reinvocationPolicy 如何确保一致性？
- Q: 为什么 Kubernetes 需要区分 Mutating 和 Validating Admission Controller？把它们合并为一个 Webhook 是否可行？
- Q: 如何在 Webhook 中处理 CRD 资源的校验？CustomResource 的校验和内置资源有什么不同？

---

## Q8: CustomResourceDefinition（CRD）和 API Aggregation Layer 分别适用于什么场景？它们各自的优缺点是什么？如何选择？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- CRD 通过声明式 YAML 定义自定义资源，无需编写 Go 代码即可扩展 Kubernetes API
- API Aggregation Layer 需要额外开发聚合 API Server，编程语言和框架不限
- CRD 适合开发者向 Kubernetes 引入自定义资源，如 Prometheus Operator、ArgoCD
- API Aggregation Layer 适合需要自定义存储、自定义认证或 Protobuf 协议的场景
- CRD 的限制包括：不支持 Protobuf、验证能力有限、不支持自定义存储后端

**完整回答**:

Kubernetes API 的可扩展性是平台化能力的核心。CRD 和 API Aggregation Layer 是两种官方支持的 API 扩展方式，它们代表了不同的设计哲学。

**CRD（CustomResourceDefinition）详解**：

CRD 是声明式的 API 扩展方式。开发者只需要定义资源的 Schema（OpenAPI v3 格式），Kubernetes 自动生成 RESTful API 端点、etcd 存储、watch 支持以及 CLI（kubectl）集成。所有的 CRD 资源数据存储在 etcd 中。

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.stable.example.com
spec:
  group: stable.example.com
  names:
    kind: Backup
    plural: backups
    singular: backup
    shortNames:
    - bk
  scope: Namespaced
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              source:
                type: string
              schedule:
                type: string
                pattern: '^(\d+|\*)(/\d+)?(\s+(\d+|\*)(/\d+)?){4}$'
```

**CRD 的核心优势**：
- 不需要编写 Go 代码，纯声明式定义
- Kubernetes 自动生成完整的 RESTful API，天然支持 OpenAPI 文档生成
- 天然的 etcd 存储、Watch 机制、RBAC 集成
- 生态工具完善：controller-tools、kubebuilder、operator-sdk

**CRD 的核心限制**：
- 不支持 Protobuf 协议（仅 JSON），性能上不如原生 API
- 校验能力局限于 OpenAPI v3 Schema，不支持跨字段校验（除非通过 Admission Webhook 补充）
- 不支持自定义存储后端，所有数据强制存储在 etcd 中
- 不支持子资源（subresource，如 status、scale）的自定义逻辑
- 默认 watch 事件的性能不如原生资源（更多 JSON 序列化开销）

**API Aggregation Layer 详解**：

API Aggregation Layer 允许将外部 API Server 注册到 Kubernetes API Server 的 HTTP 路由表中。聚合的 API Server 可以完全自由地实现自己的逻辑——自定义存储后端、自定义认证、自定义协议等。

```yaml
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1alpha1.custom.example.com
spec:
  group: custom.example.com
  version: v1alpha1
  groupPriorityMinimum: 1000
  versionPriority: 15
  service:
    name: custom-api-server
    namespace: custom-system
  caBundle: <CA_BUNDLE>
```

**API Aggregation Layer 的核心优势**：
- 完全自由的实现——可以使用任何存储、任何协议、任何业务逻辑
- 支持 Protobuf 协议（更优的性能）
- 支持自定义子资源（subresource）逻辑
- 可以复用 Kubernetes 的认证、授权、审计机制
- 适合构建 PaaS 平台的核心 API

**API Aggregation Layer 的缺点**：
- 开发成本高，需要实现完整的 API Server 逻辑
- 运维成本高，需要额外部署和维护聚合 API Server
- 聚合 API Server 需要关注高可用、扩展性、版本兼容性
- 生态工具不如 CRD 成熟

**选型决策指南**：

| 场景 | 推荐方案 | 原因 |
|------|----------|------|
| Operator 模式（如 etcd-operator、Prometheus Operator） | CRD | 声明式定义即可，完全匹配 Operator 模式 |
| 需要自定义存储后端（如将数据存在 S3、MySQL 而非 etcd） | Aggregation Layer | CRD 无法自定义存储 |
| 团队全是 Go 开发者，需要高效率的 API 扩展 | CRD | kubebuilder 工具链成熟 |
| 需要高性能的 API，大量数据的 watch 操作 | Aggregation Layer | Protobuf 支持带来显著性能提升 |
| 快速原型验证、小团队 | CRD | 声明式定义最低成本 |
| PaaS 平台核心 API、多租户控制面 | Aggregation Layer | 灵活的接入控制和自定义存储 |

**生产环境中的实际案例**：
- Prometheus Operator 使用 CRD 定义了 ServiceMonitor、PodMonitor、PrometheusRule 等资源
- ArgoCD 使用 CRD 定义了 Application、AppProject 等资源
- 华为云、阿里云的 Kubernetes 服务使用 API Aggregation Layer 实现了云服务商特定的扩展 API（如弹性伸缩、负载均衡配置）
- Istio 同时使用了 CRD（VirtualService、DestinationRule）和 API Aggregation Layer（istio.io API）

**追问**:
- Q: 如何为 CRD 实现复杂的跨字段校验？除了 OpenAPI Schema 外还能怎么做？
- Q: API Aggregation Layer 中如何实现子资源（如 /status、/scale）的完全自定义逻辑？
- Q: 如果 CRD 的 etcd 数据量过大影响 API Server 性能，如何优化或迁移到 Aggregation Layer？

---

## 本题难度等级说明

| 难度 | 图标 | 对应层级 |
|------|------|----------|
| ⚫⚪⚪ 初级 | 初级 | 1-3 年经验 |
| ⚫⚫⚪ 中级 | 中级 | 3-5 年经验 |
| ⚫⚫⚫ 高级 | 高级 | 5 年+ 经验 |
