---
id: docker-network
title: Docker 网络
description: Docker 网络模式与配置
---

# Docker 网络

## 面试官想考什么

* 网络模式类型
* 网络原理
* 跨容器通信
* 端口映射

## 标准答案

### 网络模式

| 模式 | 说明 | 容器间通信 | 外部访问 |
|------|------|------------|----------|
| bridge | 默认模式 | ✓ (同一网络) | 需要映射 |
| host | 共享宿主机网络 | ✗ | 直接访问 |
| overlay | Docker Swarm 跨主机 | ✓ | 需要映射 |
| macvlan | 给容器分配 MAC | ✓ | 直接访问 |
| none | 无网络 | ✗ | ✗ |

### 默认 bridge 网络

```
┌────────────────────────────────────┐
│           docker0 (bridge)         │
│           172.17.0.1/16            │
└──────────┬───────────────┬─────────┘
           │               │
    ┌──────┴──────┐  ┌─────┴──────┐
    │ container1  │  │ container2 │
    │ 172.17.0.2  │  │ 172.17.0.3 │
    └─────────────┘  └────────────┘
```

## 常见命令

### 网络管理

```bash
# 查看网络
docker network ls

# 创建网络
docker network create --driver bridge mynet

# 删除网络
docker network rm mynet
docker network prune  # 清理未使用网络

# 连接容器
docker network connect mynet container1

# 断开容器
docker network disconnect mynet container1

# 查看网络详情
docker network inspect bridge
```

### 容器网络操作

```bash
# 端口映射
docker run -d -p 8080:80 nginx

# 随机端口映射
docker run -d -P nginx

# 特定 IP 映射
docker run -d -p 127.0.0.1:8080:80 nginx

# UDP 端口
docker run -d -p 53:53/udp dns

# 查看端口映射
docker port nginx
```

## 用户定义网络

### bridge 网络

```bash
# 创建自定义 bridge
docker network create --driver bridge mybridge

# 配置 DNS
docker network create \
  --driver bridge \
  --subnet=172.20.0.0/16 \
  --gateway=172.20.0.1 \
  mybridge

# 容器使用
docker run --network mybridge --name app app:latest
docker run --network mybridge --name db db:latest
# app 可以通过 db 主机名解析到 db 容器 IP
```

### host 网络

```bash
# 使用 host 模式
docker run --network host nginx
# 容器直接使用宿主机网络
# nginx 直接监听 80 端口

# 适用场景
# - 高性能网络应用
# - 需要绑定特定端口
# - 网络插件不支持时
```

### overlay 网络

```bash
# Swarm 模式创建
docker network create --driver overlay myoverlay

# 使用
docker service create --network myoverlay myapp

# 跨主机通信
# 通过 VxLAN 隧道
```

## 容器间通信

### DNS 解析

```bash
# 自定义网络支持自动 DNS
docker network create mynet

docker run --network mynet --name db -d redis
docker run --network mynet --name app -d myapp

# app 容器内可以 ping db
# DNS 自动解析到 172.x.x.x
```

### Link (已废弃)

```bash
# 旧版方式，不推荐
docker run --link db:database --name app -d myapp
# app 容器内可以 ping database
```

## 网络原理

### Namespace 隔离

```bash
# 容器网络命名空间
ip netns list
ls /var/run/docker/netns/

# 进入容器网络命名空间
nsenter -t <PID> -n ip addr
```

### 端口映射原理

```bash
# iptables NAT 规则
iptables -t nat -L -n

# DNAT (目的地址转换)
# 从外部访问 8080 -> 转发到容器 80
# PREROUTING -> DOCKER -> POSTROUTING
```

## 常见问题

### 无法访问外网

```bash
# 检查网络模式
docker inspect -f '{{.NetworkSettings.NetworkID}}' container

# 检查 DNS
docker run --rm busybox nslookup google.com

# 检查 iptables
iptables -L -n -t nat | grep DOCKER
```

### 网络性能问题

```bash
# 使用 host 模式提升性能
docker run --network host myapp

# 检查网络统计
docker stats

# 常见瓶颈
# - 端口映射额外转发
# - 网络带宽限制
# - DNS 解析延迟
```

## 实战经验

### Nginx 反向代理

```bash
# 创建网络
docker network create mynet

# 启动后端服务
docker run -d --network mynet --name api api:latest
docker run -d --network mynet --name web web:latest

# 启动 Nginx
docker run -d \
  --network mynet \
  -p 80:80 \
  --name nginx \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf \
  nginx:alpine
```

### Docker Compose 网络

```yaml
version: "3.8"
services:
  web:
    build: .
    networks:
      - frontend
  db:
    image: postgres
    networks:
      - backend

networks:
  frontend:
  backend:
```

## 延伸问题

* macvlan 和 bridge 的区别？
* 如何限制容器网络带宽？
* Docker 网络和 K8s网络的区别？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
