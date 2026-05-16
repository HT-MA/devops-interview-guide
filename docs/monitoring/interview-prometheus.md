---
id: interview-prometheus
title: Prometheus 面试题
description: Prometheus 监控体系高频面试题，涵盖 TSDB 存储、PromQL 最佳实践、服务发现、长期存储方案等真实面试场景
---

# Prometheus 面试题

## Q1: Prometheus 为什么采用 Pull 模型而不是 Push 模型？什么场景下需要用 Pushgateway？

**Difficulty**: ⚫⚫⚪ Intermediate | **Companies**: 阿里、字节跳动、腾讯

**Key Points**:
- Pull 模型使 Prometheus 主动控制采集节奏，避免被采集端过载
- Pull 模型天然支持健康检查——拉不到数据就是服务挂了
- Pushgateway 用于短生命周期任务（批处理、CronJob）或无法被直接拉取的网络隔离场景
- Pushgateway 有局限性：无法告知 Prometheus 任务是否存活，会聚合多个实例指标导致无法区分

**Full Answer**:

Pull 模型是 Prometheus 区别于传统监控系统（如 Zabbix、Nagios）最核心的设计决策。这个问题的回答要展现你对"控制面"和"数据面"分离的理解。

Pull 模型的核心优势：

第一，**故障隔离**。Prometheus Server 主动从目标端拉取数据，采集行为由监控系统自己控制。如果某个 Target 响应变慢，只会影响它自己的采集超时，不会波及其他 Target 或监控系统本身。Push 模型恰恰相反——当所有 Agent 同时推数据时，接收端可能成为瓶颈，而且问题会随着 Agent 数量增长而放大。

第二，**健康检测**。在 Pull 模型下，拉不到数据本身就是一种告警信号。如果 Prometheus 在 Scrape 间隔内连续无法从某个 Target 拉取数据，说明该 Target 或所在节点已不可用。Push 模型无法区分"服务正常但没有产生数据"和"服务已经挂了"。

第三，**配置驱动**。Pull 模型中 Target 列表在 Prometheus 配置或 ServiceMonitor 中统一管理，通过文件服务发现、Consul、Kubernetes 服务发现等方式动态管理。这使得扩缩容时监控配置自动跟随，不需要在每台机器上维护 Agent 配置。

Pushgateway 的使用场景：

```yaml
# Pushgateway 适用场景：批处理任务
# 比如一个 Spark 任务运行 10 分钟，Prometheus 的 15s Scrape 间隔可能刚好错过
# 批处理任务在结束时将指标推送到 Pushgateway

# 不适用场景：长期运行的服务（应该直接暴露 /metrics）
# 不适用场景：需要区分实例的指标（Pushgateway 会聚合所有推送）
```

Pushgateway 的三个主要缺陷：
1. 单点故障风险——Pushgateway 挂了所有批处理指标丢失
2. 无法过期——如果批处理任务停止推送旧指标除非手动清理否则永远存在
3. 聚合丢失维度——多个实例推送相同指标到同一个 Pushgateway 无法区分来源

实际生产建议：批处理指标尽量改为暴露 HTTP `/metrics` 端点让 Prometheus 拉取。如果必须使用 Pushgateway，设置 `push_time_seconds` 指标的告警来检测推送过期。

**Follow-up Questions**:
- Q: Prometheus 的 Scrape 周期内如果一个 Target 恰好重启了两次会丢失数据吗？Pull 模型如何处理这种场景？
- Q: 在 Kubernetes 环境中，Pull 模型如何采集 DaemonSet 类型的 Pod 指标？NodePort 模式和 Direct 模式有什么区别？
- Q: Pushgateway 的指标 Aggregation 机制如何配置？什么情况下会错误聚合导致误判？

---

## Q2: Prometheus TSDB 的存储格式是什么样的？数据是如何写入和压缩的？

**Difficulty**: ⚫⚫⚫ Advanced | **Companies**: 阿里、腾讯、字节跳动

