---
id: dockerfile-optimization
title: Dockerfile 优化
description: Dockerfile 最佳实践与镜像优化
---

# Dockerfile 优化

## 面试官想考什么

* Dockerfile 语法
* 多阶段构建
* 镜像层缓存
* 镜像大小优化

## 标准答案

### Dockerfile 基础

```dockerfile
FROM ubuntu:22.04

LABEL maintainer="email@example.com"

WORKDIR /app

COPY . .

RUN apt-get update && \
    apt-get install -y python3 && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 8080

ENV NODE_ENV=production

USER nobody

CMD ["python3", "app.py"]
```

### Dockerfile 指令

| 指令 | 说明 | 注意事项 |
|------|------|----------|
| FROM | 基础镜像 | 使用特定版本，不要用 latest |
| COPY | 复制文件 | 优先用 COPY 而非 ADD |
| ADD | 复制+解压 | 仅在需要解压时使用 |
| RUN | 执行命令 | 合并多个命令减少层 |
| CMD | 容器启动命令 | 一个 Dockerfile 只有一个 |
| ENTRYPOINT | 入口命令 | 不可覆盖 |
| ENV | 环境变量 | 设置默认环境变量 |
| EXPOSE | 声明端口 | 仅文档作用 |
| WORKDIR | 工作目录 | 自动创建目录 |
| USER | 运行用户 | 避免用 root |
| LABEL | 元数据 | 版本、维护者等 |

## 多阶段构建

### Java 应用

```dockerfile
# 第一阶段：构建
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

# 第二阶段：运行
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Go 应用

```dockerfile
# 构建阶段
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# 运行阶段
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
CMD ["./main"]
```

### Node.js 应用

```dockerfile
# 依赖阶段
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

## 镜像优化技巧

### 减少镜像大小

```dockerfile
# 1. 使用 alpine 基础镜像
FROM alpine:3.18

# 2. 清理缓存
RUN apt-get update && \
    apt-get install -y --no-install-recommends package && \
    rm -rf /var/lib/apt/lists/*

# 3. 合并 RUN 指令
RUN apt-get update && apt-get install -y a b c && rm -rf /var/lib/apt/lists/*

# 4. 使用 .dockerignore
# .git
# node_modules
# *.log
```

### 利用缓存

```dockerfile
# 顺序：频繁变化的放后面
COPY package*.json ./
RUN npm ci
COPY . .          # 代码变化时只需重建这一层

# 错误示例
COPY . .
RUN npm ci        # 代码变化导致重新下载依赖
```

### 安全最佳实践

```dockerfile
# 使用非 root 用户
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# 设置只读文件系统
USER appuser

# 不要存储敏感信息
# 敏感信息通过环境变量或挂载
```

## .dockerignore

```
# 版本控制
.git
.gitignore

# 依赖
node_modules
vendor
__pycache__

# 构建产物
dist
build

# 文档
*.md
docs

# IDE
.idea
.vscode

# 日志
*.log
logs

# 测试
test
tests
coverage
```

## 实战经验

### 构建加速

```bash
# 使用 BuildKit
export DOCKER_BUILDKIT=1

# 并行构建
docker build --progress=plain -t myapp .

# 跳过验证
docker build --no-cache -t myapp .

# 查看构建时间
docker history myapp
```

### 镜像分析

```bash
# 查看镜像层
docker history myapp:latest

# 扫描漏洞
docker scout cves myapp:latest
trivy image myapp:latest

# 减少层数
docker run --rm -v $(pwd):/output containerstructure:tool report \
  --image myapp:latest --format text > analysis.txt
```

### CI/CD 集成

```yaml
# .gitlab-ci.yml 示例
build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t myapp:$CI_COMMIT_SHA .
    - docker run myapp:$CI_COMMIT_SHA npm test
    - docker push myapp:$CI_COMMIT_SHA
```

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 构建太慢 | 使用缓存、并行构建 |
| 镜像太大 | 多阶段构建、使用 alpine |
| 启动失败 | 检查 ENTRYPOINT 格式 |
| 权限问题 | 使用 USER 切换用户 |
| 依赖更新慢 | 换国内镜像源 |

## 延伸问题

* BuildKit 是什么？
* 镜像签名如何实现？
* 如何构建最小 Java 镜像？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
