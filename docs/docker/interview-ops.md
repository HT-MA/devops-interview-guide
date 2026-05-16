---
id: interview-ops
title: Docker 运维面试题
description: Docker 容器运维面试真题，涵盖资源限制、日志管理、健康检查、重启策略、运行时选型等深度考察
---

# Docker 运维面试题

## Q1: Docker 容器的 CPU、内存和 IO 资源限制如何配置和调优？在生产环境中如何定位资源瓶颈？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- CPU 限制通过 `--cpus`（容器级别）和 `--cpu-shares`（相对权重）控制
- 内存限制通过 `--memory`（硬限制）和 `--memory-reservation`（软限制）配合使用
- IO 限制通过 `--device-read-bps`、`--device-write-iops` 等参数控制块设备 IO
- 容器实际可用的内存还可能受 swap 限制（`--memory-swap`）影响
- 资源瓶颈定位使用 `docker stats`、`docker inspect` 和宿主机工具组合

**完整回答**:

**CPU 限制详解**：

Docker 的 CPU 限制底层是通过 cgroup cpu 子系统实现的。

```bash
# --cpus：限制容器可以使用的 CPU 核心数（最常用）
docker run -d --cpus=1.5 nginx
# 容器最多使用 1.5 个 CPU 核心
# 底层等效于: --cpu-period=100000 --cpu-quota=150000
# quota/period = 150000/100000 = 1.5 core

# --cpu-shares：设置 CPU 权重（相对值，不是硬限制）
docker run -d --cpu-shares=2048 nginx
docker run -d --cpu-shares=1024 nginx
# 当 CPU 竞争时，第一个容器获得 CPU 的比例是第二个的 2 倍
# 默认值是 1024
# 当 CPU 空闲时，两个容器都可以用满 CPU

# --cpuset-cpus：绑定到指定核心
docker run -d --cpuset-cpus="0,2" nginx
# 容器只会在 CPU 0 和 CPU 2 上运行
# 适用场景：NUMA 架构优化、实时业务隔离

# -m 或 --memory：设置内存硬限制
docker run -d -m 512m --memory-swap=512m nginx
# --memory-swap 等于 --memory 时，swap 被禁用
# 容器最多使用 512MB 内存，超过则 OOM Kill

# --memory-reservation：设置内存软限制
docker run -d -m 1g --memory-reservation=512m nginx
# 当宿主机内存充足时，容器可以使用 1GB
# 当宿主机内存压力大时，容器被限制在 512MB 内
# 软限制可以避免容器在内存充裕时被限制，但在压力下保障整体稳定性
```

**IO 限制的细粒度控制**：

```bash
# 限制读取速率（字节/秒）
docker run -d \
  --device-read-bps=/dev/sda:10mb \
  --device-write-bps=/dev/sda:10mb \
  nginx

# 限制 IOPS
docker run -d \
  --device-read-iops=/dev/sda:1000 \
  --device-write-iops=/dev/sda:1000 \
  nginx

# 使用 blkio cgroup 的限制组合
# --blkio-weight: IO 调度权重（10-1000，默认 500）
docker run -d --blkio-weight=800 nginx
# 当多个容器竞争 IO 时，权重高的获得更多的 IO 时间
```

注意：IO 限制需要指定块设备，而且只在直接使用块设备写入时生效。对于 overlay2 文件系统上的写入，IO 实际发生在容器层所在的块设备。

**资源限制的常见问题**：

问题 1：内存限额太低导致频繁 OOM

```bash
# 现象：容器反复重启，docker logs 显示 "Killed"
docker logs myapp | tail
# Killed
# exit code 137 (SIGKILL)

# 排查步骤
# 1. 确认容器的实际内存使用
docker stats myapp --no-stream

# 2. 查看 OOM Killer 日志
dmesg | grep -i "oom_kill" | tail -5
# 输出: [pid] ... nginx invoked oom-killer: ...
# 确认是哪个进程触发了 OOM

# 3. 查看 OOM 分数
docker inspect myapp --format '{{.HostConfig.Memory}}'

# 4. 找到容器的 cgroup 路径，查看内核 OOM 日志
cat /sys/fs/cgroup/memory/docker/<container-id>/memory.oom_control
# oom_kill_disable 0
# under_oom 1
# oom_kill 3  <- 已经 OOM killed 3 次
```

问题 2：CPU 限制导致应用性能下降但没超限

```bash
# 现象：CPU 使用卡在限制值附近
docker stats myapp
# CONTAINER  CPU %  MEM USAGE / LIMIT
# myapp      199%   256MiB / 512MiB

# 实际是 2 核限制打满了
# 排查：需要确认应用是多线程/多进程应用，是否因为 CPU 限制导致队列堆积

# 用容器内的工具确认
docker exec myapp top -bn1 | head -20
docker exec myapp cat /sys/fs/cgroup/cpu/cpu.stat
# nr_periods: 1000
# nr_throttled: 350   <- 35% 的时间被限流了！
# throttled_time: 1234567890ns
```

问题 3：系统预留资源不足给容器保留

```bash
# 不要给所有容器分配的总资源等于宿主机的物理资源
# 需要为操作系统、监控代理、SSH、内核等预留资源

# 建议的预留策略（以 64GB 内存、32 核的机器为例）：
# 操作系统 + 管理 Agent: 4GB + 2 核
# 系统弹性 buffer: 4GB + 2 核
# 应用可用: 56GB + 28 核
# 所有 Pod 的 request 总和不应超过 56GB 和 28 核
```

**资源调优的完整排障方案**：

