---
id: interview-reliability
title: 可靠性工程面试题
description: 系统可靠性工程高频面试题，涵盖错误预算、SLO/SLA/SLI 设计、混沌工程、容量规划、灾备与多活架构等真实面试场景
---

# 可靠性工程面试题

## Q1: 错误预算（Error Budget）的计算方法是什么？当错误预算耗尽时团队应该做什么？

**Difficulty**: ⚫⚫⚪ Intermediate | **Companies**: 字节跳动、阿里、腾讯

**Key Points**:
- 错误预算 = 1 - SLO，代表服务在一段时间内允许的不可用或错误累积量
- 典型计算：月度错误预算 = 总时间 × (1 - SLO)
- 错误预算消耗速率 = 实际不可用时间 / 总时间
- 错误预算耗尽表示 SLO 濒临违反，应停止发布新功能、聚焦可靠性
- 错误预算不仅是"不能发布"，更是驱动研发效率和可靠性平衡的管理工具

**Full Answer**:

错误预算是 Google SRE 理论中最核心的管理概念。它将"可靠性"和"创新速度"之间的冲突转化为一个可量化的决策。

**计算方式**：

```
以 99.9% SLO 为例：

月度错误预算 = 30 天 × 24 小时 × 60 分钟 × (1 - 0.999)
              = 43200 分钟 × 0.001
              = 43.2 分钟

也就是说，你的服务在 30 天内最多可以不可用 43.2 分钟。
```

不同 SLO 对应的错误预算：

```
99% SLO    → 每月允许停机 432 分钟（7.2 小时）
99.9% SLO  → 每月允许停机 43.2 分钟
99.95% SLO → 每月允许停机 21.6 分钟
99.99% SLO → 每月允许停机 4.32 分钟
```

注意：错误预算不是"可以用来停机"的额度，而是"衡量风险"的指标。耗尽错误预算并不意味着"必须停机"——它意味着服务的可靠性已经低于目标，需要把资源从功能开发转移到可靠性提升。

**错误预算消耗的跟踪**：

```promql
# 30 天滚动窗口的错误预算消耗
1 - (
  sum(rate(http_requests_total{status!~"2.."}[30d]))
  /
  sum(rate(http_requests_total[30d]))
)
# 如果结果低于 0.999，说明错误预算已经耗尽
```

在 Grafana 中展示错误预算消耗时，常用"燃烧率"（burn rate）：

```
燃烧率 = 当前错误率 / 目标错误率

当燃烧率为 1 时：错误消耗速率正好匹配预算——30 天后预算恰好用完
当燃烧率为 2 时：15 天后预算就会用完
当燃烧率为 10 时：3 天后预算就会用完
```

**错误预算耗尽时的行动**：

当错误预算耗尽（或即将耗尽），标准流程：

1. **立刻停止所有生产发布**：除非修复可靠性问题，否则不允许任何功能发布
2. **创建错误预算恢复计划**：明确哪些操作可以降低错误消耗（扩容、降级、关闭非核心功能）
3. **排除已知问题**：如果预算耗尽是由已知 Bug 导致的，标记为已知问题并追踪修复进度
4. **事后分析**：错误预算耗尽本身就是一个重要的"告警事件"，需要做根因分析
5. **SLO 重新评估**：如果团队连续几个月都在耗尽预算，说明 SLO 设置过紧或可观测性需要改进

错误预算的消耗速率比消耗量更重要。Google 推荐的多窗口多燃烧率告警模式如下：

```yaml
# 如果 1 小时内消耗了 5% 的 30 天错误预算 → 立即告警
- alert: ErrorBudgetBurnRate
  expr: |
    (
      sum(rate(http_requests_total{status!~"2.."}[1h]))
      /
      sum(rate(http_requests_total[1h]))
    ) > (0.001 * 0.05)
  for: 1h
```

**Follow-up Questions**:
- Q: 错误预算每周归零还是每月归零？滚动窗口和固定窗口各有什么优劣？
- Q: 多服务架构中，错误预算应该如何分配？上游服务消耗了太多的错误预算是否要限制？
- Q: 如果业务团队说"功能更重要"，SRE 如何用错误预算数据来说服他们先做可靠性？

---

## Q2: 在微服务架构中，如何为每个服务设计合理的 SLA、SLO 和 SLI？有哪些常见的设计模式？

