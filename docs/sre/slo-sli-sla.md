---
id: slo-sli-sla
title: SLO/SLI/SLA
description: 服务可靠性目标
---

# SLO / SLI / SLA

## 面试官想考什么

* 三者区别
* 如何制定
* 监控方法
* 错误预算

## 标准答案

### 定义

| 概念 | 说明 | 示例 |
|------|------|------|
| SLI | 服务水平指标 | 可用性 99.9% |
| SLO | 服务水平目标 | 月可用性 ≥ 99.9% |
| SLA | 服务水平协议 | 合同承诺 ≥ 99.5% |

### 关系

```
SLA (合同) ────────────── 99.5%
SLO (目标) ────────────── 99.9%
SLI (实际) ────────────── 99.95%
     │
     ▼
错误预算 = 1 - SLO = 0.1% / 月
```

### 常见 SLI

| 服务类型 | SLI |
|----------|-----|
| Web 服务 | 可用性、延迟 |
| 存储服务 | 可用性、延迟、持久性 |
| 大数据 | 吞吐量、延迟 |

### SLO 制定

```yaml
# Prometheus 监控 SLO
groups:
- name: slo
  rules:
  - record: slo:sli_error:ratio_rate5m
    expr: |
      sum(rate(http_requests_total{status!~"2.."}[5m]))
      / sum(rate(http_requests_total[5m]))
  
  - alert: SLOErrorBudgetAlert
    expr: |
      1 - (
        sum(slo:sli_error:ratio_rate30d)
        / sum(1)
      ) > 0.01  # 1% 错误预算消耗
    for: 5m
    labels:
      severity: warning
```

## 错误预算

```python
# 月错误预算计算
monthly_budget = (1 - SLO) * minutes_in_month
# 99.9% SLO = 0.001 * 43200 = 43.2 分钟
```

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
