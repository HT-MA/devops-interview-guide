---
id: service
title: Service
description: Kubernetes Service 与服务发现
---

# Service

## 面试官想考什么

* Service 类型
* 工作原理
* 服务发现机制
* 负载均衡

## 标准答案

### Service 类型

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| ClusterIP | 集群内部 IP | 默认，内部访问 |
| NodePort | 节点端口 | 开发、测试 |
| LoadBalancer | 云厂商 LB | 生产环境 |
| ExternalName | CNAME 映射 | 外部服务别名 |
| Headless | 无头服务 | StatefulSet |

### ClusterIP

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
  - port: 80           # Service 端口
    targetPort: 8080  # 容器端口
    protocol: TCP
```

### NodePort

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  type: NodePort
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 30080   # 节点端口 (30000-32767)
```

### LoadBalancer

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
  # 云厂商自动创建 LB
```

### Headless Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  type: ClusterIP
  clusterIP: None      # 关键：设置为 None
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

## 工作原理

### kube-proxy

```
┌─────────────────────────────────────────┐
│                 Service                  │
│           10.96.0.100:80                │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│              kube-proxy                  │
│         (iptables/ipvs)                │
│                                         │
│  10.96.0.100:80 → Pod1:8080 (33%)      │
│                 → Pod2:8080 (33%)      │
│                 → Pod3:8080 (33%)      │
└─────────────────────────────────────────┘
```

### Endpoints

```bash
# Service 自动维护 Endpoints
kubectl get endpoints myapp-svc

# 输出:
# NAME        ENDPOINTS                        AGE
# myapp-svc   10.244.1.15:8080,10.244.2.20:8080   10d
```

## 服务发现

### DNS

```bash
# 集群内部 DNS
# <service-name>.<namespace>.svc.<cluster-domain>

# 同命名空间
curl http://myapp

# 不同命名空间
curl http://myapp.other-namespace

# 集群级别
curl http://myapp.other-namespace.svc.cluster.local
```

### 环境变量

```bash
# Pod 启动时自动注入
MYAPP_SVC_SERVICE_HOST=10.96.0.100
MYAPP_SVC_SERVICE_PORT=80
```

### 对比

| 方式 | 优点 | 缺点 |
|------|------|------|
| DNS | 支持跨命名空间，灵活 | 需要 DNS 解析 |
| 环境变量 | 简单 | 不能跨命名空间，启动后固定 |

## 会话亲和性

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  sessionAffinity: ClientIP   # 基于客户端 IP
  # sessionAffinity: None    # 默认无亲和
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800
```

## 常见问题

### 无法访问 Service

```bash
# 1. 检查 Service 是否存在
kubectl get svc myapp

# 2. 检查 Endpoints
kubectl get endpoints myapp

# 3. 检查 Pod 是否匹配
kubectl get pods -l app=myapp

# 4. 检查端口配置
kubectl describe svc myapp

# 5. 测试连通性
kubectl run test --rm -it --image=busybox -- wget -qO- http://myapp:80
```

### DNS 解析问题

```bash
# 检查 CoreDNS 是否运行
kubectl get pods -n kube-system -l k8s-app=kube-dns

# 测试 DNS
kubectl run dnsutils --rm -it --image=tutum/dnsutils -- bash
nslookup kubernetes.default
nslookup myapp.default.svc.cluster.local
```

## 实战经验

### 多端口 Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  selector:
    app: myapp
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: admin
    port: 443
    targetPort: 8443
  - name: metrics
    port: 9090
    targetPort: 9090
```

### 外部服务

```yaml
# 通过 Service 访问外部数据库
apiVersion: v1
kind: Service
metadata:
  name: external-db
spec:
  type: ExternalName
  externalName: db.example.com
---
# 或手动定义 Endpoints
apiVersion: v1
kind: Endpoints
metadata:
  name: external-db
subsets:
- addresses:
  - ip: 192.168.1.100
  ports:
  - port: 5432
```

## 延伸问题

* kube-proxy 的工作模式？
* Service 如何实现负载均衡？
* Ingress 和 Service 的区别？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