**Difficulty**: ⚫⚫⚫ Advanced | **Companies**: 阿里、字节跳动、腾讯

**Key Points**:
- SLI 是"测量什么"，SLO 是"目标值"，SLA 是"对外承诺"
- 微服务架构中，上游服务的 SLO 依赖于下游服务的 SLO
- 设计模式：以用户体验为中心、自上而下分解、错误预算继承
- 每个服务至少应该定义可用性和延迟两个 SLI
- 不要为每个服务设置同样的 SLO——核心支付服务的 SLO 应该比通知服务更高

**Full Answer**:

在微服务架构中定义 SLO 的核心挑战是：一个用户请求穿越 5-10 个服务，每个服务的可靠性叠加构成了最终的用户体验。

**SLI 设计原则**：

对于每个微服务，至少需要定义以下四类 SLI：

```yaml
# 1. 可用性（Availability）
# 请求成功数 / 总请求数
slis:
  availability:
    good_events: sum(rate(http_requests_total{status!~"5.."}[5m]))
    valid_events: sum(rate(http_requests_total[5m]))

# 2. 延迟（Latency）
# 请求在阈值内完成的比例
  latency:
    good_events: sum(rate(http_request_duration_seconds_bucket{le="0.1"}[5m]))
    valid_events: sum(rate(http_request_duration_seconds_count[5m]))

# 3. 吞吐量（Throughput）
# 定义最小吞吐量的下限，过低可能表示服务异常
  throughput:
    min: 1000  # 每秒至少处理 1000 个请求

# 4. 新鲜度（Freshness）/ 对于批处理和数据管道
  freshness:
    # 数据延迟不超过 1 小时
```

**SLO 设计的"自上而下分解"法**：

```
用户体验目标：首页加载 < 2s 可用性 99.9%
                │
                ▼
             拆分链路：
             用户 → CDN → API Gateway → Auth → Product → DB

                ▼
API Gateway: 99.9% 可用性, P99 < 100ms
Auth:        99.95% 可用性, P99 < 200ms
Product:     99.95% 可用性, P99 < 300ms
DB:          99.99% 可用性, P99 < 50ms
```

链路中每个服务需要考虑其依赖的 SLO。如果 API Gateway 依赖 Auth 和 Product 两个服务，且两个服务有串联调用顺序，整体可用性 = Auth SLO * Product SLO。所以下游服务的 SLO 必须比上游服务更高。

**SLA/SLO/SLI 的关系**：

```
SLA（合同承诺）: 99.5% —— 错了要赔钱，通常设得宽松
  ↑
SLO（内部目标）: 99.9% —— 严格，驱动行动
  ↑
SLI（实际测量）: 99.95% —— 应该总是超出 SLO
```

三者之间的合理性准则：
- SLI > SLO：服务健康，有犯错余量
- SLI ≈ SLO：刚好卡线，没有错误预算
- SLI < SLO：已经违反承诺，需要立即行动
- SLA 应该比 SLO 宽松 0.5-1 个 9——给赔偿留缓冲区

**常见的设计模式**：

**模式 1：核心/非核心差异化**

```
支付服务：     SLO = 99.99% (4.32 分钟/月)
订单服务：     SLO = 99.95% (21.6 分钟/月)
通知服务：     SLO = 99.5%  (216 分钟/月)
用户反馈服务：  SLO = 99%    (432 分钟/月)
```

不需要所有服务都追求 99.99%。非关键路径上的服务设置更宽松的 SLO，可以大幅降低整体成本和复杂度。

**模式 2：复合 SLO**

```
用户创建订单流程：
  API Gateway (99.9%) + Auth (99.95%) + Order (99.95%) + DB (99.99%)

  整体 SLO ≈ 99.9% × 99.95% × 99.95% × 99.99% ≈ 99.79%

注意：这是最坏的串行估算。实际上通过重试、熔断、降级可以大幅提高整体可用性。
```

**模式 3：SLO 的季度调整**

SLO 不是一次设好永不改变的。每季度根据以下因素调整：
- 业务重要性是否变化
- 历史达成情况是否太松或太紧
- 基础设施投入是否有变化

**Follow-up Questions**:
- Q: 如果团队既要做业务功能又要保证 SLO，功能发布和 SLO 维护的资源应该如何分配？
- Q: 下游服务的错误（如数据库慢查询）导致上游服务延迟增加，SLO 归属应该归哪个团队？
- Q: 异步消息场景（Kafka）的 SLI 和同步 RPC 场景的 SLI 在设计上有什么不同？消息延迟和消费积压如何定义 SLI？

