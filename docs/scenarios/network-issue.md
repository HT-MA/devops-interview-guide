---
id: network-issue
title: 网络故障
description: 网络问题排查
---

# 场景：网络故障

## 背景

服务之间无法通信，连接超时。

## 排查流程

### 第一阶段：检查基础连通性

```bash
# 检查网络接口
ip link show
ip addr show

# 检查路由
ip route show

# 测试连通性
ping <target_ip>
```

### 第二阶段：检查端口和服务

```bash
# 检查端口
ss -tunapl | grep <PORT>

# 测试端口
nc -zv <target_ip> <PORT>

# 检查服务
curl -v http://<service>:<PORT>/health
```

### 第三阶段：DNS 排查

```bash
# 检查 DNS 解析
nslookup <hostname>
dig <hostname>

# 测试 DNS 解析
host <hostname>

# 检查 resolv.conf
cat /etc/resolv.conf
```

### Kubernetes 环境排查

```bash
# 检查 Service
kubectl get svc
kubectl describe svc <name>

# 检查 Endpoints
kubectl get endpoints <name>

# 检查 Pod 网络
kubectl exec -it <pod> -- sh
ping <other-pod-ip>
```

### 常见原因

| 原因 | 排查命令 | 解决方案 |
|------|----------|----------|
| 防火墙 | `iptables -L` | 开放端口 |
| 网络策略 | `kubectl get networkpolicy` | 调整策略 |
| DNS 故障 | `nslookup` | 检查 CoreDNS |
| 端口冲突 | `ss -tunapl` | 修改端口 |

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
