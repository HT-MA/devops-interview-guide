---
id: docker-security
title: Docker 安全
description: Docker 安全最佳实践
---

# Docker 安全

## 面试官想考什么

* 安全加固措施
* 镜像安全
* 运行时安全
* 漏洞扫描

## 标准答案

### 安全攻击面

```
┌──────────────────────────────────────┐
│            Container                  │
│  ┌────────────────────────────────┐ │
│  │     Application Code           │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │     Dependencies              │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │     Base Image                 │ │
│  └────────────────────────────────┘ │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│         Docker Daemon                │
│  root privileges                      │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│         Linux Kernel                  │
│  Namespace / Cgroup / Capabilities   │
└──────────────────────────────────────┘
```

### 最小权限原则

| 风险 | 缓解措施 |
|------|----------|
| 容器内 root | 使用 `--user` 非 root 用户运行 |
| 容器逃逸 | 启用 `--security-opt` |
| 资源耗尽 | 设置 `--memory`, `--cpu-limit` |
| 敏感文件暴露 | 避免 `--privileged` |
| 恶意镜像 | 使用可信来源 + 扫描 |

## 镜像安全

### 基础镜像选择

```dockerfile
# 推荐：使用官方精简镜像
FROM node:20-alpine
FROM eclipse-temurin:17-jre-alpine
FROM python:3.12-slim

# 不推荐
FROM node:latest          # 可能不稳定
FROM ubuntu               # 太大
FROM centos:6             # 可能包含已知漏洞
```

### 镜像扫描

```bash
# Docker Scout
docker scout cves myapp:latest

# Trivy
trivy image myapp:latest

# Grype
grype myapp:latest

# 输出示例
# ========== Scanned myapp:latest (alpine 3.18) ==========
# 
# ✗ CRITICAL: CVE-2024-1234 (openssl)
#   Fixed: 1.2.3.4
#   Description: Remote code execution vulnerability
```

### 多阶段构建减少攻击面

```dockerfile
# 不推荐：包含构建工具
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]

# 推荐：只包含运行时
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app .
CMD ["node", "index.js"]
```

## 运行时安全

### 用户权限

```bash
# 创建应用用户
RUN groupadd -r appgroup && \
    useradd -r -g appgroup appuser

# 切换用户
USER appuser

# 运行时指定用户
docker run --user 1000:1000 myapp
```

### 资源限制

```bash
# 内存限制
docker run -m 512m myapp

# CPU 限制
docker run --cpus 1.5 myapp

# 内存+Swap
docker run --memory=512m --memory-swap=1g myapp

# PIDs 限制
docker run --pids-limit 100 myapp
```

### 安全选项

```bash
# 只读文件系统
docker run --read-only myapp

# 禁用特权模式
docker run --privileged myapp  # 不要用！

# AppArmor/SELinux
docker run --security-opt apparmor=default myapp
docker run --security-opt label=type:container_file_t myapp

# 禁止新特权
docker run --security-opt no-new-privileges myapp
```

### 能力控制

```bash
# 查看所有能力
capsh --print

# 容器默认能力
# CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, 
# SETGID, SETUID, SETFCAP, SETPCAP, NET_BIND_SERVICE,
# SYS_CHROOT, KILL, AUDIT_WRITE

# 移除能力
docker run --cap-drop=ALL myapp

# 添加必要能力
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myapp

# 不推荐
docker run --privileged myapp
```

## 网络安全

### 网络隔离

```bash
# 创建隔离网络
docker network create --internal mynet

# 限制网络访问
docker run --network mynet --internal myapp

# 禁止网络
docker run --network none myapp
```

### 敏感端口

```bash
# 不暴露敏感端口
docker run -p 127.0.0.1:8080:8080 myapp

# 只映射必要端口
docker run -p 80:80 -p 443:443 nginx
```

## 密钥管理

### 不推荐做法

```bash
# 不要在镜像中存密钥
ENV API_KEY=secret123    # 不安全

# 不要在 docker history 中暴露
docker history myapp  # 能看到
```

### 推荐做法

```bash
# 使用 Docker secrets (Swarm)
docker secret create api_key api_key.txt

# 或使用环境变量
docker run -e API_KEY=$API_KEY myapp

# Kubernetes Secret
kubectl create secret generic api-key --from-literal=key=secret
```

## 安全检查清单

| 检查项 | 命令/配置 |
|--------|-----------|
| 使用非 root 用户 | `USER appuser` |
| 资源限制 | `--memory`, `--cpus` |
| 只读文件系统 | `--read-only` |
| 不使用 privileged | `--privileged=false` |
| 限制 capabilities | `--cap-drop=ALL` |
| 禁止新特权 | `--security-opt=no-new-privileges` |
| 镜像扫描 | `trivy image` |
| 定期更新镜像 | 更新 base image |
| 使用可信镜像 | 官方/认证镜像 |

## 实战经验

### 生产环境 Dockerfile

```dockerfile
FROM eclipse-temurin:17-jre-alpine

# 安全加固
RUN addgroup -S appgroup && adduser -S -G appgroup appuser

WORKDIR /app

# 复制依赖
COPY --chown=appuser:appgroup . .

# 切换用户
USER appuser

# 安全配置
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8080/health || exit 1

# 运行时安全
# --read-only (如应用支持)
# --tmpfs /tmp (临时文件)
# --cap-drop=ALL
# --no-new-privileges

CMD ["java", "-jar", "app.jar"]
```

### CI/CD 安全检查

```yaml
# .gitlab-ci.yml
security-scan:
  stage: test
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 1 --severity HIGH,CRITICAL myapp:latest
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

## 延伸问题

* 什么是 seccomp？
* Docker 安全和 Kubernetes 安全的区别？
* 如何审计容器运行行为？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>

<span className="company-tag">AWS</span>