---

## Q3: 混沌工程的核心原则是什么？在生产环境中实施混沌工程需要注意哪些问题？

**Difficulty**: ⚫⚫⚫ Advanced | **Companies**: 字节跳动、阿里、腾讯

**Key Points**:
- 混沌工程是在系统上实验，验证系统对故障的反应能力
- 核心原则：将故障实验作为"实验"而非"测试"，有假设、有观测、有结论
- 成熟度递进：基础设施故障 -> 服务依赖故障 -> 数据面故障 -> 流量异常
- 生产环境实施的关键：最小爆炸半径、自动化回滚、明确的停顿信号
- 工具选择：Chaos Mesh（Kubernetes）、Litmus、Gremlin、自研平台

**Full Answer**:

混沌工程不是"随机搞破坏"。Netflix 的 Chaos Monkey 名字很有误导性——实际上的 Chaos Engineering 是非常严谨的可控实验。

**混沌工程 vs 传统故障测试**：

```
传统故障测试：
  测试环境，已知场景，已知结果，通过/不通过

混沌工程：
  生产环境（或和生产一致的环境），未知场景，探索行为，验证假设
```

**核心原则（来自混沌工程原则社区）**：

1. **建立稳态假设**：先定义"系统正常"是什么（例如：P99 延迟 < 200ms，错误率 < 0.1%）
2. **引入真实世界的事件**：服务器宕机、网络延迟、资源耗尽、时钟偏差
3. **对比对照组**：用生产流量对比实验组和对照组的指标差异
4. **最小化爆炸半径**：先在小范围实验，逐步扩大
5. **自动化运行**：手动执行混沌实验不可持续

**混沌实验的设计**：

一个标准的混沌实验模板：

```yaml
# Chaos Mesh 实验示例：模拟 Pod 故障
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: payment-service-pod-kill
  namespace: production
spec:
  action: pod-kill
  mode: one            # 每次只杀一个 Pod
  duration: "60s"      # 实验持续 60 秒
  selector:
    namespaces:
      - production
    labelSelectors:
      app: payment
    # **关键：存活 Pod 数不能少于 2，确保服务不中断**
    podPhaseSelector:
      - Running
  scheduler:
    cron: "@every 24h"  # 每天运行一次
```

这个实验的假设："杀掉 Payment 服务的一个 Pod，用户的支付请求不受影响。"

验证方式：实验期间监控 `payment_request_duration_seconds` 和 `payment_error_total`，确认没有显著偏离基线。

**生产环境实施的渐进路线**：

```
阶段 1：基础设施混沌
  - 节点宕机、磁盘故障、网络分区
  - 验证 Kubernetes 调度器、Pod 重新调度、持久化卷重挂载

阶段 2：服务依赖混沌
  - 数据库连接超时、缓存不可用、消息队列积压
  - 验证熔断（Circuit Breaker）、降级（Degradation）、重试（Retry）

阶段 3：数据面混沌
  - 数据损坏、Schema 变更、配置错误
  - 验证数据一致性校验、校验和的自我保护

阶段 4：流量异常混沌
  - 突发流量、慢速 HTTP 攻击、DDOS 流量
  - 验证限流（Rate Limiter）、自动扩容（HPA）、WAF
```

**安全措施**：

1. **最小爆炸半径**：实验的最大影响范围必须明确定义。例如：只影响 1 个可用区，只影响 1 个 Pod，不涉及核心数据库
2. **熔断开关（Kill Switch）**：任何混沌实验都必须有一个一键停止的能力。当关键指标出现异常波动时自动终止实验
3. **工作时间进行**：混沌实验不应该在凌晨或节假日自动触发。确保有值班工程师在场时进行
4. **与业务同步**：在进行可能导致用户体验受损的实验前，需要通知业务方并得到许可
5. **避免连锁反应**：不要同时进行多个混沌实验，否则无法确定哪个故障导致了异常

**Follow-up Questions**:
- Q: Chaos Mesh 和 Litmus 的核心架构差异是什么？在 Kubernetes 环境中如何选型？
- Q: 混沌工程实验失败（系统经不住故障）后，修复措施的优先级如何确定？谁来决定"先修再实验"还是"修好之前不做实验"？
- Q: 在金融行业（强合规要求），生产环境的混沌工程如何满足合规需求？使用预发布环境替代是否可以？