```bash
# 收集容器的资源使用历史（Linux 环境下）
# 1. 使用 cadvisor 采集历史监控数据
# 2. 使用保留的 docker stats 记录到文件
docker stats --no-stream --format \
  "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" \
  >> /var/log/docker-stats.log

# 3. 查看容器准确的 cgroup 数据
CONTAINER_ID=$(docker inspect --format '{{.ID}}' myapp)
cat /sys/fs/cgroup/memory/docker/${CONTAINER_ID}/memory.max_usage_in_bytes
cat /sys/fs/cgroup/cpu/docker/${CONTAINER_ID}/cpuacct.usage

# 4. 使用 bcc-tools 分析容器内的性能（需要 root）
# 在宿主机上使用容器 PID 而不是容器 ID
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' myapp)
nsenter -t $CONTAINER_PID -n top  # 进入容器网络命名空间
nsenter -t $CONTAINER_PID -p ip addr  # 查看容器进程的 CPU 使用
```

**追问**:
- Q: cgroup v1 和 v2 在 Docker 资源限制上的行为有什么区别？
- Q: `--memory-swap` 设置为 -1 意味着什么？在生产环境中有哪些风险？
- Q: 在 Kubernetes 中，request 和 limit 的差异和 Docker 的 `--memory-reservation` 与 `-m` 之间有什么关系？

---

## Q2: Docker 的日志驱动有哪些类型？生产环境中如何管理容器日志？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、美团

**答案要点**:
- Docker 支持多种日志驱动：json-file、journald、syslog、fluentd、awslogs、gelf、splunk 等
- json-file 是默认驱动，日志以 JSON 格式保存在宿主机文件系统
- 生产环境推荐使用 log rotation 配置或集中式日志驱动（fluentd、awslogs）
- 日志驱动在 daemon.json 中全局配置或在容器运行时单独指定
- 未配置日志轮转会导致磁盘空间被日志填满

**完整回答**:

**日志驱动类型与选择**：

Docker 的日志驱动在 daemon 级别全局配置或容器级别单独指定。

```bash
# 查看当前 Docker 使用的日志驱动
docker info | grep "Logging Driver"
# 输出: Logging Driver: json-file

# 查看单个容器的日志驱动
docker inspect --format '{{.HostConfig.LogConfig.Type}}' myapp

# 容器级别指定日志驱动
docker run -d \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  nginx
```

**json-file 驱动的最佳实践**：

json-file 是默认驱动，日志存储在 `/var/lib/docker/containers/<container-id>/<container-id>-json.log`。

生产环境中不配置日志轮转是最常见的运维事故：

```bash
# 错误示例—可能导致磁盘写满的配置
docker run -d nginx
# 默认行为：max-size=unlimited, max-file=1
# nginx 的访问日志如果量大，几天就能填满磁盘

# 正确的配置：限制日志文件大小和数量
docker run -d \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  nginx
# 每个容器最多 3 个文件，每个 10MB，总共 30MB

# 全局配置：/etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": "true"
  }
}
```

**集中式日志驱动的生产配置**：

```bash
# Fluentd 驱动（推荐用于日志集中化管理）
docker run -d \
  --log-driver=fluentd \
  --log-opt fluentd-address=192.168.1.100:24224 \
  --log-opt tag="{{.Name}}/{{.ID}}" \
  --log-opt fluentd-async-connect=true \
  nginx

# fluentd-async-connect=true 非常关键
# 当 fluentd 服务不可用时，容器不会阻塞——以异步方式重试连接
# 如果设为 false 或默认值，fluentd 宕机会导致容器无法启动！

# AWS CloudWatch 驱动（AWS 环境推荐）
docker run -d \
  --log-driver=awslogs \
  --log-opt awslogs-region=us-east-1 \
  --log-opt awslogs-group=myapp-logs \
  --log-opt awslogs-stream=nginx \
  nginx
```

**生产环境日志管理方案**：

方案 1：每个容器限制本地日志 + 应用层发送到日志中心

```bash
# daemon.json 配置
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": true
  }
}
# 应用层通过 logstash/filebeat/fluent-bit sidecar 发送日志到 Elasticsearch
# 优点：解耦容器日志驱动和应用日志收集
# 大部分日志框架直接写 stdout/stderr
```

方案 2：Docker 驱动直接发送

```bash
# 使用 gelf 驱动直接发送到 Graylog
docker run -d \
  --log-driver=gelf \
  --log-opt gelf-address=udp://graylog-host:12201 \
  --log-opt gelf-compression-type=gzip \
  nginx

# 使用 syslog 驱动
docker run -d \
  --log-driver=syslog \
  --log-opt syslog-address=tcp://syslog-server:514 \
  --log-opt syslog-facility=daemon \
  nginx
```

**日志排障常见场景**：

场景 1：磁盘空间被 Docker 日志占满

```bash
# 定位大日志文件
du -sh /var/lib/docker/containers/*/*-json.log | sort -rh | head -10

# 紧急处理：清空日志文件但保留文件句柄
truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log
# 不要 rm，否则需要重启容器才能释放文件句柄

# 永久解决方案：修改 daemon.json 后重启 dockerd
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

场景 2：日志驱动配置错误导致容器无法启动

```bash
# 如果 fluentd 宕机，且 fluentd-async-connect 未配置
# 新容器会一直等待连接 fluentd 而无法启动

# 解决方案：临时切换日志驱动启动容器
docker run -d --log-driver=json-file nginx
# 或修改全局配置后重启 Docker
systemctl restart docker
```

场景 3：容器日志丢失

```bash
# 查看日志驱动是否正确
docker inspect --format '{{.HostConfig.LogConfig}}' myapp

# 检查 journald 驱动
# 使用 journald 驱动的容器日志不会出现在 docker logs 中
# 需要用 journalctl 读取
journalctl -u docker CONTAINER_NAME=myapp --no-pager