**Key Points**:
- TSDB 采用自定义的块存储格式，每个块包含多时间的样本数据
- 每个块由 meta.json、index、chunks 和 tombstones 组成
- 数据先写入 WAL（Write-Ahead Log），再周期性压缩为不可变块
- 压缩过程对样本进行降采样和去重，默认 2 小时一个块
- 删除标记使用 tombstone 机制，不立即删除物理数据

**Full Answer**:

Prometheus TSDB 的设计参考了 Facebook Gorilla 论文的压缩思路。这是面试中区分"会用"和"懂原理"的核心问题。

**存储结构**：

每个 TSDB 数据目录下按时间分块（Block），每个块覆盖 2 小时的时序数据：

```
/data/
  └── 01EM6Q6A1YPX4G9T4XQ6H7Y8Z9/  # Block
      ├── meta.json                  # 元数据（时间范围、样本数等）
      ├── chunks/                    # 压缩后的样本数据
      │   └── 000001
      ├── index                      # 倒排索引（指标名 -> 标签 -> 块）
      └── tombstones                 # 删除标记
```

**写入流程**：

1. 数据首先写入 WAL（预写日志），确保宕机不丢数据
2. 内存中维护一个 Head Block，包含最近的数据
3. Head Block 在内存中进行时序合并，当达到 2 小时阈值或触发 compaction 时
4. 将 Head Block 写入磁盘成为完整的不可变 Block

**压缩算法**（参考 Gorilla 论文）：

TSDB 的核心压缩能力体现在两个层面：

- **时间戳压缩**：对同一时序的连续时间戳，只存储差值（Delta of Delta）。大部分时间戳间隔固定，可以压缩到 1-4 字节。
- **值压缩**：使用 XOR 压缩算法。连续采样值如果变化很小（大多数情况），XOR 结果中前导零和后缀零很多，可以大幅压缩。

实测压缩比：受监控的原始样本约 16 字节（8 字节时间戳 + 8 字节值），经过 Gorilla 压缩后平均约 1.37 字节/样本，压缩率达 11.7:1。

**Compaction 过程**：

Compactor 定期合并小 Block 为大 Block：
- 2 小时的小块 -> 10 小时的更大块
- 10 小时 -> 50 小时
- 50 小时 -> 250 小时
- 压缩过程中执行去重、删除已标记 tombstone 的数据

值得注意的是，超过 Retention 周期的 Block 会被直接删除（文件级删除，非常高效）。

**Follow-up Questions**:
- Q: Prometheus 的 WAL 和传统数据库的 WAL 在设计上有什么不同？WAL 破损如何恢复？
- Q: TSDB 的倒排索引是如何实现的？高基数指标（如 `url`、`user_id`）为什么会导致 OOM？
- Q: `--storage.tsdb.retention.size` 和 `--storage.tsdb.retention.time` 同时设置时哪个先触发？

---

## Q3: Prometheus Remote Write 的设计原理是什么？使用 Remote Write 时需要注意哪些问题？

**Difficulty**: ⚫⚫⚫ Advanced | **Companies**: 字节跳动、美团、快手

**Key Points**:
- Remote Write 是 Prometheus 将采集数据实时转发到远程存储的协议
- 使用 Snappy 压缩 + Protocol Buffers 序列化，HTTP 传输
- 提供 Write-Ahead Log 级别的可靠性保证，写入失败会在本地队列重试
- 生产环境需要配置合理的队列参数，避免背压导致 OOM
- Remote Write 不支持数据去重，需要下游系统处理

**Full Answer**:

Remote Write 是 Prometheus 扩展存储能力的关键机制。当单机 Prometheus 无法满足存储容量或高可用要求时，通过 Remote Write 将数据转发到 Thanos Receiver、Mimir、VictoriaMetrics 等长期存储。

**协议细节**：