---

## Q4: 容量规划的核心方法和步骤是什么？如何进行有效的线上容量评估？

**Difficulty**: ⚫⚫⚫ Advanced | **Companies**: 阿里、腾讯、字节跳动

**Key Points**:
- 容量规划的目标是：在成本可控的前提下保证服务有足够的余量应对流量增长和波动
- 核心方法：流量预测 -> 资源模型 -> 压力测试 -> 部署规划
- 容量评估的三个维度：CPU、内存、IO（磁盘 IOPS + 网络带宽）
- "容量 = 流量 × 资源消耗系数 + 安全缓冲"——安全缓冲通常为 30-50%
- 容量规划不是一次性活动，而是持续的过程（每季度/每月）

**Full Answer**:

容量规划是 SRE 最容易被忽略但后果最严重的工作。不做容量规划的直接结果是：大促时系统挂掉或者为了确保"不挂"而过度配置浪费 70% 的机器。

**容量规划的五个步骤**：

**第一步：流量预测**

基于历史数据预测未来流量：

```python
# 简单的流量预测模型
historical_qps = get_timeseries("http_requests_total[1y]")
growth_rate = compute_growth_rate(historical_qps)  # 月均增长率
seasonal_factor = compute_seasonal_pattern(historical_qps)  # 季节性模式

# 预测 3 个月后的峰值 QPS
predicted_peak_qps = historical_qps.max() * (1 + growth_rate) ** 3 * seasonal_factor
```

需要关注的几个时间窗口：
- 日常峰值（Daily Peak）：一天内的最高流量
- 周规律（Weekly Pattern）：工作日 vs 周末
- 季节性峰值（Seasonal Peak）：双十一、黑五、春节等
- 年度增长（Annual Growth）：业务自然增长

**第二步：资源模型建立**

建立"单请求消耗多少资源"的模型：

```
每个请求平均消耗：
  CPU: 5ms 的用户态 + 2ms 的内核态
  内存: 50MB RSS（连接池 + 缓存 + 请求上下文）
  磁盘 IO: 0.3 次读 + 0.1 次写
  网络: 1.5KB 入站 + 50KB 出站

如果预测峰值 QPS 是 10000：
  CPU 需求: 10000 × 0.007s = 70 核（用户态） + 20 核（内核态）
  内存需求: 10000 并发 × 50MB = 需要仔细估算（不是简单的 QPS * 每请求内存）
```

注意：资源模型不是线性外推。当 QPS 从 1000 增长到 5000 时，CPU 消耗增长可能不是 5 倍——因为操作系统和运行时在一些阈值下会发生非线性变化（如 GC 频率、连接池等待）。

**第三步：压力测试**

在预发布环境或生产环境（低峰期）进行压力测试：

```bash
# 使用 vegeta 进行 HTTP 压力测试
echo "GET http://service:8080/api/orders" | vegeta attack \
  -rate=5000 \
  -duration=60s \
  -workers=50 | vegeta report

# 输出关键数据：
# Latencies: [mean=45ms, P99=120ms]
# Success: 99.8%
# Throughput: 4980 req/s
# CPU usage: 65%
```

压力测试的关键是找到"饱和点"——当 CPU 使用率达到 80-85% 时，延迟通常会开始显著上升（排队效应）。

**第四步：部署规划**

```
当前容量：2000 QPS (2 台 8C16G 机器，每台 1000 QPS)
预测需求：5000 QPS (3 个月后)

计算：
  所需机器数 = 5000 / 1000 × 1.4（安全缓冲）= 7 台

规划：在 3 个月内逐步增加到 7 台（每个月增加 1-2 台）
同时预留弹性扩容（HPA）的余量
```

**第五步：持续验证**

容量规划完成后不验证等于没做。验证手段：
- 定期压力测试（每季度一次）
- 生产流量压测（通过流量复制或者影子流量）
- 扩容后自动化验证（扩容后自动运行健康检查，确认新节点吞吐符合预期）

**常见的容量陷阱**：