# 验证日志文件是否存在且可读
ls -la /var/lib/docker/containers/$(docker ps -q --filter name=myapp)/
```

**追问**:
- Q: Docker 的 dual-logging 功能是什么？在什么场景下会产生双倍日志空间开销？
- Q: `docker logs --tail 0 --follow` 在生产环境频繁使用会有什么性能问题？
- Q: Kubernetes 中的容器日志轮转是由 kubelet 还是 Docker 负责？如何配置？

---

## Q3: Docker HEALTHCHECK 的最佳实践是什么？如何设计有效的健康检查？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、快手

**答案要点**:
- HEALTHCHECK 让 Docker 可以自动检测容器内应用的健康状态
- 三种结果：healthy、unhealthy、starting
- 设计原则：检查应用的真实可用性而非进程存在性
- docker ps 会显示容器的健康状态，docker events 会报告状态变化
- Kubernetes 的存活探针和就绪探针与 Docker HEALTHCHECK 的对应关系

**完整回答**:

**HEALTHCHECK 的基本语法**：

```dockerfile
# Dockerfile 中的写法
FROM nginx:alpine
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# 命令行参数等效
docker run --health-cmd="curl -f http://localhost/health || exit 1" \
  --health-interval=30s \
  --health-timeout=3s \
  --health-start-period=10s \
  --health-retries=3 \
  nginx
```

参数含义：
- `--interval`：检查间隔（默认 30s）
- `--timeout`：单次检查的最大等待时间（默认 30s，建议设短一些）
- `--start-period`：容器启动后延迟多少秒开始检查（默认 0s，强烈建议设置）
- `--retries`：连续失败多少次后标记为 unhealthy（默认 3）

**设计有效健康检查的原则**：

原则 1：检查应用层而非进程层

```bash
# 不好的健康检查：只检查进程是否存在
HEALTHCHECK CMD pgrep nginx || exit 1
# 问题：进程还在但应用可能已经 hang 住、死锁、端口阻塞

# 好的健康检查：检查应用的真实响应
HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1

# 更好的健康检查：检查包含业务逻辑的健康端点
HEALTHCHECK CMD curl -f http://localhost:8080/health/ready || exit 1
# /health/ready 应该返回数据库连接状态、缓存状态、关键依赖的连通性
```

原则 2：设置合理的 start-period

```dockerfile
# Spring Boot 应用启动时间较长
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1
# start-period=60s 告诉 Docker 前 60 秒内的失败不计入 retries
# 避免因应用启动慢导致容器被重启
```

原则 3：检查命令要轻量，不要引入额外依赖

```dockerfile
# 不推荐：依赖 curl（需要安装 curl 到镜像中）
FROM alpine:3.20
RUN apk add --no-cache curl
HEALTHCHECK CMD curl -f http://localhost:80/health

# 推荐：使用 wget（Debian 默认安装）或使用应用自身的健康端点
FROM debian:bookworm-slim
HEALTHCHECK CMD wget -qO- http://localhost:80/health || exit 1

# 更好的方案：使用 go/rust 编译的轻量级健康检查工具
COPY healthcheck /usr/local/bin/healthcheck
HEALTHCHECK CMD ["/usr/local/bin/healthcheck"]
```

原则 4：避免健康检查造成 "惊群效应"

```dockerfile
# 错误的设计——所有副本同时执行健康检查
# 假设 50 个副本，每个 30s 检查一次，每 30s 就有 50 个并发请求打过来
# 如果健康端点做了重操作（比如查数据库），可能导致数据库被打满

# 好的设计：
# 1. 健康端点只做轻量级检查（内存状态检查、连接池是否有空闲连接）
# 2. 避免在健康检查中执行完整的数据库查询
# 3. 增加 --interval 降低检查频率
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s \
  CMD curl -f http://localhost:8080/health/liveness || exit 1
```

**健康检查的运维操作**：

```bash
# 查看容器健康状态
docker ps
# STATUS 列会显示 healthy、unhealthy 或 starting

# 查看健康检查详细日志
docker inspect --format='{{json .State.Health}}' myapp | jq .
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2025-01-15T10:30:00Z",
      "End": "2025-01-15T10:30:01Z",
      "ExitCode": 0,
      "Output": "nginx is running"
    }
  ]
}

# 查看健康检查的历史记录
docker inspect myapp | jq '.[].State.Health.Log[] | {Status: .ExitCode, Time: .End}'

# 监控健康状态变化
docker events --filter event=health_status --format \
  '{{.Time}} {{.Actor.Attributes.name}} {{.Status}}'
```

**生产环境中的健康检查策略**：

利用 `start-period` 避免部署抖动：

```bash
# 场景：滚动更新时，新容器启动慢导致健康检查失败
# Docker Swarm 和 K8s 在容器状态变为 unhealthy 后会杀掉重启
# 如果 start-period 过短，可能导致容器反复重启

# 建议的 start-period 设置：
# - Java 应用（Spring Boot）: 60-120s
# - Node.js 应用: 10-30s
# - Go 应用: 5-10s
# - Nginx 静态服务器: 5s
```

利用 `interval` 和 `retries` 控制容错能力：

```bash
# 允许偶发故障的设计
# interval=30s, retries=3
# 意味着应用最多可以有 90s 的故障窗口而不被标记为 unhealthy
# 适合能容忍短时间故障的场景

# 严格故障检测
# interval=5s, retries=2
# 10s内连续两次失败就标记为 unhealthy
# 适合要求高可用、快速故障转移的场景
```

**Docker HEALTHCHECK 和 K8s 探针的关系**：

```yaml
# Kubernetes 不读取 Dockerfile 中的 HEALTHCHECK 指令
# 需要在 Pod 定义中单独配置
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: myapp
    image: myapp:latest
    livenessProbe:
      httpGet:
        path: /health/live
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 15
      timeoutSeconds: 3
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 2
```

**追问**:
- Q: HEALTHCHECK 容器的 exit code 0 和 1 之外的退出码有什么含义？
- Q: Docker HEALTHCHECK 和 `--restart=always` 叠加使用时，unhealthy 状态会触发重启吗？
- Q: 在 docker-compose 中如何利用 healthcheck 控制服务启动顺序？

---

## Q4: Docker 的重启策略（Restart Policy）有哪些？不同场景下应该如何选择？

**难度**: ⚫⚪⚪ 初级 | **面试公司**: 所有

**答案要点**:
- Docker 支持四种重启策略：no、always、on-failure、unless-stopped
- no：默认值，不自动重启
- always：只要容器退出就重启，包括手动 docker stop
- on-failure：只在容器以非零退出码退出时重启
- unless-stopped：和 always 类似，但手动 stop 后不会在 Docker 重启时自动启动
- restart policy 通过 docker run 的 `--restart` 参数指定

**完整回答**:

**四种重启策略详解**：

```bash
# 策略 1：no（默认）
docker run -d --restart=no nginx
# 容器退出后不自动重启——无论退出码是什么
# 适合批处理任务、一次性任务