Prometheus Remote Write 协议基于 HTTP：
```
POST /api/v1/write
Content-Type: application/x-protobuf
Content-Encoding: snappy
```

请求体是 snappy 压缩的 protobuf 消息，包含 TimeSeries 数组，每个 TimeSeries 包含 Labels 和 Samples。从 2.0 到 2.1 协议有过一次重大升级，主要是增加了 metadata 的支持。

**队列机制**：

每条 Remote Write 对应的 WAL 会在内存中维护一个队列：

```yaml
# 关键队列参数
remote_write:
  - url: "http://thanos-receiver:19291/api/v1/receive"
    queue_config:
      capacity: 2500              # 每个分片的队列容量
      max_shards: 200             # 最大并发分片数
      min_shards: 1               # 最小分片数
      max_samples_per_send: 500   # 每次发送的最大样本数
      batch_send_deadline: 5s     # 批处理超时
      min_backoff: 30ms           # 重试最小间隔
      max_backoff: 5s             # 重试最大间隔
```

当远程存储响应变慢时，队列会触发背压机制：
1. 发送请求失败，数据保留在队列中
2. 如果队列积压超过 `capacity`，写入被阻塞
3. 如果持续阻塞，WAL 增长导致磁盘压力
4. 极端情况下 Prometheus 会 OOM（内存中队列数据太多）

关键的生产配置策略：
- `max_shards` 不要设得太大——200 个分片对应 200 个并发 HTTP 连接，对远程存储的负载不可忽视
- `capacity` 设置为样本采集速率的合理倍数——如果每秒采集 10 万样本，`capacity` 设为 100 万意味着最多允许 10 秒的写入延迟
- 启用 `retry_on_http_429` 和 `retry_on_http_500` 避免偶发失败丢数据

**数据一致性问题**：

Remote Write 不保证 exactly-once 语义。当网络故障导致重试时，远程存储可能收到重复数据。Thanos、Mimir、VictoriaMetrics 各自实现了去重机制：
- Thanos：通过 Sidecar 上传 TSDB 块，查询时合并去重
- Mimir：通过 Distributor 的哈希一致性 +  ingest 路径的 dedup
- VictoriaMetrics：通过 `dedup.minScrapeInterval` 参数在存储层去重

**Follow-up Questions**:
- Q: Remote Write 和 Remote Read 分别解决什么问题？为什么 Prometheus 官方不推荐 Remote Read？
- Q: Remote Write 的 WAL 有多大？如何监控队列积压？
- Q: 如果远程存储不可用持续 2 小时，重新恢复后数据会怎样？Prometheus 的本地存储缓存能缓解这个问题吗？

---

## Q4: Recording Rules 和 Alerting Rules 在 Prometheus 中各自的作用是什么？使用上有什么最佳实践？

**Difficulty**: ⚫⚫⚪ Intermediate | **Companies**: 腾讯、阿里、美团

**Key Points**:
- Recording Rules 用于预计算复杂或频繁查询的 PromQL，将结果存为新指标
- Alerting Rules 用于定义告警条件，在条件满足时触发告警
- Recording Rules 降低 Grafana Dashboard 加载时间和查询压力
- Alerting Rules 需要合理设置 `for` 持续时间避免抖动误告警
- 两者通过 `record:` 和 `alert:` 关键字区分

**Full Answer**:

Recording Rules 的核心价值在于"空间换时间"。当你的 Grafana Dashboard 每次刷新都要计算一次 30 天范围的 `histogram_quantile` 时，即使用户体验极差，也浪费了大量计算资源。

**Recording Rules 典型场景**：

```yaml
groups:
  - name: recording_rules
    interval: 1m
    rules:
      # 场景 1：预计算分位数（最典型的用例）
      - record: job:request_duration_seconds:p99_5m
        expr: |
          histogram_quantile(0.99,
            sum(rate(request_duration_seconds_bucket[5m])) by (job, le)
          )

      # 场景 2：预计算错误率
      - record: job:error_rate:ratio_5m
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (job)
          /
          sum(rate(http_requests_total[5m])) by (job)

      # 场景 3：聚合不常用的维度
      - record: cluster:node_cpu_usage:ratio_5m
        expr: |
          1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) by (cluster)
```