1. **外部依赖的容量限制**：自己的服务扩容到 10000 QPS，但数据库只能处理 5000 QPS——瓶颈转移
2. **连接数限制**：扩容服务实例时，每个实例都会建立连接池，数据库的连接数可能先耗尽
3. **资源争抢**：CPU 密集型服务部署在一起导致 CPU 争抢，实际吞吐低于单机测试
4. **冷启动问题**：新启动的实例需要预热（JIT、缓存填充），并非立即达到标称容量

**Follow-up Questions**:
- Q: Kubernetes HPA 基于 CPU/Memory 的自动扩容和基于 QPS 的扩容有什么区别？各有什么局限性？
- Q: 如何利用 Google SRE 的"需求预测"和"资源规划"模型在成本控制下既保证性能又不浪费服务器？
- Q: 数据库的容量规划和应用层的容量规划有什么不同？为什么数据库扩容更难？

---

## Q5: 灾备设计中 RTO 和 RPO 的核心区别是什么？如何根据业务需求设定合理的 RTO/RPO 目标？

**Difficulty**: ⚫⚫⚪ Intermediate | **Companies**: 阿里、腾讯、字节跳动

**Key Points**:
- RTO（Recovery Time Objective）：从故障发生到服务恢复的最大可接受时间
- RPO（Recovery Point Objective）：故障发生时允许丢失的最大数据量（回溯时间）
- RTO 决定了备份切换的速度要求，RPO 决定了备份频率和复制延迟要求
- RTO 和 RPO 是成本权衡——更低的 RTO/RPO 需要更高的投入
- 设定的核心依据：业务损失随时间增长的曲线

**Full Answer**:

RTO 和 RPO 是灾备设计中最重要的两个指标。它们的区别经常被面试者混淆。

**定义澄清**：

```
故障发生时间点：T0
                        时间线
T0 ──────────────────────────────────────────────►
│  数据丢失窗口          │ 停机窗口               │
│  <── RPO ──>          │  <── RTO ──>          │
│                       │                       │
T0                    T1（备份点）           T2（恢复点）
│                       │                       │
└── 用户提交了 30 笔订单 ┘   └── 系统恢复，开始服务 ┘

RPO = T1 - T0 = 丢失的数据对应的时间段
RTO = T2 - T1 = 从备份中发现到系统恢复的时间
```

**RTO 和 RPO 的典型值**：

```
┌──────────────┬─────────────────┬─────────────────┬──────────────────┐
│   业务等级   │       RTO       │       RPO       │      投入成本    │
├──────────────┼─────────────────┼─────────────────┼──────────────────┤
│ 金融核心交易 │   < 1 分钟      │   < 10 秒       │   极高（数千万） │
│ 电商核心下单 │   < 5 分钟      │   < 1 分钟      │   高             │
│ 一般业务服务 │   < 30 分钟     │   < 15 分钟     │   中             │
│ 内部管理系统 │   < 4 小时      │   < 1 小时      │   低             │
│ 数据仓库/BI  │   < 24 小时     │   < 1 天        │   极低           │
└──────────────┴─────────────────┴─────────────────┴──────────────────┘
```

**如何设定 RTO 和 RPO**：

设定 RTO 和 RPO 的核心方法不是"工程师觉得安全"，而是"业务损失的定量分析"：

```
每小时停机损失 = 每小时交易额 × 利润率 + 品牌损失因子

如果电商平台每小时交易额 100 万，利润率 10%：
  每小时停机损失 = 100万 × 10% + 品牌损失（难以量化但存在）
  
  如果 RTO = 5 分钟，损失 = 100万/12 × 10% ≈ 8300 元
  如果 RTO = 1 小时，损失 = 100万 × 10% = 10 万元
```

RPO 的设定类似：

```
每 5 分钟的数据丢失 = 5 分钟的订单量 × 平均订单金额
  
  如果 RPO = 5 分钟，丢失 ≈ 5000 元（还可以接受）
  如果 RPO = 30 分钟，丢失 ≈ 30000 元（对财务影响大）
```

**技术实现对应关系**：

```
RPO < 10 秒:
  - 同步数据复制（数据库层同步复制、共享存储卷）
  - 意味着多活或主备距离不能太远（同步复制受光速限制，100km ≈ 1ms 延迟）
  
RPO < 1 分钟:
  - 异步流复制（MySQL binlog 复制、PostgreSQL streaming replication）
  - 典型的主从架构，延迟控制在秒级

RPO < 15 分钟:
  - 定期快照 + 增备
  - 定时备份数据库

RTO < 5 分钟:
  - 冷备自动切换（DNS 切换、VIP 切换、Kubernetes 自动重启）
  - 需要完整的自动化流程，没有人工步骤

RTO < 1 小时:
  - 人工切换流程（有 Standard Operating Procedure，演练过）
  - 恢复步骤：确认故障 -> 切换 DNS -> 启动备份实例 -> 验证服务
```

