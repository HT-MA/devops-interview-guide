---
id: deployment-strategies
title: 部署策略
description: 蓝绿部署、金丝雀发布等
---

# 部署策略

## 标准答案

### 部署策略对比

| 策略 | 停机 | 风险 | 回滚速度 | 成本 |
|------|------|------|----------|------|
| 滚动更新 | 无 | 低 | 快 | 低 |
| 蓝绿部署 | 无 | 中 | 最快 | 高 |
| 金丝雀 | 无 | 低 | 慢 | 中 |
| A/B 测试 | 无 | 低 | 慢 | 中 |

### 滚动更新

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### 蓝绿部署

```bash
# 新版本部署到 blue 环境
kubectl apply -f blue/deployment.yaml

# 验证 blue 环境
kubectl rollout status deployment/myapp-blue

# 切换流量
kubectl patch service myapp -p '{"spec":{"selector":{"version":"blue"}}}'

# 保留 green 环境用于快速回滚
```

### 金丝雀发布

```yaml
# 10% 流量到新版本
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
  - port: 80
---
# v1: 90% 副本
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-v1
spec:
  replicas: 9
  selector:
    matchLabels:
      app: myapp
      version: v1
---
# v2: 10% 副本
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-v2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
      version: v2
```

### Ingress 金丝雀

```yaml
# 100% 流量到 v1
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "0"
---
# 10% 流量到 v2
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
```

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