最佳实践要求 Recording Rules 遵循命名约定：`level:metric_name:operations`，其中 `level` 表示聚合层级（`job`、`instance`、`cluster`），`operations` 表示统计类型（`rate`、`p99`、`avg`）。

**Alerting Rules 的设计策略**：

```yaml
groups:
  - name: alerting_rules
    interval: 30s
    rules:
      - alert: APIHighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          /
          sum(rate(http_requests_total[5m])) by (service) > 0.05
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "{{ $labels.service }} error rate is {{ $value | humanizePercentage }}"
          runbook: "https://runbook.company.com/api-error-rate"
```

`for: 5m` 是区分"抖动"和"真实故障"的关键。没有 `for` 阈值，一个突发的 5 秒 503 峰值就会触发告警。设置 5 分钟的评估窗口确保问题持续存在才告警。

一个常见的反模式：在 Alerting Rule 的 `expr` 中使用 `rate[1m]`。1 分钟的速率窗口过于敏感，上下抖动很大。通常 `[5m]` 是一个合理的平衡点。

**Recording vs Alerting 混合使用**：

```
采集原始指标 -> Recording Rules(预计算错误率) -> Alerting Rules(基于预计算指标)
```

这样 Alerting Rule 可以写成：
```promql
job:error_rate:ratio_5m{job="api-gateway"} > 0.05
```

而不是：
```promql
sum(rate(http_requests_total{job="api-gateway", status=~"5.."}[5m])) / sum(rate(http_requests_total{job="api-gateway"}[5m])) > 0.05
```

可读性、可维护性、以及底层采集指标变更时的解耦都更好。

**Follow-up Questions**:
- Q: Recording Rules 的 Eval 间隔和原始数据采集间隔之间有什么关系？Eval 间隔太短或太长分别有什么影响？
- Q: 如何监控 Recording Rules 的执行性能？可以使用哪些 Prometheus 内置指标？
- Q: 在大规模集群中，Recording Rules 的聚合计算可能导致什么问题？如何优化？

---

## Q5: PromQL 中 `rate()`、`irate()`、`increase()` 有什么区别？各自的适用场景是什么？

**Difficulty**: ⚫⚫⚪ Intermediate | **Companies**: 字节跳动、腾讯、阿里

**Key Points**:
- `rate()` 计算指定时间窗口内的每秒平均增长率，自动处理计数器重置
- `irate()` 计算最后两个样本点的每秒瞬时增长率，对突变更敏感
- `increase()` 计算指定时间窗口内的总增量，同样处理计数器重置
- `rate()` 适合长时间窗口（5m-30m），`irate()` 适合短时间窗口（1m 以内）
- `increase()` 在 Grafana 中常用于趋势分析，但实际是 `rate() * 时间窗口秒数`

**Full Answer**:

这三个函数都用于 Counter 类型的指标（只增不减的计数器），但它们在计算方式和适用场景上有显著差异。

**`rate()`**：

`rate(v range-vector)` 计算时间窗口内每秒平均增长率。核心逻辑：
1. 取窗口内所有样本点
2. 判断是否有计数器重置（比如 `http_requests_total` 因为进程重启而减少）
3. 如果有重置，分段计算增量并累加
4. 最后增量和除以时间窗口的秒数

```promql
# 5 分钟平均 QPS
rate(http_requests_total[5m])
# 返回：每秒请求数，如 1234.5
```

`rate()` 是生产环境中使用最多的函数。它平滑了短时抖动，能反映服务的整体趋势。

**`irate()`**：

`irate(v range-vector)` 计算最后两个样本之间的每秒增长率。它只取窗口内最后两个点，所以对突变的反应更快，但也更容易受单次采样毛刺影响。

