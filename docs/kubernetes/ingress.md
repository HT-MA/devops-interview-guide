---
id: ingress
title: Ingress
description: Kubernetes Ingress 配置与原理
---

# Ingress

## 面试官想考什么

* Ingress 架构
* 路由规则
* TLS 配置
* 控制器

## 标准答案

### 架构

```
                        ┌─────────────────────────────────────────┐
                        │                   Ingress                │
                        │    apiVersion: networking.k8s.io/v1      │
                        │    kind: Ingress                          │
                        └──────────────────┬────────────────────────┘
                                           │
                        ┌──────────────────▼────────────────────────┐
                        │           Ingress Controller               │
                        │  (Nginx/Contour/Traefik/云厂商)            │
                        └──────────────────┬────────────────────────┘
                                           │
┌───────────────────────────────────────────────────────────────────────┐
│                           Kubernetes Cluster                          │
│                                                                       │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐                      │
│    │ Service A │    │ Service B │    │ Service C │                      │
│    │ 10.96.1.1 │    │ 10.96.1.2 │    │ 10.96.1.3 │                      │
│    └──────────┘    └──────────┘    └──────────┘                      │
└───────────────────────────────────────────────────────────────────────┘
```

## 基本使用

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-service
            port:
              number: 80
```

## 路由规则

### 基于路径路由

```yaml
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /users
        pathType: Prefix
        backend:
          service:
            name: users-service
            port:
              number: 80
      - path: /orders
        pathType: Prefix
        backend:
          service:
            name: orders-service
            port:
              number: 80
```

### 基于主机路由

```yaml
spec:
  rules:
  - host: frontend.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
  - host: backend.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 8080
```

### 默认后端

```yaml
spec:
  defaultBackend:
    service:
      name: default-service
      port:
        number: 80
```

## TLS 配置

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress-tls
spec:
  tls:
  - hosts:
    - myapp.example.com
    - www.example.com
    secretName: myapp-tls
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-service
            port:
              number: 80
---
apiVersion: v1
kind: Secret
metadata:
  name: myapp-tls
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-cert>
  tls.key: <base64-encoded-key>
```

### 自动 HTTPS

```yaml
annotations:
  # Let's Encrypt
  cert-manager.io/cluster-issuer: letsencrypt-prod
  # 或
  nginx.ingress.kubernetes.io/ssl-redirect: "true"
```

## 常用注解

### Nginx Ingress

```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-body-size: "50m"
  nginx.ingress.kubernetes.io/proxy-connect-timeout: "30"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
  nginx.ingress.kubernetes.io/websocket-services: "ws-service"
  nginx.ingress.kubernetes.io/use-regex: "true"
  nginx.ingress.kubernetes.io/limit-rps: "100"
  nginx.ingress.kubernetes.io/limit-connections: "50"
```

### 重写规则

```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api/v2(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: backend-service
            port:
              number: 80
```

## 常见问题

### Ingress 不生效

```bash
# 1. 检查 Ingress 资源
kubectl get ingress

# 2. 检查 Controller 是否运行
kubectl get pods -n ingress-nginx

# 3. 检查配置
kubectl describe ingress myapp-ingress

# 4. 查看 Controller 日志
kubectl logs -n ingress-nginx -l app=ingress-nginx

# 5. 检查 Class 配置
kubectl get ingressclass
```

### 404 问题

```bash
# 通常是路径匹配问题
# 检查 pathType
# 检查 backend service 名称

# 使用通配符路径
annotations:
  nginx.ingress.kubernetes.io/use-regex: "true"
paths:
- path: /.*
  pathType: ImplementationSpecific
```

## 实战经验

### 蓝绿发布

```yaml
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-v1
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "0"
spec:
  rules:
  - host: myapp.example.com
    http:
      paths:
      - backend:
          service:
            name: myapp-v1
            port:
              number: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-v2
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "100"
spec:
  rules:
  - host: myapp.example.com
    http:
      paths:
      - backend:
          service:
            name: myapp-v2
            port:
              number: 80
```

### 金丝雀发布

```yaml
annotations:
  nginx.ingress.kubernetes.io/canary: "true"
  nginx.ingress.kubernetes.io/canary-weight: "10"        # 10% 流量
  # 或按 Header
  # nginx.ingress.kubernetes.io/canary-by-header: "X-Canary"
  # nginx.ingress.kubernetes.io/canary-by-header-value: "always"
```

## 延伸问题

* Ingress Controller 和 Ingress 的区别？
* 什么是 Gateway API？
* 如何实现灰度发布？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
