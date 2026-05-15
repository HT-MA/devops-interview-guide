---
id: observability
title: 可观测性
description: 监控、日志、链路追踪
---

# 可观测性

## 面试官想考什么

* 可观测性三支柱
* 实现方案
* OpenTelemetry

## 标准答案

### 三支柱

```
┌────────────────────────────────────────────────────────────────┐
│                       可观测性                                   │
│                                                                │
│   ┌─────────┐      ┌─────────┐      ┌─────────┐              │
│   │  Metrics │      │  Logs   │      │ Traces  │              │
│   │ (指标)   │      │ (日志)  │      │ (追踪)  │              │
│   └─────────┘      └─────────┘      └─────────┘              │
│        │                │                │                     │
│        └────────────────┴────────────────┘                     │
│                         │                                     │
│                  ┌──────▼──────┐                              │
│                  │  Correlation │                              │
│                  │   (关联分析) │                              │
│                  └─────────────┘                              │
└────────────────────────────────────────────────────────────────┘
```

### OpenTelemetry

```yaml
# Collector 配置
receivers:
  otlp:
    protocols:
      grpc:
      http:

processors:
  batch:

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
  jaeger:
    endpoint: jaeger:14250

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
```

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
