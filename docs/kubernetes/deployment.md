---
id: deployment
title: Deployment
description: Kubernetes Deployment 管理
---

# Deployment

## 面试官想考什么

* Deployment vs ReplicaSet
* 滚动更新策略
* 回滚机制
* 扩缩容

## 标准答案

### 工作原理

```
┌─────────────────────────────────────────────┐
│               Deployment                     │
│                                             │
│  ├── ReplicaSet (v1)  ←── 3 Pods           │
│  ├── ReplicaSet (v2)  ←── 3 Pods           │
│  └── ReplicaSet (v3)  ←── 3 Pods (当前)    │
│                                             │
└─────────────────────────────────────────────┘
```

### 基本使用

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 最多超出期望副本数
      maxUnavailable: 0   # 最少可用副本数
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:v1
        ports:
        - containerPort: 8080
```

### 常用命令

```bash
# 创建
kubectl apply -f deployment.yaml

# 查看
kubectl get deployment
kubectl get rs
kubectl get pods -l app=myapp

# 扩缩容
kubectl scale deployment myapp --replicas=5
kubectl autoscale deployment myapp --min=3 --max=10 --cpu-percent=80

# 更新
kubectl set image deployment/myapp myapp=myapp:v2

# 回滚
kubectl rollout history deployment/myapp
kubectl rollout undo deployment/myapp
kubectl rollout undo deployment/myapp --to-revision=2

# 暂停/恢复
kubectl rollout pause deployment/myapp
kubectl rollout resume deployment/myapp

# 查看状态
kubectl rollout status deployment/myapp
```

## 滚动更新

### 策略配置

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 默认 25%
      maxUnavailable: 0  # 默认 25%
```

### 更新过程

```
初始状态: v1 [P1][P2][P3]     3个 v1 Pod

Step 1: v1 [P1][P2] + v2 [P4]  新建 1 个 v2
Step 2: v1 [P1] + v2 [P3][P4]  再新建 1 个 v2
Step 3: v2 [P2][P3][P4]       停止 1 个 v1
Step 4: v2 [P1][P2][P3][P4]   再停止 1 个 v1
Step 5: v2 [P1][P2][P3]       最后一个 v2 就绪
```

### maxSurge vs maxUnavailable

| 配置 | 效果 |
|------|------|
| maxSurge=1, maxUnavailable=0 | 滚动过程有 4 个 Pod (最大 4) |
| maxSurge=0, maxUnavailable=1 | 滚动过程有 2 个 Pod (最小 2) |
| maxSurge=1, maxUnavailable=1 | 最多 4 个，最少 2 个 |

## 回滚

```bash
# 查看历史
kubectl rollout history deployment myapp
# 输出:
# deployment.apps/myapp 
# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         kubectl set image deployment/myapp myapp=myapp:v2

# 回滚到上一版本
kubectl rollout undo deployment myapp

# 回滚到指定版本
kubectl rollout undo deployment myapp --to-revision=1

# 查看回滚状态
kubectl rollout status deployment myapp
```

## 扩缩容

### 手动扩缩容

```bash
kubectl scale deployment myapp --replicas=10
```

### HPA 自动扩缩容

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### VPA (Vertical Pod Autoscaler)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: "Auto"
```

## 常见问题

### 更新失败

```bash
# 查看原因
kubectl describe deployment myapp

# 常见原因
# - 镜像拉取失败
# - 探针检查失败
# - 资源不足
# - 配置错误
```

### 状态异常

```bash
# 查看 Deployment 状态
kubectl get deployment myapp -o yaml

# 查看 Events
kubectl get events --field-selector involvedObject.name=myapp
```

## 延伸问题

* 什么是 Blue-Green 部署？
* 如何实现金丝雀发布？
* Deployment 和 StatefulSet 的区别？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