# 策略 2：always
docker run -d --restart=always nginx
# 任何时候容器退出（包括非零退出码、手动 docker stop）都会重启
# Docker Daemon 启动时也会自动启动此容器
# 适合需要一直运行的服务，如 API 网关、数据库

# 策略 3：on-failure[:max-retries]
docker run -d --restart=on-failure:5 nginx
# 只在退出码非零时重启
# 可以指定最大重试次数：:5 表示最多尝试重启 5 次
# 适合对于偶发错误可以自动恢复的服务

# 策略 4：unless-stopped
docker run -d --restart=unless-stopped nginx
# 和 always 的行为基本一致
# 唯一区别：如果容器被手动 docker stop，Docker 重启后不会自动启动
# 而 always 策略下，即使手动 stop 过，Docker 重启也会重新启动它
```

**各策略的行为矩阵**：

| 场景 | no | always | on-failure | unless-stopped |
|------|----|--------|------------|-----------------|
| 正常退出 (exit 0) | 不重启 | 重启 | 不重启 | 重启 |
| 异常退出 (exit 1) | 不重启 | 重启 | 重启 | 重启 |
| 手动 docker stop | 不重启 | 重启 | 不重启 | 不重启 |
| Docker Daemon 重启 | 不重启 | 重启 | 不重启 | 重启 |
| Docker Daemon 重启（曾手动 stop） | 不重启 | 重启 | 不重启 | 不重启 |

**生产环境选择指南**：

```bash
# 数据库服务 → unless-stopped
docker run -d \
  --name postgres \
  --restart=unless-stopped \
  postgres:16
# 用 unless-stopped 而非 always 的原因是：
# 如果 DBA 手动 stop 数据库做维护，重启 Docker 后不应该自动启动
# 否则可能导致意料之外的数据库恢复

# 核心 API 服务 → always
docker run -d \
  --name api-gateway \
  --restart=always \
  myapi:latest
# API 网关应该始终运行，即使在部署时手动停过

# 批处理任务 → no 或 on-failure
docker run \
  --restart=on-failure:3 \
  batch-job:latest
# 批处理任务跑完就退出，不需要重启
# 如果失败了最多重试 3 次

# 日志收集 Agent → unless-stopped
docker run -d \
  --name filebeat \
  --restart=unless-stopped \
  docker.elastic.co/beats/filebeat:8.12.0
```

**重启策略的安全机制**：

Docker 内置了退避（back-off）机制防止容器反复崩溃重启：

```bash
# 当容器反复崩溃时，Docker 会逐渐增加重启间隔
# 失败后立即重启 -> 等待 2s -> 4s -> 8s -> 16s -> ... -> 最大 300s
# 一旦容器成功运行超过 10s，退避计数器重置

# 查看重启计数
docker inspect --format '{{.RestartCount}}' myapp

# 查看最近一次重启的时间
docker inspect --format '{{.State.StartedAt}}' myapp
```

**常见的重启策略陷阱**：

陷阱 1：`docker stop` 不能阻止 always 策略的容器在下次重启后启动

```bash
docker stop myapp
# docker stop 后容器退出
systemctl restart docker
# Docker 重启后，always 策略的容器会再次启动

# 如果要彻底停止 always 策略的容器，需要：
docker update --restart=no myapp
docker stop myapp
```

陷阱 2：`on-failure:N` 的 `N` 是总重试次数，不是连续失败次数

```bash
docker run -d --restart=on-failure:3 myapp
# 容器运行->失败->重启->运行 5 分钟->失败->重启->运行->失败->不再重启
# 注意：这里的 3 次是总共 3 次，不是连续 3 次
```

陷阱 3：`--restart=always` 配合 HEALTHCHECK 的行为

```bash
# 当一个容器同时设置了 --restart=always 和 HEALTHCHECK
# 容器状态变为 unhealthy 并不会自动触发重启！
# HEALTHCHECK 只是改变了容器的健康状态，不影响重启策略
# 需要外部工具（如 docker-compose、K8s、systemd）根据健康状态执行重启

# 在 docker-compose 中可以配置
services:
  myapp:
    image: myapp
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
    # 但 docker-compose 也不会自动重启 unhealthy 容器
    # 需要部署时通过 depends_on condition: service_healthy 控制
```

**systemd 接管 Docker 容器的重启**：

在 Podman 生态或需要更精细控制的场景，可以使用 systemd 管理容器重启：

```bash
# 创建 systemd unit 文件
cat > /etc/systemd/system/container-myapp.service << EOF
[Unit]
Description=Docker Container myapp
After=docker.service
Requires=docker.service

[Service]
Restart=always
RestartSec=10s
ExecStart=/usr/bin/docker start -a myapp
ExecStop=/usr/bin/docker stop -t 10 myapp
ExecStopPost=/usr/bin/docker rm myapp

[Install]
WantedBy=multi-user.target
EOF
```

```bash
# 使用 docker run --restart=no 配合 systemd 管理重启
systemctl daemon-reload
systemctl enable container-myapp.service
systemctl start container-myapp.service
```

**追问**:
- Q: `docker update --restart=always myapp` 对一个正在运行的容器立即生效吗？
- Q: Docker Swarm service 的重启策略和 `docker run` 的重启策略有什么关系？
- Q: 在 Kubernetes 中，Pod 的 restartPolicy 有 Always、OnFailure、Never，和 Docker 的 restart policy 映射关系是怎样的？

---

## Q5: docker events 和 docker stats 在运维监控中如何实际使用？如何构建基于事件的自动化运维？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、美团、快手

**答案要点**:
- `docker events` 实时输出 Docker Daemon 的事件流
- `docker stats` 实时显示容器的资源使用统计
- 事件类型包括容器生命周期、网络、存储、镜像、插件等
- 通过 `--filter` 精确过滤事件，通过 `--format` 自定义输出格式
- 事件可以用来触发自动化动作：自动重启、告警、日志记录
- stats 可以联接到监控系统或输出到时间序列数据库

**完整回答**:

**docker events 详解**：

```bash
# 基础用法——实时监听所有事件
docker events