```promql
# 实时 QPS（对突发流量更敏感）
irate(http_requests_total[1m])
```

使用 `irate()` 需要注意：如果采集间隔是 15 秒，窗口至少需要设置两个采样点以上（`[30s]`）。否则窗口内只有一个样本点，无法计算。更关键的是，`irate()` 在 Grafana 图表中放大时可能会出现锯齿状曲线，因为每个 Scrape 周期的微小抖动都会被放大。

**`increase()`**：

`increase(v range-vector)` 计算窗口内的总增量，它底层实现是 `rate(v range-vector) * 窗口秒数`。

```promql
# 过去 1 小时的总请求数
increase(http_requests_total[1h])
```

`increase()` 存在一些容易被忽略的问题：
1. **采样对齐误差**：时间窗口边缘可能只包含部分样本，导致计算结果不精确
2. **整数非整数**：Counter 可能是小数（`http_request_duration_seconds_count` 也可能是浮点），`increase()` 的结果不一定为整数
3. **使用 Grafana 的 `$__range` 变量时要小心**：如果面板的查询范围不是采集周期的整数倍，结果会产生偏差

**实际选择指南**：
- 一般 QPS/吞吐量仪表盘：使用 `rate()` + `[5m]`
- 实时监控/告警：使用 `rate()` + `[1m]` 或 `[2m]`，不要用 `irate()`
- 需要展示"瞬时"速率：`irate()` + `[1m]`，仅用于 Grafana 单值图
- 特定时间段的增量统计（如"过去 1 小时产生了多少请求"）：`increase()`

**Follow-up Questions**:
- Q: `rate()` 的"外推"机制是什么？为什么 `rate(counter[1m])` 在某些情况下会返回非整数？
- Q: 如果 Counter 在窗口内重置了多次，`rate()` 能否正确处理？极端场景下会有 Bug 吗？
- Q: 对于 Gauge 类型指标，应该用哪个函数计算变化率？

---

## Q6: Prometheus 支持哪些服务发现方式？在 Kubernetes 环境下如何实现自动发现？

**Difficulty**: ⚫⚫⚪ Intermediate | **Companies**: 阿里、字节跳动、腾讯

**Key Points**:
- Prometheus 原生支持多种服务发现：Kubernetes、Consul、DNS、File-based、EC2、Azure 等
- Kubernetes 服务发现通过 APIServer Watch 机制实时感知 Pod、Service、Endpoint 变更
- `relabel_configs` 是服务发现的核心控制机制，过滤和重写标签
- Kubernetes 环境下需要配置 `__meta_kubernetes_*` 标签的 relabel 规则
- Prometheus Operator 通过 ServiceMonitor 和 PodMonitor 简化配置

**Full Answer**:

**Kubernetes 服务发现机制**：

当使用 `kubernetes_sd_configs` 时，Prometheus 通过 Kubernetes APIServer 的 Watch API 实时获取资源变更：

```yaml
scrape_configs:
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      # 只采集带 prometheus.io/scrape: "true" 注解的 Pod
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true

      # 从注解中读取 metrics 端口
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        target_label: __metrics_path__
        regex: (.+)

      # 将命名空间和 Pod 名映射到标签
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
```

`role` 参数决定了 Prometheus 发现什么级别的资源：
- `role: pod`：发现所有 Pod，基于 Pod 注解控制采集
- `role: service`：发现 Service，然后通过 Endpoint 找到后端 Pod
- `role: endpoints`：发现 Endpoint，最常用，能获取就绪的 Pod IP
- `role: node`：发现 Node，适合采集节点级别指标（如 kubelet）
- `role: ingress`：发现 Ingress 资源

**Relabeling 的执行顺序**：

理解 relabel 的执行顺序是排查发现问题的关键：

