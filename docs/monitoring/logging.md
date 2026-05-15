---
id: logging
title: 日志收集
description: ELK/Loki 日志方案
---

# 日志收集

## 标准答案

### ELK 架构

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│  App    │  │  App    │  │   K8s   │  │  Nginx  │
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
     │            │            │            │
     └────────────┴────────────┴────────────┘
                     │
              ┌──────▼──────┐
              │   Fluentd   │
              │   /Fluent  │
              │    Bit     │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ Elasticsearch│
              │   (存储)     │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │   Kibana    │
              │  (可视化)   │
              └─────────────┘
```

### Loki 配置

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

schema_config:
  configs:
  - from: 2024-01-01
    store: boltdb-shipper
    object_store: filesystem
    schema: v11
    index:
      prefix: index_
      period: 24h

storage_config:
  boltdb:
    directory: /loki/index
  filesystem:
    directory: /loki/chunks

limits_config:
  reject_old_samples: true
  accept_old_samples: true
```

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