# 使用过滤器精确定位特定事件
docker events --filter 'type=container' --filter 'event=die' --filter 'image=nginx'

# 查看历史事件（Docker 默认只实时流，历史事件需要外部存储）
# 可以用 --since 和 --until 查看有限的历史
docker events --since '2025-01-01T00:00:00' --until '2025-01-02T00:00:00'

# 自定义输出格式，便于程序解析
docker events --format '{{json .}}'

# 常用过滤组合
# 监控非正常退出
docker events --filter 'event=die' --filter 'event=oom' --format \
  '{{.Time}} {{.Actor.Attributes.name}} exited with {{.Actor.Attributes.exitCode}}'

# 监控镜像拉取
docker events --filter 'event=pull' --filter 'type=image'
```

**基于事件的自动化运维脚本**：

实时监控容器异常退出并发送告警：

```bash
#!/bin/bash
# docker-event-monitor.sh
docker events --filter 'type=container' --filter 'event=die' \
  --format '{{json .}}' | while read event
do
  exit_code=$(echo $event | jq -r '.Actor.Attributes.exitCode')
  container_name=$(echo $event | jq -r '.Actor.Attributes.name')
  image=$(echo $event | jq -r '.Actor.Attributes.image')

  if [ "$exit_code" != "0" ]; then
    echo "[ALERT] Container $container_name (image: $image) exited with code $exit_code at $(date)"
    # 发送到 Slack
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"Container $container_name exited with code $exit_code\"}" \
      $SLACK_WEBHOOK_URL
    # 记录到日志文件
    echo "$(date) $container_name $exit_code" >> /var/log/container-exit.log
  fi
done
```

监控镜像仓库事件做安全响应：

```bash
# 监控从不受信任的 registry 拉取镜像
docker events --filter 'event=pull' --filter 'type=image' \
  --format '{{json .}}' | while read event
do
  image=$(echo $event | jq -r '.Actor.ID')
  if [[ $image == *"docker.io"* ]]; then
    echo "[WARN] Pull from Docker Hub: $image"
  elif [[ $image == *"untrusted-registry.com"* ]]; then
    echo "[CRITICAL] Pull from untrusted registry: $image"
    # 触发安全响应流程
  fi
done
```

**docker stats 详解**：

```bash
# 实时查看所有运行中容器的资源使用
docker stats

# 一次性查看（不持续输出）
docker stats --no-stream

# 查看特定容器
docker stats myapp1 myapp2

# 自定义输出格式
docker stats --no-stream --format \
  "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

# JSON 格式便于程序处理
docker stats --no-stream --format '{{json .}}'
```

**stats 数据的持久化和告警**：

将 stats 数据纳入 Prometheus 监控体系：

```bash
#!/bin/bash
# docker-stats-to-prometheus.sh
# 将 docker stats 转换为 Prometheus metrics 格式

docker stats --no-stream --format '{{json .}}' | jq -r '
  "docker_container_cpu_percent{name=\"\(.Name)\"} \(.CPUPerc | gsub("%";""))",
  "docker_container_memory_bytes{name=\"\(.Name)\"} \(.MemUsage | capture("(?<num>[0-9.]+)(?<unit>MiB|GiB|KiB)") | if .unit == "GiB" then (.num|tonumber)*1024*1024*1024 elif .unit == "MiB" then (.num|tonumber)*1024*1024 elif .unit == "KiB" then (.num|tonumber)*1024 else empty end)",
  "docker_container_memory_percent{name=\"\(.Name)\"} \(.MemPerc | gsub("%";""))"
' > /var/lib/node_exporter/docker-stats.prom
```

```bash
# 定期收集（crontab）
* * * * * /usr/local/bin/docker-stats-to-prometheus.sh
```

**事件驱动的自动化运维案例**：

案例 1：容器退出后自动清理日志

```bash
docker events --filter 'event=destroy' --format '{{json .}}' | while read event
do
  container_id=$(echo $event | jq -r '.Actor.ID')
  # 清理日志文件
  rm -f /var/lib/docker/containers/$container_id/$container_id-json.log
  echo "[CLEANUP] Removed logs for $container_id"
done
```

案例 2：监控 OOM 事件并扩容

```bash
docker events --filter 'event=oom' --format '{{json .}}' | while read event
do
  container_name=$(echo $event | jq -r '.Actor.Attributes.name')
  echo "[CRITICAL] OOM in $container_name — triggering scale-up"
  # 在 Docker Swarm 中扩容
  docker service scale ${container_name}=$(($(docker service ls --filter name=${container_name} -q | wc -l) + 1))
  # 或触发 webhook
  curl -X POST $AUTO_SCALE_WEBHOOK
done
```

**Docker 事件的局限性**：

```bash
# 注意：docker events 通过 REST API 连接到 dockerd
# 如果 dockerd 重启，事件流会断开
# 生产环境建议使用 containerd 的事件 API 或 K8s 的事件系统

# 事件只记录 dockerd 存活期间的事件
# Docker 不提供历史事件查询（除非事件系统持续记录）
# 因此需要外部监控系统持久化事件