```
1. __meta_kubernetes_* 标签被赋值
2. __address__ 默认设为 <Pod_IP>:<Port>
3. 进入 relabel 阶段：
   a. 第一阶段（__ 标签）：通常用于过滤（keep/drop）
   b. 第二阶段：将 __ 标签映射为用户可见的标签
   c. 第三阶段：修改或删除标签
4. 最终标签用于存储和查询
```

**Prometheus Operator 的抽象**：

在生产环境中直接写 `scrape_configs` 不够 Kubernetes-native。Prometheus Operator 提供了更高级的抽象：

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-service
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: api-server
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
      relabelings:
        - source_labels: [__meta_kubernetes_pod_node_name]
          target_label: node
```

ServiceMonitor 通过标签选择器自动发现 Service，然后 Prometheus Operator 会自动生成对应的 `scrape_configs`。PodMonitor 类似但直接匹配 Pod。

**File-based 服务发现补充场景**：

对于 Kubernetes 之外的遗留系统，File-based 服务发现是最灵活的方式：
```yaml
scrape_configs:
  - job_name: 'legacy-servers'
    file_sd_configs:
      - files:
          - /etc/prometheus/targets/*.json
        refresh_interval: 30s
```

运维人员只需在 JSON 文件中添加或删除 Target，Prometheus 会在 refresh_interval 内自动感知。

**Follow-up Questions**:
- Q: Kubernetes Pod 被调度到新节点后 IP 改变，Prometheus 如何处理这种变更？旧数据和新数据如何关联？
- Q: `relabel_configs` 中的 `action: replace`、`keep`、`drop`、`hashmod`、`labelmap` 分别适用于什么场景？
- Q: 大规模集群（5000+ Pod）中，Prometheus 的 Kubernetes 服务发现会遇到哪些问题？如何优化？

---

## Q7: Thanos、Mimir、VictoriaMetrics 三种长期存储方案各有什么特点？如何选型？

**Difficulty**: ⚫⚫⚫ Advanced | **Companies**: 字节跳动、阿里、腾讯

**Key Points**:
- Thanos：基于 Prometheus Sidecar 模式，组件多但生态成熟，查询全局视图
- Mimir：Grafana Labs 出品，水平扩展、高可用、成本优化的时序数据库
- VictoriaMetrics：单二进制高性能，兼容 PromQL 但存储格式自研，资源消耗低
- 选型需考虑：已有技术栈（Grafana 生态）、运维人力、规模、查询模式

**Full Answer**:

这是 Prometheus 面试中最具实战深度的问题。三种方案都能解决 Prometheus 单机的存储和可用性限制，但设计哲学截然不同。

**Thanos**：

Thanos 的设计思路是"Sidecar 增强模式"，不替换 Prometheus，而是在每个 Prometheus 旁部署 Sidecar：

```
Prometheus + Thanos Sidecar ── 上传 TSDB 块到对象存储 (S3/GCS)
                             ── 提供 Store API 给 Thanos Query
```

架构组件：
- **Sidecar**：数据桥梁，连接 Prometheus 本地存储和对象存储
- **Query**：全局查询引擎，合并多个 Prometheus/Store API 的数据
- **Store Gateway**：从对象存储读取数据，提供查询接口
- **Compactor**：对对象存储中的 TSDB 块进行压缩、降采样、去重
- **Ruler**：独立的规则评估组件，避免 Prometheus 本地规则在故障时丢失

核心优势：保留了 Prometheus 原生的 TSDB 格式，数据完全兼容。查询时去重（通过 `--deduplicate.replica-label`）让多副本 Prometheus 的数据合并为单一视图。

核心痛点：组件多（至少 5 个），运维复杂度高。Sidecar 上传 TSDB 块到对象存储需要 2 小时的延迟（TSDB 块 2 小时不可变后才上传），意味着最近的 2 小时数据必须通过 Sidecar 的 Store API 实时查询。

**Grafana Mimir**：

Mimir 的设计思路是"重新实现兼容 PromQL 的服务端"，完全的 Horizontal Scaling：

```
Ingester ── Distributor ── Store Gateway
   ↑            ↑               ↑
 哈希环      哈希环           对象存储
```

核心特性：
- **Ingester**：接收 Remote Write 数据，在内存中聚合，定时刷新到对象存储
- **Distributor**：数据分片和复制，通过一致性哈希将数据分散到 Ingester 副本
- **Query Frontend**：查询缓存、分片、并行执行
- **Compactor**：块合并、去重和降采样
- **Grafana 深度集成**：Explore、Dashboard、Alerting 全链路整合

Mimir 的最大卖点是"Grafana 原生体验"。如果团队已经在用 Grafana 做可视化、告警，Mimir 的 Alertmanager、Ruler 都可以在 Grafana UI 中统一管理。

成本优化方面，Mimir 支持对象存储作为唯一的持久化层（不需要本地磁盘），支持数据和元数据的分离，查询性能通过缓存层优化。

**VictoriaMetrics**：

VictoriaMetrics 的设计思路是"单二进制高性能引擎"：

```
单二进制（或者 cluster 模式的 vminsert / vmstorage / vmselect）
- vminsert：接收数据（兼容 InfluxDB、Prometheus Remote Write、Graphite、OpenTSDB）
- vmstorage：数据存储层
- vmselect：查询层，兼容 PromQL 和 MetricsQL（超集）
```

核心优势：
1. 资源效率极高——同样规模的监控数据，VictoriaMetrics 的内存和磁盘消耗是 Prometheus 原生 TSDB 的 1/5 到 1/10
2. 写入性能出色——每秒百万样本点写入成为可能
3. 查询快速——特别是高基数查询场景（如 `http_requests_total{user_id=~".+"}`）
4. 运维简单——cluster 模式也只有三个组件，单机模式一个二进制即可
5. 内置功能丰富：downsampling、retention per-tenant、vmbackup、vmalert

VictoriaMetrics 的引擎自研了 `MetricsQL`，是 PromQL 的超集（兼容 100% 的 PromQL），额外提供 `rate()` 的改进版本避免了外推误差，还支持 `rollup_*` 函数。

**选型决策矩阵**：

| 因素 | Thanos | Mimir | VictoriaMetrics |
|------|--------|-------|-----------------|
| 安装复杂度 | 高（5+ 组件） | 中（依赖 Helm） | 低（单二进制） |
| 资源消耗 | 中 | 中 | 低 |
| 查询性能 | 中（依赖对象存储） | 高（有缓存层） | 高（内存索引） |
| PromQL 兼容 | 全原生 | 原生 | 兼容 + 扩展 |
| 运维人力 | 高 | 中 | 低 |
| 社区活跃度 | 高（CNCF） | 高 | 高 |
| 多租户 | 有限 | 原生 | 支持 |

如果一个团队有 5-10 个微服务、几百个 Pod，VictoriaMetrics 单机版就足够了。如果企业级、多租户、与 Grafana 深度集成，Mimir 更合适。如果已经在用 Prometheus Operator、不想改变现有采集架构，Thanos 是自然的选择。

**Follow-up Questions**:
- Q: Thanos Sidecar 上传 TSDB 块到对象存储，如果 Prometheus 挂了 Sidecar 也挂了，最近 2 小时的数据能恢复吗？
- Q: VictoriaMetrics 的 `vmstorage` 节点挂了一台，数据会丢失吗？Cluster 模式下副本机制是怎样的？
- Q: Mimir 的成本优化体现在哪些具体机制上？它对 Remote Write 的背压处理是通用的还是定制的？

---

## Difficulty Levels

| Level | Icon | Experience |
|-------|------|------------|
| Junior | ⚫⚪⚪ Beginner | 1-3 years |
| Intermediate | ⚫⚫⚪ Intermediate | 3-5 years |
| Senior | ⚫⚫⚫ Advanced | 5+ years |
