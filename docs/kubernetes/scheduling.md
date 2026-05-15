---
id: scheduling
title: 调度器
description: Kubernetes 调度机制
---

# Kubernetes 调度器

## 面试官想考什么

* 调度流程
* 调度策略
* 亲和性/反亲和性
* 污点和容忍

## 标准答案

### 调度流程

```
┌──────────────────────────────────────────────────────────────┐
│                        调度流程                               │
│                                                              │
│  Pod 创建 ──▶ Filter(预选) ──▶ Score(优选) ──▶ Bind(绑定)  │
│                                                              │
│  预选: 筛选符合条件的节点                                     │
│  优选: 对节点打分排序                                         │
│  绑定: 将 Pod 绑定到最优节点                                   │
└──────────────────────────────────────────────────────────────┘
```

### 预选策略 (Predicates)

| 策略 | 说明 |
|------|------|
| PodFitsResources | 节点资源是否满足 |
| PodFitsHostPorts | 端口是否冲突 |
| HostName | 节点名称匹配 |
| MatchNodeSelector | 节点标签匹配 |
| NoVolumeZoneConflict | 可用区限制 |
| MaxEBSVolumeCount | EBS 卷数量限制 |
| MaxGCEPDVolumeCount | PD 卷数量限制 |
| MaxAzureDiskVolumeCount | Azure Disk 数量限制 |

### 优选策略 (Priorities)

| 策略 | 说明 |
|------|------|
| LeastRequestedPriority | 优先分配到资源少的节点 |
| BalancedResourceAllocation | 平衡 CPU 和内存 |
| ImageLocalityPriority | 优先使用本地镜像 |
| TaintTolerationPriority | 优先调度到无污点节点 |
| SelectorSpreadPriority | 分散同一服务的 Pod |
| NodeAffinityPriority | 节点亲和性 |

## 资源请求与限制

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp:v1
    resources:
      requests:
        memory: "128Mi"
        cpu: "250m"
      limits:
        memory: "256Mi"
        cpu: "500m"
```

### QoS 等级

| 等级 | 条件 | 内存压缩 |
|------|------|----------|
| Guaranteed | requests == limits | 最后被杀 |
| Burstable | requests < limits | 中间被杀 |
| BestEffort | 无 requests/limits | 最先被杀 |

## 节点亲和性

```yaml
spec:
  affinity:
    nodeAffinity:
      # 必须满足
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values:
            - zone-a
      # 倾向满足
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 1
        preference:
          matchExpressions:
          - key: disktype
            operator: In
            values:
            - ssd
```

## Pod 亲和性/反亲和性

```yaml
spec:
  affinity:
    # Pod 反亲和性 - 分散部署
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
          - key: app
            operator: In
            values:
            - myapp
        topologyKey: kubernetes.io/hostname
    # Pod 亲和性 - 靠近部署
    podAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: app
              operator: In
              values:
              - cache
          topologyKey: topology.kubernetes.io/zone
```

## 污点和容忍

### 污点 (Taint)

```bash
# 添加污点
kubectl taint nodes node1 dedicated=nginx:NoSchedule

# 污点效果
# NoSchedule - 不调度
# PreferNoSchedule - 尽量不调度
# NoExecute - 不调度 + 驱逐已有 Pod

# 移除污点
kubectl taint nodes node1 dedicated-
```

### 容忍 (Toleration)

```yaml
spec:
  tolerations:
  # 匹配所有污点
  - operator: Exists
  
  # 匹配特定污点
  - key: dedicated
    operator: Equal
    value: nginx
    effect: NoSchedule
  
  # 匹配任意效果
  - key: dedicated
    operator: Equal
    value: nginx
    effect: NoExecute
    tolerationSeconds: 3600  # 容忍 1 小时
```

### 常见场景

```bash
# 专用节点
kubectl taint nodes node1 dedicated=apps:NoSchedule

# 监控组件容忍所有污点
tolerations:
- operator: Exists

# 有污点节点不调度
kubectl taint nodes node1 node.kubernetes.io/not-ready:NoExecute
```

## 调度器配置

### 自定义调度器

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  schedulerName: my-scheduler
  containers:
  - name: myapp
    image: myapp:v1
```

### 调度器配置

```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- pluginConfig:
  - name: DefaultPreemption
    args:
      minCandidateNodesAbsolute: 100
      minCandidateNodesPercentage: 10
```

## 常见问题

### Pod 一直 Pending

```bash
# 查看原因
kubectl describe pod myapp

# 常见原因
# - 资源不足
# - 亲和性不满足
# - 没有匹配的污点容忍
# - 存储卷无法挂载
```

### 调度太慢

```bash
# 启用调度器性能分析
kubectl get --raw="/apis/metrics.k8s.io/v1beta1/namespaces/kube-system/pods?labelSelector=app%3Dkube-scheduler"
```

## 延伸问题

* 调度器如何实现抢占？
* 什么是调度框架(Scheduling Framework)？
* 如何实现自定义调度策略？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