# 事件的时效性：事件到达可能有延迟（特别是资源紧张时）
```

**追问**:
- Q: `docker events` 和 `containerd` 的 event 系统之间是什么关系？如何直接订阅 containerd 的事件？
- Q: 如何将 Docker 事件流集成到现有的监控系统中（Prometheus Alertmanager、PagerDuty 等）？
- Q: Docker 事件中的 `update` 类型事件在什么场景下触发？可以用来做什么自动化操作？

---

## Q6: Docker Compose、Docker Swarm 和 Kubernetes 应该如何选择？各自适用的业务场景是什么？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- Docker Compose 适合单机多容器编排，开发/测试环境，简单部署
- Docker Swarm 适合中小团队、对运维复杂度敏感的场景，与 Docker API 完全兼容
- Kubernetes 适合大规模生产集群，功能最完善但运维复杂度最高
- Compose + Swarm 是可以快速交付的轻量方案，但生态不如 K8s
- 选择维度：团队规模、运维能力、业务复杂度、迁移成本

**完整回答**:

**三者的定位和适用场景**：

Docker Compose：单机编排工具，适合开发环境和简单部署。

```yaml
# docker-compose.yml — 典型的三层应用
version: "3.8"
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend

  backend:
    build: ./backend
    environment:
      - DB_HOST=postgres
      - DB_PASSWORD=${DB_PASSWORD}
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}

volumes:
  postgres_data:
```

Compose 的管理命令：

```bash
# 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f backend

# 扩容（docker-compose v2 支持）
docker compose up -d --scale backend=3

# 滚动更新
docker compose up -d --no-deps --build backend
```

Docker Swarm：Docker 原生集群管理工具，API 完全兼容。

```bash
# 初始化集群
docker swarm init --advertise-addr 192.168.1.100

# 部署服务
docker stack deploy -c docker-compose.yml myapp

# 服务管理
docker service ls
docker service ps myapp_backend
docker service scale myapp_backend=5

# 滚动更新
docker service update --image myapp:2.0 myapp_backend
# Swarm 默认滚动更新策略：
# --update-parallelism 1   # 一次更新一个副本
# --update-delay 30s       # 每个副本间隔 30s
# --update-failure-action pause  # 更新失败时暂停

# 节点管理
docker node ls
docker node update --availability drain node2  # 节点维护
```

Kubernetes：生产级容器编排平台。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
      - name: backend
        image: myapp:latest
        resources:
          requests:
            cpu: "0.5"
            memory: "512Mi"
          limits:
            cpu: "1"
            memory: "1Gi"
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
        livenessProbe:
          httpGet:
            path: /live
            port: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  type: ClusterIP
  ports:
  - port: 8080
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend
spec:
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**选型决策矩阵**：

| 维度 | Docker Compose | Docker Swarm | Kubernetes |
|------|---------------|-------------|------------|
| 学习曲线 | 低（半天） | 中（1-2 天） | 高（2-4 周） |
| 运维复杂度 | 极低 | 低 | 高 |
| 单机部署 | 原生支持 | 需要集群 | 需要完整集群 |
| 高可用 | 不支持 | 原生支持 | 原生支持 |
| 自动扩缩容 | 手动 | 手动 | HPA 自动 |
| 服务发现 | DNS-based | VIP + Mesh | DNS + Service |
| 存储编排 | Volume 挂载 | Volume | CSI + PV/PVC |
| 配置管理 | 环境变量 | Config/Secret | ConfigMap/Secret |
| 监控集成 | 手动 | 基础 | 完善（Metrics Server + Prometheus） |
| 社区生态 | 大 | 小（已边缘化） | 最大 |
| 升级迁移 | 简单 | 简单 | 复杂 |

**实际选型建议**：

场景 1：个人项目或 5 人以下的团队——Docker Compose 就够了

```bash
# 用 Compose 文件描述全栈应用
# 用 docker compose up -d 一键启动
# 日志用 docker compose logs 查看
# 不需要高可用，不需要跨节点
# 如果增长，先考虑 Compose + 单机
```

场景 2：中小团队（10-30 人），运维人员少——Docker Swarm 是务实选择

```bash
# 优势：Docker Compose 文件可以直接用于 Swarm 部署
# 学习成本低，开发人员从 Compose 到 Swarm 基本无缝切换
# 内置的负载均衡和服务发现开箱即用
# 配合 Traefik 作为 ingress 可以快速搭建生产环境

# 劣势：插件生态不如 K8s
# 自动扩缩容需要配合外部工具
# 存储编排能力弱
# Docker 公司已弱化 Swarm 的开发投入
```

场景 3：大规模集群、多团队协作——Kubernetes

```bash
# 优势：
# - 成熟的多租户方案（Namespace + RBAC + NetworkPolicy）
# - 丰富的 Operator 生态（数据库、消息队列、监控）
# - 完善的自动扩缩容（HPA、VPA、Cluster Autoscaler）
# - 强大的存储编排（CSI 驱动覆盖几乎所有存储方案）

# 挑战：
# - 运维复杂度高，需要至少 1-2 名专职 K8s 运维
# - 升级风险大（跨版本升级需要仔细规划）
# - 网络和存储配置复杂
# - 资源占用高（控制平面组件本身消耗资源）
```

**混合架构的演进路径**：

```bash
# 阶段 1：开发环境
docker compose up

# 阶段 2：测试/小规模生产
# 使用 docker compose + 单机部署
# 配合 CI/CD 自动发布

# 阶段 3：生产环境（小规模，< 50 容器）
# 迁移到 Swarm
docker swarm init
docker stack deploy -c docker-compose.yml prod