**RTO/RPO 的验证**：

设定 RTO 和 RPO 后，必须定期验证。光纸上谈兵不行：

```bash
# 模拟故障：切断主库网络
# 记录从故障开始到服务完全恢复的时间
# 验证丢失了多少数据

# 灾备演练报告
故障模拟时间: 2026-05-16 14:00:00
切换完成时间: 2026-05-16 14:03:22
RTO 达成: 3 分 22 秒 ✅（目标 < 5 分钟）
RPO 实测: 丢失最近 247 条记录（对应 45 秒的数据）
RPO 达成: 45 秒 ✅（目标 < 60 秒）
```

灾备演练最容易被忽视的是"恢复后的验证"——恢复后连上了不代表业务正常，需要验证写入也正常。

**Follow-up Questions**:
- Q: 跨地域灾备（异地多活）的场景中，RTO 和 RPO 受到光速限制的物理约束，如何设计远距离灾备？
- Q: Kubernetes 环境下的有状态服务（数据库、缓存）的 RTO 如何优化？StatefulSet 的启动顺序对恢复时间有多大影响？
- Q: RTO 和 RPO 的目标应该由谁来设定——业务方还是技术方？双方在设定过程中各承担什么角色？

---

## Q6: 多活架构（Multi-region / Active-Active）的设计模式有哪些？如何实现跨区域流量调度和数据同步？

**Difficulty**: ⚫⚫⚫ Advanced | **Companies**: 字节跳动、阿里、腾讯

**Key Points**:
- 多活架构分为：同城双活、异地双活、异地多活，复杂度逐级递增
- 核心挑战：数据冲突（写写冲突）、数据一致性、流量调度
- 流量调度：DNS 智能解析、全局负载均衡（GSLB）、客户端调度
- 数据同步：单向异步复制、双向同步、CRDT 无冲突数据类型
- 多活不是银弹——"两个 region 都挂"的概率基本和"一个 region 不挂"的概率差不多

**Full Answer**:

多活架构是最复杂的可靠性工程话题之一。在面试中，面试官想考察的是你对复杂度的理解和务实的态度——而不是去设计一个理论化的完美方案。

**三种多活模式**：

**模式 1：同城双活（Metro Active-Active）**

```
数据中心 A ──光纤互联── 数据中心 B
距离 < 50km，延迟 < 1ms

流量：50% A + 50% B
数据：同步复制（数据库层），强一致性
切换：任一数据中心挂，所有流量切到另一个
```

这是最常见的"多活"形式，难点不是技术而是物理限制——光纤延迟限制了同步距离，一般只能做到同城 50-80km 以内。

**模式 2：异地双活（Geo Active-Active）**

```
Region A (北京) ──异步复制── Region B (上海)
距离 > 1000km，延迟 > 30ms

流量：80% A + 20% B（或按用户地域就近接入）
数据：异步复制，最终一致性
切换：A 挂后 B 接管全部流量，但可能丢失最近几秒的数据
```

异地双活的核心难点是"数据冲突"。因为异步复制，同一个用户在 A 和 B 的操作可能冲突。

解决方案：
- **按用户分片**：用户 A 的所有写操作都在 Region A，用户 B 的所有写操作都在 Region B（通过用户 ID 哈希决定）
- **按功能分片**：读操作可以走任何 Region，写操作只走主 Region

**模式 3：异地多活（Multi-region Active-Active）**

```
Region A ──异步── Region B ──异步── Region C
  │                                               │
  └─────────────── 异步 ────────────────┘

采用 CRDT（Conflict-free Replicated Data Types）或无冲突数据架构
```

这是最复杂的模式，Google Spanner、Amazon DynamoDB 和 CockroachDB 是这方面的代表。但实际上大部分互联网公司的"异地多活"只对无状态应用层多活，有状态的数据层仍然是主备模式。

**流量调度方案**：

