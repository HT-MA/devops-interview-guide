---
id: troubleshooting
title: 故障排查
description: Kubernetes 故障排查方法
---

# Kubernetes 故障排查

## 面试官想考什么

* Pod 故障排查
* 网络故障排查
* 存储故障排查
* 常见问题处理

## 排查命令

### Pod 问题

```bash
# 查看 Pod 状态
kubectl get pod -o wide

# 查看详细信息
kubectl describe pod myapp

# 查看日志
kubectl logs myapp
kubectl logs myapp --previous        # 上一个容器
kubectl logs myapp -c container-name # 特定容器

# 进入容器
kubectl exec -it myapp -- sh

# 资源使用
kubectl top pod
```

### 集群问题

```bash
# 查看所有 Pod (所有 namespace)
kubectl get pod -A

# 查看 Node 状态
kubectl get nodes
kubectl describe node node1

# 查看 Events
kubectl get events --sort-by='.lastTimestamp'

# 查看 API Server 日志
kubectl logs -n kube-system -l app=kube-apiserver
```

### 网络问题

```bash
# 测试连通性
kubectl run test --rm -it --image=busybox -- wget -qO- http://myapp:80

# DNS 调试
kubectl run dnsutils --rm -it --image=tutum/dnsutils -- nslookup kubernetes.default

# 查看 Endpoints
kubectl get endpoints myapp

# 查看 Service
kubectl get svc myapp
kubectl describe svc myapp
```

## Pod 常见问题

### CrashLoopBackOff

```bash
# 查看日志
kubectl logs myapp --previous

# 查看退出码
kubectl describe pod myapp | grep -A 10 "Exit Code"

# 常见原因
# - 应用启动失败
# - 健康检查失败
# - 依赖服务不可达
# - OOMKilled
```

### ImagePullBackOff

```bash
# 查看镜像
kubectl describe pod myapp | grep -A 5 "Containers"

# 常见原因
# - 镜像名称错误
# - 镜像拉取失败
# - 认证信息错误
# - 仓库不存在
```

### Pending

```bash
# 查看原因
kubectl describe pod myapp | grep -A 5 "Events"

# 常见原因
# - 资源不足 (CPU/内存)
# - 节点选择器不匹配
# - 存储卷无法挂载
# - 污点不容忍
```

### Terminating

```bash
# 强制删除 (谨慎使用)
kubectl delete pod myapp --grace-period=0 --force

# 检查 Finalizers
kubectl get pod myapp -o yaml | grep finalizers

# 检查挂载
kubectl describe pod myapp | grep -A 10 "Mounts"
```

## 网络常见问题

### Service 无法访问

```bash
# 1. 检查 Endpoints
kubectl get endpoints myapp-svc

# 2. 检查 Pod 是否匹配
kubectl get pods -l app=myapp --show-labels

# 3. 检查端口配置
kubectl describe svc myapp-svc

# 4. 测试连通性
kubectl run curl --rm -it --image=curlimages/curl -- curl myapp-svc
```

### DNS 解析失败

```bash
# 检查 CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns

# 测试 DNS
kubectl run dnsutils --rm -it --image=tutum/dnsutils -- bash
nslookup kubernetes.default
nslookup myapp.default.svc.cluster.local

# 查看 resolv.conf
kubectl exec myapp -- cat /etc/resolv.conf
```

### Ingress 不工作

```bash
# 检查 Ingress Controller
kubectl get pods -n ingress-nginx

# 检查 Ingress 资源
kubectl get ingress
kubectl describe ingress myapp

# 查看 Controller 日志
kubectl logs -n ingress-nginx -l app=ingress-nginx

# 测试域名解析
nslookup myapp.example.com
```

## 存储常见问题

### PVC Pending

```bash
# 查看原因
kubectl describe pvc mypvc

# 常见原因
# - StorageClass 不存在
# - 云厂商存储不足
# - 节点无匹配标签
```

### 挂载失败

```bash
# 查看挂载
kubectl describe pod myapp | grep -A 10 "Volumes"

# 检查 PV
kubectl get pv
kubectl describe pv mypv

# 检查 StorageClass
kubectl get storageclass
```

## 故障排查流程

### 第一阶段：收集信息

```bash
# 1. Pod 状态
kubectl get pod -o wide
kubectl describe pod myapp

# 2. 事件日志
kubectl get events --sort-by='.lastTimestamp'

# 3. 应用日志
kubectl logs myapp --tail=100
```

### 第二阶段：分析问题

| 状态 | 可能原因 |
|------|----------|
| Pending | 资源不足/调度失败 |
| ContainerCreating | 镜像拉取/存储挂载 |
| CrashLoopBackOff | 应用错误/健康检查 |
| Running 但不可用 | 探针失败/网络问题 |
| Terminating | Finalizer/挂载问题 |

### 第三阶段：定位根因

```bash
# 资源问题
kubectl top nodes
kubectl describe node | grep -A 5 "Allocated"

# 权限问题
kubectl auth can-i get pods
kubectl describe pod myapp | grep -A 5 "Security Context"

# 依赖问题
kubectl logs myapp | grep error
```

## 实用调试工具

```bash
# kubectl-debug (需要安装)
kubectl debug myapp -it --image=busybox

# k9s 交互式工具
# https://k9scli.io/

# kubesphere
# https://kubesphere.io/
```

## 延伸问题

* 如何排查 Node NotReady？
* 如何处理 OOMKilled？
* 如何分析调度延迟？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
