---
id: prometheus
title: Prometheus
description: Prometheus 监控体系
---

# Prometheus

## 面试官想考什么

* 架构原理
* 数据模型
* 查询语言 PromQL
* 服务发现

## 标准答案

### 架构

```
┌────────────────────────────────────────────────────────────────┐
│                      Prometheus Server                           │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────────┐  │
│  │ Retrieval  │  │  TSDB     │  │      HTTP Server        │  │
│  │ (拉取数据)  │  │ (存储)     │  │      (查询接口)         │  │
│  └────────────┘  └────────────┘  └─────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
       ▲              │
       │              ▼
┌──────┴──────────────────────────────────────────────────────────┐
│                      Targets                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │  Node   │  │   App   │  │  K8s    │  │  Alert  │          │
│  │Exporter │  │metrics  │  │  API    │  │Manager  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
└────────────────────────────────────────────────────────────────┘
```

### 数据模型

```promql
# 指标格式: <metric_name>{<label_name>=<label_value>}
# 示例
api_request_duration_seconds{path="/api/users", method="GET", status="200"}
```

### 指标类型

| 类型 | 说明 |
|------|------|
| Counter | 只增不减计数器 |
| Gauge | 可增可减仪表盘 |
| Histogram | 直方图/延迟分布 |
| Summary | 分位数统计 |

### PromQL 示例

```promql
# 瞬时向量
http_requests_total{status="200"}

# 范围向量 (5分钟)
http_requests_total[5m]

# 聚合
sum(rate(http_requests_total[5m])) by (service)

# 计算
rate(container_cpu_usage_seconds_total[5m])
```

## ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: metrics
    interval: 15s
    path: /metrics
  namespaceSelector:
    matchNames:
    - production
```

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
