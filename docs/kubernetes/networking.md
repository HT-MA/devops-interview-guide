---
id: networking
title: Kubernetes 网络
description: K8s 网络模型与原理
---

# Kubernetes 网络

## 面试官想考什么

* 网络模型
* CNI 插件
* DNS 工作原理
* 网络策略

## 标准答案

### 网络模型原则

1. Pod 之间无需 NAT 可以直接通信
2. Node 与 Pod 之间无需 NAT 可以直接通信
3. Pod 看到的 IP 与其他 Pod 看到的相同

### 网络分层

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                          │
│                                                                 │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                   │
│  │  Pod A  │────▶│  Pod B  │────▶│  Pod C  │                   │
│  │10.244.1.2│     │10.244.1.3│     │10.244.2.2│                  │
│  └────┬────┘     └────┬────┘     └────┬────┘                   │
│       │               │               │                        │
│  ┌────▼────┐     ┌────▼────┐     ┌────▼────┐                   │
│  │ eth0    │     │ eth0    │     │ eth0    │                   │
│  │cbr0/veth│     │cbr0/veth│     │cbr0/veth│                   │
│  └────┬────┘     └────┬────┘     └────┬────┘                   │
│       │               │               │                        │
│  ┌────▼───────────────▼───────────────▼────┐                   │
│  │              Node Network              │                   │
│  │           eth0 / 192.168.1.x            │                   │
│  └─────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## CNI 插件

### 常见 CNI

| 插件 | 特点 | 适用场景 |
|------|------|----------|
| Flannel | 简单 VXLAN | 测试/小规模 |
| Calico | 性能+网络策略 | 生产环境 |
| Cilium | eBPF+安全 | 大规模/安全 |
| Weave | 自动加密 | 混合云 |

### Flannel

```bash
# VXLAN 模式
kubectl get configmap -n kube-system flannel-config -o yaml

# 网络: 10.244.0.0/16
# 每个节点: 10.244.x.0/24
```

### Calico

```yaml
# NetworkPolicy 示例
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          role: frontend
    ports:
    - protocol: TCP
      port: 8080
```

## DNS

### DNS 架构

```
┌─────────────────────────────────────────┐
│              CoreDNS                     │
│  ┌─────────────────────────────────┐   │
│  │  kubernetes svc: 10.96.0.1      │   │
│  │  CoreDNS Pod: 10.244.1.10       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         ▲
         │ kubelet 配置
         │
┌─────────────────────────────────────────┐
│              Pod                         │
│  /etc/resolv.conf:                      │
│    nameserver 10.96.0.10                │
│    search namespace.svc.cluster.local   │
│    search svc.cluster.local             │
│    search cluster.local                 │
└─────────────────────────────────────────┘
```

### DNS 解析规则

```bash
# 完整域名
<service>.<namespace>.svc.<cluster-domain>
# 例如: myapp.default.svc.cluster.local

# 省略写法
myapp           # 同 namespace
myapp.default   # 不同 namespace
```

### 查看 Pod DNS

```bash
kubectl exec myapp -- cat /etc/resolv.conf
# nameserver 10.96.0.10
# search default.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5
```

## 网络策略

### 隔离策略

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}  # 匹配所有 Pod
  policyTypes:
  - Ingress
  - Egress
```

### 允许特定流量

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
spec:
  podSelector:
    matchLabels:
      app: backend
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
```

## 常见问题

### Pod 无法访问外网

```bash
# 1. 检查 CNI 是否正常
kubectl get pods -n kube-system -l k8s-app=*cni*

# 2. 检查 iptables
kubectl exec myapp -- iptables -L -n

# 3. 测试 DNS
kubectl exec myapp -- nslookup google.com

# 4. 检查网络策略
kubectl get networkpolicies --all-namespaces
```

### Service 无法访问

```bash
# 1. 检查 Endpoints
kubectl get endpoints myapp

# 2. 检查 selector
kubectl describe svc myapp | grep Selector

# 3. 检查 Pod labels
kubectl get pods -l app=myapp --show-labels
```

### 网络延迟高

```bash
# 检查 CNI 模式
# Flannel host-gw vs VXLAN
# Calico eBPF vs iptables

# 使用 Cilium eBPF 优化
```

## 延伸问题

* eBPF 在网络中的应用？
* Service Mesh 和 CNI 的关系？
* 如何排查网络策略不生效？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
