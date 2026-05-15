---
id: alerting
title: 告警管理
description: 告警配置与告警风暴处理
---

# 告警管理

## 标准答案

### Alertmanager 配置

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
  - match:
      severity: critical
    receiver: 'critical'
    group_wait: 10s

receivers:
- name: 'default'
  email_configs:
  - to: 'team@example.com'
- name: 'critical'
  slack_configs:
  - api_url: 'https://hooks.slack.com/...'
    channel: '#alerts-critical'
```

### 告警规则

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: myapp-alerts
spec:
  groups:
  - name: myapp
    rules:
    - alert: HighErrorRate
      expr: |
        sum(rate(http_requests_total{status=~"5.."}[5m])) 
        / sum(rate(http_requests_total[5m])) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value | printf \"%.2f\" }}%"
```

## 告警风暴处理

| 策略 | 说明 |
|------|------|
| 抑制 | 高优先级告警抑制低优先级 |
| 去重 | 相同告警合并 |
| 分组 | 按服务/严重程度分组 |
| 静默 | 维护期间静默 |

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