```
用户请求
    │
    ▼
DNS 智能解析
   ├─ 根据用户 IP 返回最近的入口 IP（基于 Anycast 或 GeoDNS）
   │
   ▼
全局负载均衡（GSLB）
   ├─ 健康检查：各 Region 的健康状态
   ├─ 权重分发：正常时 50/50 或按计算能力比例
   └─ 故障切换：Region A 挂了 → 100% 到 Region B
           │
           ▼
    区域负载均衡（ALB / NLB）
```

```yaml
# DNS 智能解析示例
# 华东用户 -> Region A
# 华南用户 -> Region B
# Region A 挂了  -> 所有用户到 Region B
apiVersion: v1
kind: Service
metadata:
  annotations:
    external-dns.alpha.kubernetes.io/ttl: "60"
    # TTL 决定了故障切换速度——TTL=60 意味着 DNS 切换最多等 60 秒
```

**数据同步策略**：

```yaml
# 方案 1：应用层双写（最常见的"伪多活"）
客户端 -> Region A (写 Region A 数据库 + 发消息到 MQ)
        -> MQ 同步到 Region B (Region B 消费者写入 Region B 数据库)

# 方案 2：数据库层复制
Region A MySQL Master -> binlog -> Region B MySQL Slave
Region B MySQL Master -> binlog -> Region A MySQL Slave
# 注意：双向复制必须在应用层解决冲突，MySQL 自身不处理写写冲突

# 方案 3：CRDT（高级方案）
# 使用 Riak / Redis CRDT / 自研无冲突数据结构
# 让多个 Region 的写入可以自动合并
```

实际生产中，绝大多数异地多活采用的是"无状态多活 + 有状态主备"的混合模式：
- 应用层（无状态）：所有 Region 都活，流量就近接入
- 数据层（有状态）：主 Region 可写，其他 Region 只读（或仅缓存读）

**多活的"8 大误区"**：
1. 多活等于高可用——多活只是高可用的手段之一，错误的多活比单活更脆弱
2. 数据层也做多活——大多数业务不需要数据库级别的多活，应用层多活 + 数据库主备足够
3. 多活必须全量——核心链路多活就可以了，非核心服务单活也能接受
4. 多活省成本——多活通常成本翻倍（至少 2x 资源）

**Follow-up Questions**:
- Q: Anycast 和 GeoDNS 在全局流量调度中各有什么优劣？Anycast 的 BGP 路由收敛时间对 RTO 有多大影响？
- Q: 如何测试多活架构的有效性？通过混沌工程注入 Region 级故障来验证切换是否流畅？
- Q: 多 Region 部署下的 Config 管理怎么做？不同 Region 的配置差异如何管理和同步？

---

## Q7: 备份策略应该如何设计？如何验证备份的有效性而不仅仅是"备份成功了"？

**Difficulty**: ⚫⚫⚪ Intermediate | **Companies**: 腾讯、美团、字节跳动

**Key Points**:
- 备份策略三要素：备份频率、保留周期、备份类型（全量/增量/差异）
- 备份的"3-2-1 原则"：3 份副本，2 种介质，1 份异地
- 备份执行成功 ≠ 备份可用——必须定期恢复验证
- 恢复演练是真正的"备份验证"——能恢复的备份才是真备份
- 不可变备份（Immutable Backup）防止勒索软件和误删

**Full Answer**:

备份领域的最大谎言是"我们的备份策略很完善"——直到真正需要恢复时才发现备份文件损坏了。

**备份策略设计**：

```
备份类型：
  全量备份（Full Backup）：每次都备份全部数据
    - 恢复最简单，但备份时间长、占用空间大
    - 频率依赖数据量：小数据每天全量，大数据每周全量

  增量备份（Incremental Backup）：只备份上次备份后变化的数据
    - 备份快、空间小，但恢复时（全量 + N 个增量）链条越长风险越高

  差异备份（Differential Backup）：只备份上次全量备份后变化的数据
    - 介于全量和增量之间，恢复时只依赖最近一次全量和最近一次差异

推荐的混合策略（以数据库为例）：
  ┌────────────┬──────────┬───────────┬────────────┐
  │  时间      │  策略    │  备份类型  │  保留时间  │
  ├────────────┼──────────┼───────────┼────────────┤
  │ 每天凌晨 3点 │  全量    │  mysqldump│  30 天     │
  │ 每小时整点  │  增量    │  binlog   │  7 天      │
  │ 实时       │  WAL     │  连续归档  │  24 小时   │
  └────────────┴──────────┴───────────┴────────────┘
```