# 阶段 4：生产环境（大规模）
# 迁移到 K8s
# Compose 文件通过 kompose 转换为 K8s 清单
kompose convert -f docker-compose.yml
kubectl apply -f .
```

**追问**:
- Q: Docker Compose v2（docker compose）和 v1（docker-compose）有什么区别？
- Q: Nomad 作为容器编排平台和 Swarm/K8s 相比有什么不同？适合什么场景？
- Q: 从 Swarm 迁移到 K8s 的路径和风险有哪些？有没有平滑迁移策略？

---

## Q7: containerd、CRI-O 和 gVisor 这些容器运行时各有什么特点？如何根据生产场景选择？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、蚂蚁集团、华为

**答案要点**:
- containerd：Kubernetes 最流行的 CRI 实现，Docker 剥离后的工业级运行时
- CRI-O：Red Hat 主导开发的轻量级 CRI 实现，与 OpenShift 深度集成
- gVisor：Google 开发的用户态内核沙箱，提供更强的安全隔离
- 选择维度：性能、安全性、兼容性、Kubernetes 版本支持、生态成熟度
- containerd 是目前 Kubernetes 默认运行时，CRI-O 在 OpenShift 生态占主导

**完整回答**:

在 Kubernetes 1.24 移除了 dockershim 后，容器运行时选型成为一个必须做的决策。目前 Kubernetes 通过 CRI（Container Runtime Interface）与容器运行时交互。

**containerd——最流行的选择**：

containerd 从 Docker 中剥离后捐赠给 CNCF，现在是 Kubernetes 最广泛使用的容器运行时。

```bash
# containerd 的命令行工具
ctr images pull docker.io/library/nginx:alpine
ctr run docker.io/library/nginx:alpine nginx

# 更高级的工具 nerdctl（Docker 兼容 CLI）
nerdctl run -d -p 80:80 nginx:alpine
nerdctl ps
nerdctl compose up -d # 支持 docker-compose 文件！
```

架构特点：
- 稳定可靠：几乎所有主流的 Kubernetes 发行版（kubeadm、EKS、AKS、GKE）都默认使用 containerd
- API 丰富：除了 CRI 接口，还提供镜像管理、快照管理、元数据管理等额外 API
- 性能优秀：与 Docker 共享底层实现（runc），性能开销几乎相同

配置 containerd 作为 Kubernetes 运行时的关键设置：

```toml
# /etc/containerd/config.toml
version = 2

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
  runtime_type = "io.containerd.runc.v2"

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
  SystemdCgroup = true  # 使用 systemd cgroup 驱动（推荐）

