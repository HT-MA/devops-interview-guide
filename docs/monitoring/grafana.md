---
id: grafana
title: Grafana
description: Grafana 可视化配置
---

# Grafana

## 标准答案

### 数据源配置

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
data:
  prometheus.yaml: |
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus:9090
      isDefault: true
      access: proxy
```

### Dashboard 示例

```json
{
  "dashboard": {
    "title": "Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)"
          }
        ]
      }
    ]
  }
}
```

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