**3-2-1 原则的实际落地**：

```
3 份副本：
  1. 生产环境的源数据
  2. 本地备份（同机房的 NAS/S3）
  3. 异地备份（不同城市，至少 > 500km）

2 种介质：
  1. 磁盘/SSD（用于快速恢复）
  2. 对象存储/磁带（用于长期归档）

1 份异地：
  -> 防止物理灾难（地震、火灾、洪水）摧毁整个数据中心
```

**备份的自动化验证**：

这是面试中最能区分"背概念"和"真实经验"的问题。

基础的验证方法是"备份文件的校验和验证"：

```bash
# 备份完成后校验
mysqldump ... | gzip > backup-$(date +%Y%m%d).sql.gz
md5sum backup-$(date +%Y%m%d).sql.gz > backup-$(date +%Y%m%d).sql.gz.md5
# 下次恢复前验证：
md5sum -c backup-*.sql.gz.md5
```

但校验和只能验证"文件没有损坏"，不能验证"数据是否正确"。

正确的验证方法是**周期性恢复演练**：

```bash
#!/bin/bash
# 自动恢复演练脚本（每周执行）

# 1. 从备份恢复到一个隔离实例
RESTORE_INSTANCE="backup-verify-$(date +%Y%m%d)"
kubectl create deployment $RESTORE_INSTANCE --image=mysql:8.0
kubectl wait --for=condition=available deployment/$RESTORE_INSTANCE

# 2. 从最近的备份恢复数据
aws s3 cp s3://backup/database/production/latest-full.sql.gz - | gunzip | \
  mysql -h $RESTORE_INSTANCE -u root -p$PASS production

# 3. 执行一致性验证
# 验证表数一致
TABLE_COUNT_SOURCE=$(mysql -h production -e "SELECT COUNT(*) FROM information_schema.tables" | tail -1)
TABLE_COUNT_RESTORE=$(mysql -h $RESTORE_INSTANCE -e "SELECT COUNT(*) FROM information_schema.tables" | tail -1)
if [ "$TABLE_COUNT_SOURCE" -ne "$TABLE_COUNT_RESTORE" ]; then
  echo "CRITICAL: Table count mismatch!"
  alert_pagerduty "Backup verification failed: table count mismatch"
fi

# 4. 验证最核心的 10 张表的数据行数
for table in orders users payments products; do
  COUNT_SOURCE=$(mysql -h production -e "SELECT COUNT(*) FROM production.$table" | tail -1)
  COUNT_RESTORE=$(mysql -h $RESTORE_INSTANCE -e "SELECT COUNT(*) FROM production.$table" | tail -1)
  # 允许一定的延迟偏差
  DIFF=$((COUNT_SOURCE - COUNT_RESTORE))
  if [ "$DIFF" -gt 1000 ]; then
    echo "WARNING: $table row count diff: $DIFF"
  fi
done

# 5. 清理放回资源池
kubectl delete deployment $RESTORE_INSTANCE
```

验证的关键指标：
- **恢复成功率**：过去 30 次恢复演练中成功几次
- **恢复时间**：从开始恢复到数据完整可用的时间是否符合 RTO
- **数据一致性**：恢复出来的数据在关键维度上与源数据的偏差量

**不可变备份**：

对于勒索软件防护，不可变备份是必要手段：

```yaml
# AWS S3 对象锁 — 防止备份被删除或修改
aws s3api put-object-lock-configuration \
  --bucket production-backup \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "GOVERNANCE",
        "Days": 30
      }
    }
  }'
```

**Follow-up Questions**:
- Q: Kubernetes 上的有状态应用（StatefulSet + PVC）的备份策略和传统虚拟机备份有什么不同？VolumeSnapshot 和 Velero 的工作机制是什么？
- Q: 什么是"备份的备份"？主备份和辅助备份的备份间隔应该错开吗？为什么？
- Q: 灾难恢复后，如何将增量数据（灾备期间产生的新数据）合并回主集群？数据回迁的策略和风险有哪些？

---

## Difficulty Levels

| Level | Icon | Experience |
|-------|------|------------|
| Junior | ⚫⚪⚪ Beginner | 1-3 years |
| Intermediate | ⚫⚫⚪ Intermediate | 3-5 years |
| Senior | ⚫⚫⚫ Advanced | 5+ years |