# 配置镜像加速（在中国或内网环境）
[plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
  endpoint = ["https://mirror.ccs.tencentyun.com", "https://registry-1.docker.io"]

# 配置 snapshotter
[plugins."io.containerd.grpc.v1.cri".containerd]
  snapshotter = "overlayfs"
```

**CRI-O——Red Hat 生态的选择**：

CRI-O 是专门为 Kubernetes 设计的 CRI 实现，不做任何 Docker API 兼容，代码更精简。

```bash
# CRI-O 的命令行工具 crictl（和 containerd 共享 CRI 规范）
crictl ps
crictl images
crictl logs <container-id>

# 查看 CRI-O 配置
cat /etc/crio/crio.conf
```

CRI-O 与 containerd 的关键差异：

```bash
# 1. 镜像管理
# containerd 有自己的镜像存储格式
# CRI-O 直接使用容器镜像的 OCI 格式存储

# 2. 进程模型
# containerd: containerd -> containerd-shim -> runc
# CRI-O: crio -> conmon -> runc
# CRI-O 使用 conmon（和 Podman 相同）而不是 containerd-shim

# 3. 默认运行时
# containerd: runc
# CRI-O: crun（Red Hat 默认使用 crun 而非 runc）
```

选择 CRI-O 的典型场景：
- 使用 OpenShift 作为 Kubernetes 发行版
- Red Hat/CentOS/Fedora 为主的服务器环境
- 需要最小化运行时组件（CRI-O 代码量约 containerd 的 1/3）
- 不需要 Docker API 兼容性

**gVisor——安全优先的选择**：

gVisor 不是标准 OCI 运行时，而是一个用户态 Linux 内核（Sentry）。每个容器运行在自己的沙箱中，系统调用被 Sentry 拦截并处理。

```bash
# 安装 gVisor
wget https://storage.googleapis.com/gvisor/releases/release/latest/runsc
chmod +x runsc
sudo mv runsc /usr/local/bin/

# 配置 containerd 使用 gVisor
cat >> /etc/containerd/config.toml << EOF
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
  runtime_type = "io.containerd.runsc.v1"
EOF

# Kubernetes 中通过 RuntimeClass 使用
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc

# Pod 指定使用 gVisor
apiVersion: v1
kind: Pod
spec:
  runtimeClassName: gvisor
  containers:
  - name: untrusted
    image: myapp:latest
```

gVisor的适用场景：
- 多租户 SaaS 平台运行非信任代码
- 用户提交的自定义代码执行环境（FaaS）
- 与不可信第三方容器共享节点
- 需要额外安全层又不想用完整 VM 的场景

gVisor 的局限性：

- 系统调用兼容性：大约 80% 的 Linux 系统调用被支持，部分复杂调用（如 `io_uring`、某些 `ptrace` 操作）不支持
- 性能损耗：网络和文件 IO 密集型应用损耗 30-50%，CPU 计算型应用损耗 10-20%
- 调试困难：`docker exec` 等交互式操作在 gVisor 沙箱中受限

**完整的运行时选型决策**：

```bash
# 评估清单
# 1. 安全隔离需求
#    高（多租户、非信任工作负载） -> gVisor 或 Kata Containers
#    中（标准企业应用） -> containerd
#    低（内部工具） -> containerd

# 2. 性能要求
#    极致性能（网络 IO 密集型） -> containerd + runc
#    平衡（标准 Web 服务） -> containerd + runc 或 crun
#    安全优先 -> gVisor

# 3. 生态要求
#    需要 Docker API 兼容 -> containerd + nerdctl
#    使用 OpenShift -> CRI-O
#    兼容性大于一切 -> containerd

# 4. 团队技能
#    熟悉 Docker -> containerd（迁移成本最低）
#    熟悉 Red Hat 生态 -> CRI-O
#    需要特殊安全能力 -> gVisor
```

**追问**:
- Q: CRI（Container Runtime Interface）的接口定义包括哪些核心方法？
- Q: Kata Containers 和 gVisor 在安全隔离的实现原理上有什么本质区别？
- Q: Kubernetes 1.24 移除 dockershim 后，对生产集群的升级策略有什么影响？

---

## Q8: 镜像安全扫描工具有哪些？如何建立容器镜像的安全扫描流水线？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、蚂蚁集团

**答案要点**:
- 主流工具：Trivy（推荐）、Grype、Docker Scout、Clair、Snyk、Anchore
- Trivy 扫描范围最广：OS 包、语言依赖、IaC 配置、K8s 资源
- 扫描应在 CI/CD 流水线中自动执行，阻断高危漏洞镜像的部署
- 需要建立漏洞的分级策略和修复 SLA
- SBOM（Software Bill of Materials）是镜像安全的基础资产

**完整回答**:

**主流安全扫描工具对比**：

```bash
# Trivy (Aqua Security) —— 推荐，最全面的开源工具
trivy image nginx:latest
trivy image --severity HIGH,CRITICAL myapp:latest

# Grype (Anchore)
grype nginx:latest

# Docker Scout（Docker 官方）
docker scout cves nginx:latest
docker scout recommendations nginx:latest

# Clair（Red Hat，主要用于镜像仓库集成）
clairctl report nginx:latest
```

Trivy 相比其他工具的优势：
- 扫描速度快（无需先拉取完整镜像即可扫描）
- 覆盖范围广：OS 包（Alpine、Debian、Ubuntu、CentOS 等）+ 编程语言依赖（npm、pip、gem、go、maven 等）+ IaC 配置问题
- 支持扫描 filesystem、git repo、K8s 资源
- 支持 SBOM 生成和 CycloneDX/SPDX 格式输出

```bash
# Trivy 支持多种输出格式
trivy image --format json nginx:latest > scan-result.json
trivy image --format sarif nginx:latest > scan-result.sarif  # GitHub Code Scanning
trivy image --format cyclonedx nginx:latest > sbom.json       # SBOM 导出

# 生成 SBOM
trivy image --format cyclonedx --output nginx-sbom.json nginx:latest
```

**CI/CD 扫描流水线设计**：

第一阶段：在 PR 阶段进行快速扫描

```yaml
# GitHub Actions 示例
name: Container Security Scan

on:
  pull_request:
    paths:
      - 'Dockerfile'
      - '**/Dockerfile'

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL'
          exit-code: '1'   # 发现 CRITICAL 漏洞就失败

      - name: Upload scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

```yaml
# GitLab CI 示例
container-security-scan:
  stage: test
  image:
    name: aquasec/trivy:latest
    entrypoint: [""]
  variables:
    IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  script:
    - trivy image --exit-code 1 --severity CRITICAL $IMAGE_TAG
    - trivy image --exit-code 0 --severity HIGH $IMAGE_TAG
  only:
    - main
    - merge_requests
```

第二阶段：在镜像仓库中进行持续扫描

```yaml
# Harbor 镜像仓库内置扫描
# 配置 Harbor 自动扫描策略
# 1. 新镜像推送时自动扫描
# 2. 每 24 小时重新扫描（获取最新的 CVE 库）
# 3. 扫描结果影响镜像的可信状态
```

```bash
# 使用 Harbor API 触发扫描
curl -u "admin:password" -X POST \
  "https://harbor.example.com/api/v2.0/projects/myproject/repositories/myapp/artifacts/latest/scan"

# 查看扫描结果
curl -u "admin:password" \
  "https://harbor.example.com/api/v2.0/projects/myproject/repositories/myapp/artifacts/latest/additions/vulnerabilities"
```

第三阶段：部署阻断策略

```yaml
# Kubernetes 使用 OPA/Gatekeeper 阻断有高危漏洞的镜像
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: block-critical-cves
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
  parameters:
    # 通过 mutating webhook 注入
    # 需要集成镜像扫描结果到 admission controller
```

```yaml
# 或者使用 Kyverno 策略
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: scan-images
spec:
  rules:
  - name: block-critical
    match:
      resources:
        kinds:
        - Pod
    verifyImages:
    - imageReferences:
      - "*"
      attestors:
      - entries:
        - keyless:
            subject: "https://chains.tekton.dev/*"
```

**漏洞分级和修复策略**：

```bash
# 漏洞严重程度
# CRITICAL: 可远程利用、无需认证、影响广泛（7天内修复）
# HIGH: 可本地利用或在特定条件下远程利用（30天内修复）
# MEDIUM: 需要特殊条件或低影响（90天内修复）
# LOW: 信息泄露或非直接攻击向量（下次迭代修复）

# Trivy 的严重程度过滤
trivy image --severity CRITICAL,HIGH myapp:latest
```

**修复漏洞的实际操作**：

```bash
# 1. 更新基础镜像版本
FROM node:20-alpine  # 旧版本
FROM node:20.12.0-alpine3.20  # 更新到修复漏洞的版本

# 2. 使用 Trivy 自动化升级建议
trivy image --severity CRITICAL myapp:latest | grep "Fixed Version"

# 3. 在 Dockerfile 中显式升级特定包
FROM alpine:3.20
RUN apk update && \
    apk upgrade --no-cache libssl3 libcrypto3  # 只升级有漏洞的包

# 4. 重建和重新部署
docker build --no-cache -t myapp:fixed .
docker push myapp:fixed
```

**SBOM 策略**：

```bash
# 生成 SBOM（软件物料清单）
trivy image --format cyclonedx --output myapp.sbom.json myapp:latest

# SBOM 存入镜像 registry 作为 artifact
oras attach myregistry.com/myapp:latest \
  --artifact-type application/vnd.cyclonedx \
  myapp.sbom.json

# 通过 SBOM 做漏洞回溯
# 当一个新的 CVE 发布时，扫描所有 SBOM 找到受影响的镜像
trivy sbom myapp.sbom.json
```

**追问**:
- Q: SBOM（Software Bill of Materials）在容器安全中的作用是什么？有哪些标准格式？
- Q: 镜像签名（Cosign）和镜像扫描在安全体系中的关系是什么？如何配合使用？
- Q: 如何减少误报——很多扫描出来的 CVE 在容器运行时环境中其实不可利用，如何处理？
