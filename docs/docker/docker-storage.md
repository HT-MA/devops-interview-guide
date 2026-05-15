---
id: docker-storage
title: Docker 存储
description: Docker 存储驱动与数据持久化
---

# Docker 存储

## 面试官想考什么

* 存储驱动类型
* 数据持久化方案
* bind mount vs volume
* 存储性能

## 标准答案

### 存储驱动

| 驱动 | 适用场景 | 特点 |
|------|----------|------|
| overlay2 | 生产环境推荐 | 性能好，兼容性广 |
| aufs | Ubuntu 旧版本 | 层次结构，兼容性差 |
| devicemapper | RHEL/CentOS | 块设备，稳但复杂 |
| btrfs | 实验性 | 功能丰富，性能一般 |
| zfs | 实验性 | 高级特性，学习曲线陡 |
| none | 完全无存储 | 禁用存储 |

### 查看当前驱动

```bash
docker info | grep "Storage Driver"
```

### 存储架构

```
┌─────────────────────────────────────┐
│           Container Layer           │
│     (writable, 所有写操作在此)        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Image Layers (RO)           │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │ L4 │ │ L3 │ │ L2 │ │ L1 │      │
│  └────┘ └────┘ └────┘ └────┘      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│           Docker Host               │
│  /var/lib/docker/overlay2/           │
└─────────────────────────────────────┘
```

## 常见命令

### Volume 操作

```bash
# 创建 volume
docker volume create mydata

# 查看 volume
docker volume ls
docker volume inspect mydata

# 删除 volume
docker volume rm mydata
docker volume prune  # 清理未使用

# 使用 volume
docker run -v mydata:/data nginx
docker run -v /host/path:/container/path nginx
```

### Bind Mount

```bash
# 基本用法
docker run -v /host/dir:/container/dir nginx

# 只读挂载
docker run -v /host/dir:/container/dir:ro nginx

# 推荐写法 (--mount)
docker run --mount type=bind,source=/host/dir,target=/container/dir nginx
```

### tmpfs Mount

```bash
# 内存存储
docker run --tmpfs /container/path nginx

# 只读限制
docker run --tmpfs /container/path:ro nginx
```

## 数据持久化

### 数据库存储

```bash
# MySQL
docker run -d \
  --name mysql \
  -v mysql-data:/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=secret \
  mysql:8

# PostgreSQL
docker run -d \
  --name postgres \
  -v postgres-data:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=secret \
  postgres:16
```

### 应用配置挂载

```bash
# 配置文件
docker run -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro nginx

# 多文件
docker run -v $(pwd)/config:/etc/myapp/config:ro myapp
```

## 存储原理

### overlay2 工作原理

```
Lower (镜像层, readonly)
  ├── file1
  └── file2
Upper (容器层, writable)
  ├── file3
  └── file2 (覆盖 lower 的 file2)
Merged (合并视图)
  ├── file1 (from lower)
  ├── file2 (from upper)
  └── file3 (from upper)
```

### Copy-on-Write

```bash
# 容器修改镜像中的文件时
# 1. 从镜像层复制到容器层
# 2. 在容器层修改
# 3. 下层镜像文件不变
```

## 常见问题

### 性能问题

```bash
# 性能对比
bind mount > volume > overlay2

# 生产建议
# - 数据库使用 volume
# - 高 IO 使用 bind mount + 本地 SSD
# - 避免容器层大量写
```

### 权限问题

```bash
# 查看文件所有者
docker run --rm -v $(pwd):/data alpine ls -la /data

# 解决方案
# 1. 使用相同 UID
docker run -u 1000:1000 ...

# 2. 改变目录权限
chmod 777 /host/dir

# 3. 使用 named volume (自动处理权限)
docker run -v myvolume:/data myapp
```

### 数据丢失

```bash
# 注意：
# 1. 删除容器会删除匿名 volume
# 2. 使用命名 volume 持久化数据
# 3. 定期备份重要数据

# 备份
docker run --rm -v myvolume:/data -v $(pwd):/backup alpine \
  tar cvf /backup/backup.tar /data

# 恢复
docker run --rm -v myvolume:/data -v $(pwd):/backup alpine \
  tar xvf /backup/backup.tar -C /
```

## 实战经验

### 日志收集

```bash
# 挂载日志目录
docker run -v /var/log/myapp:/var/log/myapp myapp

# 使用 symlink 避免权限问题
```

### 开发环境

```bash
# 代码热更新
docker run -v $(pwd):/code myapp

# 调试模式
docker run -v $(pwd):/code -e DEBUG=true myapp
```

### 生产环境

```yaml
# docker-compose.yml
version: "3.8"
services:
  db:
    image: postgres:16
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./backup:/backup
    deploy:
      resources:
        limits:
          memory: 2G

volumes:
  db-data:
```

## 延伸问题

* 什么是块存储 vs 文件存储？
* 如何监控 volume 使用情况？
* 如何优化 Docker 存储？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
