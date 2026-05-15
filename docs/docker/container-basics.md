---
id: container-basics
title: 容器基础
description: Docker 容器基础概念与操作
---

# Docker 容器基础

## 面试官想考什么

* 容器 vs 虚拟机
* 容器架构原理
* 镜像与容器关系
* 核心概念

## 标准答案

### 容器 vs 虚拟机

| 特性 | 容器 | 虚拟机 |
|------|------|--------|
| 启动速度 | 秒级 | 分钟级 |
| 资源占用 | 小 (MB) | 大 (GB) |
| 隔离性 | 进程级 | 完整系统 |
| 性能 | 接近原生 | 有损耗 |
| 移植性 | 强 | 一般 |
| 规模 | 数千个 | 数十个 |

### Docker 架构

```
┌─────────────────────────────────────────┐
│              Docker Client              │
└─────────────────┬───────────────────────┘
                  │ REST API
                  ▼
┌─────────────────────────────────────────┐
│              Docker Daemon              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Container│  │  Image  │  │ Network │ │
│  │ Manager  │  │ Manager │  │ Manager │ │
│  └────┬────┘  └────┬────┘  └─────────┘ │
│       │            │                    │
│       └──────┬─────┘                    │
│              ▼                          │
│     ┌──────────────┐                    │
│     │ containerd   │                    │
│     │   shim       │                    │
│     └──────┬───────┘                    │
└─────────────┼───────────────────────────┘
              │
              ▼
         containerd-shim-runc
              │
              ▼
         runc (创建容器)
              │
              ▼
         Linux Namespace + Cgroup
```

### 核心概念

| 概念 | 说明 |
|------|------|
| Image | 只读模板 |
| Container | 镜像的运行实例 |
| Registry | 镜像仓库 |
| Dockerfile | 镜像构建脚本 |

## 常见命令

### 镜像操作

```bash
# 拉取镜像
docker pull nginx:latest

# 查看镜像
docker images
docker image ls

# 删除镜像
docker rmi nginx:latest
docker image prune -a  # 清理未使用镜像

# 构建镜像
docker build -t myapp:1.0 .

# 导出/导入
docker save nginx:latest -o nginx.tar
docker load -i nginx.tar
```

### 容器操作

```bash
# 运行容器
docker run -d --name nginx nginx:latest
docker run -it ubuntu bash

# 参数说明
# -d: 后台运行
# -it: 交互式终端
# --name: 容器名称
# -p 8080:80: 端口映射
# -v /host:/container: 目录挂载
# --network: 网络模式

# 查看容器
docker ps -a              # 所有容器
docker ps                  # 运行中
docker logs nginx          # 查看日志
docker logs -f nginx       # 实时日志

# 容器管理
docker start nginx
docker stop nginx
docker restart nginx
docker pause nginx
docker unpause nginx

# 进入容器
docker exec -it nginx bash
docker attach nginx  # 附加到主进程(退出会导致容器停止)

# 删除容器
docker rm nginx
docker container prune  # 清理已停止容器
```

### 容器生命周期

```
Created → Starting → Running
                      ↓
              Paused ←→ Unpaused
                      ↓
                 Stopping → Stopped → Removed
```

## 常见问题

### 容器无法启动

```bash
# 查看容器状态
docker ps -a

# 查看详细日志
docker inspect nginx

# 常见原因
# 1. 端口占用
# 2. 挂载目录不存在
# 3. 镜像拉取失败
# 4. 命令执行失败
```

### 容器通信

```bash
# 创建网络
docker network create mynet

# 连接容器
docker run --network mynet --name app app:latest

# 查看网络
docker network ls
docker network inspect mynet
```

## 实战经验

1. **生产环境运行**
   ```bash
   docker run -d \
     --name app \
     --restart unless-stopped \
     --memory 512m \
     --cpus 0.5 \
     -p 8080:8080 \
     -v /data:/data \
     app:latest
   ```

2. **日志管理**
   ```bash
   # 限制日志大小
   docker run --log-opt max-size=10m --log-opt max-file=3 myapp

   # 清理日志
   truncate -s 0 /var/lib/docker/containers/*/*-json.log
   ```

3. **健康检查**
   ```bash
   docker run -d \
     --health-cmd="curl -f http://localhost/health || exit 1" \
     --health-interval=30s \
     --health-retries=3 \
     myapp
   ```

## 延伸问题

* Docker 和 OCI 的关系？
* containerd 和 Docker 的区别？
* 容器和 Pod 的区别？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
