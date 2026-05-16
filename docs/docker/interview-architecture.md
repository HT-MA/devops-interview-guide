---
id: interview-architecture
title: Docker 架构面试题
description: Docker 架构与容器运行时面试真题，涵盖 containerd、OCI 规范、runc、shim、rootless 等深度考察
---

# Docker 架构面试题

## Q1: Docker Daemon、containerd 和 runc 之间是什么关系？容器从创建到运行的全链路流程是怎样的？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、字节跳动、腾讯

**答案要点**:
- Docker 1.11 之后从单体架构拆分为 Docker Engine -> containerd -> runc 三层
- Docker Daemon 负责 API 层和编排能力，containerd 负责容器生命周期管理，runc 是 OCI 运行时
- containerd-shim 是每个容器的守护进程，负责接管容器进程
- 容器创建链路涉及 gRPC 调用、OCI bundle 生成和 runc 启动

**完整回答**:

理解 Docker 架构的演进历史很关键。Docker 1.11 之前是一个单体 daemon，所有功能（镜像管理、容器创建、存储、网络）都在 dockerd 进程中完成。这种架构的问题是：dockerd 如果挂掉，所有运行中的容器都会失去控制。

从 Docker 1.11 开始引入了 containerd，架构分层为：

```
dockerd (Docker Engine)
    │ REST API / gRPC
    ▼
containerd
    │ gRPC (ttRPC)
    ▼
containerd-shim-runc-v2 (per container)
    │
    ▼
runc (OCI runtime)
```

**容器创建的完整链路**:

第一步，用户在 CLI 执行 `docker run`，CLI 将命令转换为 REST API 请求发送给 dockerd（通过 `/var/run/docker.sock` Unix Socket）。

第二步，dockerd 收到请求后做镜像检查、网络配置、volume 挂载等准备工作，然后通过 gRPC 调用 containerd 的 `CreateContainer` 和 `StartContainer` 接口。dockerd 和 containerd 之间的通信使用的是 containerd 的 gRPC API（containerd 1.0+ 默认监听 `/run/containerd/containerd.sock`）。

第三步，containerd 收到请求后，将 Docker 镜像解包为 OCI 标准格式的 "bundle"——一个包含 rootfs 文件系统和 config.json（OCI runtime-spec 格式的配置）的目录。containerd 不会自己直接创建容器，而是调用 runc 来执行。

第四步，containerd 启动 containerd-shim 进程，shim 进程调用 runc 的 `create` 和 `start` 命令完成容器的创建和启动。

**为什么需要 containerd-shim？**

这是架构中最容易被忽视但至关重要的组件。runc 创建完容器后就会退出，容器进程变成了 shim 的子进程。shim 的作用是：

1. 充当守护者——即使 dockerd 重启或 containerd 重启，shim 保持运行，容器不受影响
2. 报告容器的退出状态给 containerd
3. 管理容器的标准 I/O 流
4. 在 runc 退出后保持容器进程的父进程身份，防止容器变成孤儿进程

**生产环境排障示例**：

```bash
# 查看 containerd 进程
ps aux | grep containerd

# 查看 shim 进程 — 每个容器对应一个 shim
ps aux | grep containerd-shim

# 查看 runc 实际使用的 cgroup 路径
docker inspect --format '{{.HostConfig.CgroupParent}}' <container>

# 在主机上追踪容器创建过程（需要 root）
strace -f -e trace=clone,execve docker run -d nginx 2>&1 | grep -E "runc|containerd"
```

**追问**:
- Q: containerd 1.0 和 containerd 2.0 在架构上有什么重要变化？
- Q: dockerd 直接调用 containerd API 和用 ctr 命令调用有什么区别？
- Q: 如果 containerd 进程挂了，正在运行的容器会怎样？

---

## Q2: OCI（Open Container Initiative）规范包含哪几个核心规范？runtime-spec 和 image-spec 分别定义了什么内容？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、华为

**答案要点**:
- OCI 包含三大规范：runtime-spec、image-spec 和 distribution-spec
- runtime-spec 定义容器配置格式（config.json）和生命周期
- image-spec 定义镜像格式（manifest、index、layer、config）的标准
- distribution-spec 定义镜像分发推送拉取的 API 协议
- 所有符合 OCI 规范的运行时和镜像都是可互换的

**完整回答**:

OCI（Open Container Initiative）是 Linux 基金会下的一个开源组织，2015 年由 Docker、CoreOS 等公司发起。目的是防止容器生态碎片化，制定容器运行时和镜像格式的行业标准。目前 OCI 有三大规范：

**1. Runtime Specification (runtime-spec)**

定义容器运行时的最小标准，即"什么才算是一个容器"。核心内容：

- **config.json 结构**：这是容器的配置文件，定义了容器的完整配置。关键字段包括：

```json
{
  "ociVersion": "1.0.2",
  "process": {
    "terminal": true,
    "user": {"uid": 0, "gid": 0},
    "args": ["nginx", "-g", "daemon off;"],
    "env": ["PATH=/usr/local/sbin:/usr/local/bin:..."],
    "cwd": "/",
    "capabilities": {
      "bounding": ["CAP_NET_BIND_SERVICE"],
      "effective": ["CAP_NET_BIND_SERVICE"],
      "permitted": ["CAP_NET_BIND_SERVICE"]
    },
    "rlimits": [{"type": "RLIMIT_NOFILE", "hard": 1024, "soft": 1024}]
  },
  "root": {"path": "rootfs", "readonly": true},
  "hostname": "nginx",
  "linux": {
    "namespaces": [
      {"type": "pid"},
      {"type": "network"},
      {"type": "mount"},
      {"type": "uts"},
      {"type": "ipc"}
    ],
    "resources": {
      "memory": {"limit": 536870912},
      "cpu": {"shares": 1024, "quota": 50000, "period": 100000}
    },
    "seccomp": {
      "defaultAction": "SCMP_ACT_ERRNO",
      "syscalls": [{"names": ["read", "write", "exit", "exit_group"], "action": "SCMP_ACT_ALLOW"}]
    }
  },
  "mounts": [
    {"destination": "/proc", "type": "proc", "source": "proc"},
    {"destination": "/tmp", "type": "tmpfs", "source": "tmpfs"}
  ]
}
```

- **生命周期定义**：定义了容器的状态机——`creating → created → running → stopped`，以及每个状态的转换操作（`create`, `start`, `kill`, `delete`）。
- **文件系统标准**：定义了 rootfs 的布局、挂载点和权限要求。
- **hooks**：定义了容器创建、启动、停止前后可以注入钩子的机制。

**2. Image Specification (image-spec)**

定义容器镜像的标准格式，核心概念：

- **Manifest**（镜像清单）：描述镜像的配置和层，类似 Docker 的 manifest.json 但标准化为 OCI 格式：

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "config": {
    "mediaType": "application/vnd.oci.image.config.v1+json",
    "digest": "sha256:abc123...",
    "size": 7023
  },
  "layers": [
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:def456...",
      "size": 32654
    }
  ],
  "annotations": {
    "org.opencontainers.image.title": "myapp"
  }
}
```

- **Index**（索引）：支持多架构镜像，里面引用多个 Manifest，每个 Manifest 对应一个平台（linux/amd64, linux/arm64 等）。
- **Layer**：镜像层，格式为 tar.gz 或 tar+zstd。每一层代表文件系统的增量变化。
- **Config**：JSON 配置，包含环境变量、工作目录、entrypoint 等元数据。

**3. Distribution Specification (distribution-spec)**

定义镜像仓库的 API 接口规范，包括镜像的推送、拉取、删除、列表查询等 REST API。常见实现包括 Docker Registry、Harbor、AWS ECR、GitHub Container Registry 等。

**OCI 规范的现实意义**：因为有了 OCI 规范，所以你可以用 `docker pull` 拉取的镜像也能用 `nerdctl pull` 或 `podman pull` 拉取；用 `buildah` 构建的镜像也能在 Docker 中使用。所有工具只要实现了 OCI 规范，就是互操作的。

**验证一个镜像是否符合 OCI 规范**：

```bash
# 查看镜像的 manifest 格式
docker manifest inspect <image> --verbose

# 使用 skopeo 查看 OCI 格式
skopeo inspect docker://nginx:latest --raw | python -m json.tool

# 将镜像转为 OCI 格式（从 Docker 格式转 OCI）
docker pull nginx:latest
docker save nginx:latest -o nginx-docker.tar
# OCI 格式导出
docker buildx build --output type=oci,dest=nginx-oci.tar .
```

**追问**:
- Q: OCI Image Manifest V1 和 Docker V2 Manifest V2 有什么区别？
- Q: OCI Distribution Spec 中的 Cross-Repository Mount 是什么？有什么用？
- Q: 如何将 Docker 格式的 registry 迁移到纯 OCI 兼容的镜像仓库？

---

## Q3: runc、crun、youki 和 gVisor 这几个容器运行时有什么区别？如何为生产环境选择底层运行时？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、蚂蚁、华为

**答案要点**:
- runc 是目前使用最广的 OCI 运行时，基于 Go 开发，参考实现
- crun 用 C 语言实现，启动速度和内存占用优于 runc
- youki 用 Rust 实现，安全和性能并重，SUSE 主导
- gVisor 是一个用户态内核，不是严格意义的 OCI 运行时，提供更强的安全隔离
- Kata Containers 通过轻量级 VM 实现硬件级隔离
- 选择依据：性能需求、安全隔离需求、资源约束

**完整回答**:

先从 OCI Runtime 的分类开始。按照隔离层次，容器运行时可以分为两类：

1. **标准 OCI 运行时**：直接操作 Linux 内核的 namespace 和 cgroup。runc、crun、youki 属于这一类。
2. **基于虚拟化的运行时**：为每个容器运行一个轻量级虚拟机，提供硬件级隔离。gVisor、Kata Containers、Firecracker 属于这一类。

**runc**——Docker 默认的 OCI 运行时，Docker 公司在 2015 年捐赠给 OCI 作为参考实现，用 Go 语言编写。

生产环境最稳定，占据绝大多数市场份额。但有两个软肋：
- 启动延迟相对较高（Go 运行时初始化 + CGo 调用 libcontainer）
- 历史漏洞不少：CVE-2019-5736（runc 容器逃逸，可覆盖宿主机 runc 二进制文件）、CVE-2024-21626（runc 工作目录泄露）

```bash
# 查看当前 Docker 使用的运行时
docker info | grep "Runtimes"

# 手动指定运行时运行容器
docker run --runtime=runc nginx

# 使用  crun 作为运行时的例子
docker run --runtime=crun nginx
```

**crun**——Red Hat 开发的 C 语言 OCI 运行时，是目前最快的容器运行时。

关键优势：
- 启动速度比 runc 快约 30-50%
- 内存占用极低，适合大批量容器场景（比如 FaaS、边缘计算）
- 支持 cgroup v2 更完整
- 在 OpenShift 和 Fedora 生态中被设为默认运行时

实测数据（启动 1000 个容器）：runc 约 15 秒，crun 约 10 秒。当容器密度很高时，差距更加明显。

```bash
# 安装 crun 并在 Docker 中使用
# /etc/docker/daemon.json
{
  "runtimes": {
    "crun": {
      "path": "/usr/bin/crun"
    }
  },
  "default-runtime": "crun"
}
```

**youki**——SUSE 开发的 Rust 语言 OCI 运行时。

特点：利用 Rust 的内存安全特性从语言层面避免 runc 的 CVE-2019-5736 类型漏洞。社区还在快速迭代中，生产环境采用率目前还比较低，但在安全性敏感的场景有潜力。

**gVisor**——Google 开发的容器沙箱，严格来说不是 OCI 运行时，而是一个用户态内核。

gVisor 拦截所有系统调用，在用户空间重新实现了一个 Linux 内核（叫 Sentry）。容器中的应用认为自己运行在一个完整的 Linux 内核上，但实际上它的系统调用被 gVisor 接管并在受限的用户态执行。

- 优点：隔离性强于 namespace 隔离，不需要虚拟机硬件支持
- 缺点：系统调用拦截带来了 20-50% 的性能开销，尤其是 IO 密集型应用（文件读写、网络）
- 适用场景：多租户环境、非信任工作负载

```bash
# 使用 gVisor (runsc)
docker run --runtime=runsc nginx
```

**Kata Containers**——每个容器运行一个轻量级 VM，使用 QEMU/Cloud-Hypervisor 实现硬件虚拟化。

- 隔离性最强（真正的 VM 隔离）
- 性能损耗低于 gVisor，但仍然有 VM 启动和硬件虚拟化开销
- 适合：安全要求极高的场景（金融、政府）

**生产环境选型建议**：

| 场景 | 推荐运行时 | 理由 |
|------|-----------|------|
| 通用微服务 | runc 或 crun | 稳定，生态成熟 |
| 高密度部署（100+ 容器/节点） | crun | 低内存占用，快速启动 |
| 多租户平台（SaaS） | gVisor 或 Kata | 更强的隔离性 |
| 边缘计算/IoT | crun | 资源受限场景 |
| 金融/政府合规 | Kata Containers | 硬件级隔离 |
| CI/CD runner | runc 或 crun | 性能优先 |

**追问**:
- Q: runc 的 CVE-2019-5736 漏洞原理是什么？后来的版本是如何修复的？
- Q: crun 使用 C 语言实现，在安全性上相比 runc 的 Go 实现是优势还是劣势？
- Q: Kubernetes 如何配置使用不同的 RuntimeClass？

---

## Q4: containerd-shim 进程的作用是什么？为什么没有 shim 容器就无法实现优雅退出？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、快手、美团

**答案要点**:
- shim 是每个容器的独立守护进程，作为 containerd 和容器进程之间的中间层
- 使得 runc 可以在容器启动后退出，容器进程不依赖 containerd 存活
- 管理容器的标准 I/O 流，将 stdout/stderr 传递给 containerd
- 在容器退出时收集退出状态并报告给 containerd
- containerd v2 中 shim 功能扩展为 shim-v2，统一了接口

**完整回答**:

containerd-shim 是 Docker 架构中最容易被忽略但极其重要的组件。它在 container 创建流程中处于 containerd 和 runc 之间，每个运行中的容器对应一个 shim 进程。

**shim 的演变历史**：

在 Docker 1.11 之前，Docker Daemon 直接管理容器进程，这导致一个问题：如果 dockerd 重启、升级或崩溃，所有运行中的容器都会变成孤儿进程，控制完全丢失。

shim 的引入就是为了解决这个问题。即使在 dockerd 或 containerd 崩溃重启后，shim 仍然持有容器进程的控制权。

在 containerd 1.0 时，架构是：
```
containerd -> containerd-shim (per container) -> runc
```

containerd 2.0 之后（shim-v2）：
```
containerd -> containerd-shim-runc-v2 (per container)
```
shim-v2 将原来 shim 和 runc 的概念合并了，shim 直接实现了 OCI 运行时接口，减少了进程间通信的开销。

**shim 的核心职责**：

1. **生命周期分离**：当 containerd 调用 runc 启动容器后，runc 立即退出。此时容器进程被 shim "收养"成为子进程。即使 containerd 宕机，shim 还在，容器不受影响。这是最核心的设计原则——"控制平面不应影响数据平面"。

2. **IO 管理**：容器中的 stdout/stderr 通过管道连接到 shim，shim 再将 IO 转发给 containerd。如果 IO 驱动是 json-file 或 journald，containerd 会负责写入日志文件或 journal。shim 在这里起到了 IO 缓冲的作用。

3. **退出状态收集**：容器进程退出时，内核通知 shim（父进程），shim 收集退出码，然后通过 gRPC 报告给 containerd。如果没有 shim，容器退出后无法正常报告它的退出状态。

4. **信号转发**：当你执行 `docker stop` 时，流程是这样的：
```
docker stop → dockerd → containerd → shim → 容器进程
```
shim 负责将 SIGTERM 转发给容器内的 PID 1 进程。

**排障场景**：

```bash
# 验证 shim 的存在
# runc 退出了，但 shim 还在
ps aux | grep shim

# 查看容器的 shim 进程和容器进程的关系
# 找到容器 PID
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' <container>)
# 查看父进程链
ps -o pid,ppid,comm -p $CONTAINER_PID

# 模拟 containerd 重启
docker stop <container>
systemctl restart containerd
docker start <container>
# 如果 containerd 无法重启，手动清理残留 shim
```

**一个常见的面试陷阱**："如果 containerd 被 `kill -9` 了，容器还能运行吗？"

答案是：容器仍然运行。因为容器进程的父进程是 shim，而 shim 是独立于 containerd 的进程。containerd 挂了不会影响 shim 和容器的运行。但此时 `docker ps` 无法工作（因为 dockerd 依赖 containerd），不过容器内的服务依然正常提供。

**追问**:
- Q: containerd v2 的 shim-v2 和 v1 相比，有哪些主要变化？
- Q: 大量容器运行时，shim 进程本身会成为资源瓶颈吗？如何优化？
- Q: 在不重启容器的情况下如何升级 containerd 版本？

---

## Q5: Docker 的 REST API 和 containerd 的 gRPC 接口分别在架构中扮演什么角色？为什么不同层选择不同的通信协议？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里巴巴、腾讯、百度

**答案要点**:
- Docker CLI 和 dockerd 之间使用 REST API (HTTP + Unix Socket)
- dockerd 和 containerd 之间使用 gRPC
- containerd 内部组件之间使用 ttRPC (Twirp 变体)
- REST 适合对外暴露的 API，更通用、更易调试
- gRPC 适合内部组件通信，性能更高、支持流式调用

**完整回答**:

Docker 架构中不同层次的通信协议选择反映了它们不同的设计目标和约束。

**第一层：Docker CLI ↔ dockerd — REST API over Unix Socket**

用户执行 `docker ps` 时，CLI 发起的是一个 HTTP REST 请求：

```
GET http://localhost/v1.41/containers/json HTTP/1.1
Host: localhost
```

实际通过 `/var/run/docker.sock` 这个 Unix Domain Socket 传输。可以用 curl 直接调用来验证：

```bash
# 直接用 curl 调用 Docker API（比 docker 命令更底层）
curl --unix-socket /var/run/docker.sock http://localhost/v1.41/version
curl --unix-socket /var/run/docker.sock http://localhost/v1.41/containers/json?all=true

# 监听 API 调试日志
dockerd --debug
```

为什么选择 REST 而不是 gRPC？主要原因是：
- REST API 可以通过 HTTP 工具（curl、Postman、浏览器）直接调试，降低使用门槛
- Docker API 的消费者非常广泛（CLI、SDK、Kubernetes、CI 工具），REST 是通用性最好的接口协议
- API 版本化方便（`/v1.41/` 的路径级版本控制）
- 不需要客户端代码生成，任何语言都能直接发起 HTTP 请求

**第二层：dockerd ↔ containerd — gRPC**

dockerd 内部通过 containerd 客户端库调用 containerd 的 gRPC 接口：

```go
// containerd client 示例
client, _ := containerd.New("/run/containerd/containerd.sock")
container, _ := client.NewContainer(ctx, "nginx",
    containerd.WithImage(image),
    containerd.WithNewSnapshot("nginx-snapshot", image),
)
task, _ := container.NewTask(ctx, cio.NewCreator())
task.Start(ctx)
```

gRPC 的优势在这里非常明显：
- **性能**：基于 HTTP/2 多路复用，单连接能承载大量并发请求。在高频的容器状态查询场景，HTTP/2 的流复用大幅减少了连接建立开销。
- **强类型接口**：通过 Protocol Buffers 定义接口，生成严格的类型检查代码。这对于复杂的容器操作接口（CreateContainerRequest 包含几十个字段）来说，使用 Protobuf 比手写 JSON 序列化可靠得多。
- **流式通信**：`docker logs -f`、`docker events` 这类需要持续数据流的操作，gRPC 的服务端流式调用比 REST 的 long-polling 优雅得多。
- **双向流**：`docker exec -it` 需要双向实时交互（终端输入和输出），gRPC 的双向流完美支持。

验证 containerd 的 gRPC 调用：

```bash
# 使用 grpcurl 直接调用 containerd 的 gRPC API
grpcurl -unix /run/containerd/containerd.sock list

# 查看可用的服务
grpcurl -unix /run/containerd/containerd.sock \
  containerd.services.containers.v1.Containers/List

# 列出 containerd 管理的容器
grpcurl -unix /run/containerd/containerd.sock \
  -d '{}' containerd.services.containers.v1.Containers/List
```

**第三层：containerd 内部组件之间 — ttRPC**

containerd 内部（如 content store、snapshotter、metadata store 之间）使用 ttRPC（基于 Twirp 的轻量 RPC 框架）。ttRPC 比 gRPC 更轻量，不需要完整的 HTTP/2 和 gRPC 中间件栈，适合进程内或本机通信。

**生产启示**：

理解这些协议分层对排查问题有实际帮助：

```bash
# 如果 docker 命令挂了但容器还在跑
# 1. 先测试 Docker REST API
curl --unix-socket /var/run/docker.sock http://localhost/v1.41/_ping

# 2. 再测试 containerd gRPC
ctr version

# 3. 判断哪一层出了问题
# REST API 不通但 containerd 正常 -> dockerd 问题
# containerd 也不通 -> containerd 或底层问题
```

**追问**:
- Q: Docker API 的版本协商机制是怎样的？客户端和服务端版本不一致时如何处理？
- Q: containerd 为什么从 gRPC 转向了一部分 ttRPC？这对性能有什么影响？
- Q: Kubernetes 的 CRI（Container Runtime Interface）使用的是 gRPC 还是 REST？为什么？

---

## Q6: Rootless Docker 的实现原理是什么？和传统 rootful 模式相比有哪些关键差异和限制？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、蚂蚁集团、网易

**答案要点**:
- Rootless 模式让 Docker Daemon 和容器都在非 root 用户下运行
- 核心依赖：user namespace 映射、newuidmap/newgidmap、slirp4netns 网络
- 先决条件是内核支持 user namespace 和 `/etc/subuid` 配置
- 主要限制：cgroup 支持不完整、端口 < 1024 不能绑定、overlayfs 受限
- 安全优势是容器逃逸后攻击者拿到的是非 root 用户的权限

**完整回答**:

Rootless Docker 是在 Docker 19.03 中引入的实验性特性，在 Docker 20.10 中 GA。核心思想：让整个 Docker 栈——包括 dockerd、containerd、shim 和容器进程本身——都在非 root 用户下运行。

**实现原理**：

Rootless 模式最关键的技术基础是 Linux user namespace。User namespace 允许一个非 root 用户在自己的 namespace 中"假装成 root"（即 UID 0 within the namespace），但这个"root"在宿主机的视角下仍然是一个普通用户（UID 1000 之类的）。

具体的多级映射关系：

1. **宿主机 UID 1000** 在 dockerd 的 user namespace 中被映射为 UID 0（root）
2. 在这个 user namespace 中创建的子 namespace，进一步映射容器内的 UID 0

所以整个链条是：
```
宿主机 UID 1000 -> dockerd user ns UID 0 -> 容器 user ns UID 0
```

配置上需要三个部分：

```bash
# 1. 配置 /etc/subuid 和 /etc/subgid
# 这两个文件定义了用户可用的子 UID/GID 范围
# 格式：<用户名>:<起始UID>:<数量>
echo "todd:100000:65536" | sudo tee -a /etc/subuid
echo "todd:100000:65536" | sudo tee -a /etc/subgid

# 2. 安装必要的用户态工具
sudo apt install uidmap dbus-user-systemd slirp4netns

# 3. 安装 Rootless Docker（不启动系统级别的 dockerd）
dockerd-rootless-setuptool.sh install
```

**网络实现**：

rootless 模式不能直接操作 iptables 创建 DNAT 规则（需要 root 权限），所以端口映射通过 `slirp4netns` 实现——一个用户态网络协议栈。基本原理：

```bash
# slirp4netns 在宿主机上创建一个 tap 设备
# 容器内的网络流量通过这个 tap 设备经过 slirp4netns 转换成用户态的 socket 操作
# 实现 -p 8080:80 时，slirp4netns 在宿主机上监听 8080 端口
# 接收到的流量通过用户态协议栈转发到容器内的 80 端口
```

这意味着 rootless 模式的网络性能比 rootful 模式低约 10-15%，因为多了用户态协议栈的转换。

**存储实现**：

rootless 模式下，`/var/lib/docker` 不能使用（需要 root 权限），所有数据存储在 `~/.local/share/docker/`。Overlayfs 在 rootless 模式中受限制——默认退回到 `fuse-overlayfs` 或 `native` snapshotter：

```bash
# 查看 rootless docker 的存储位置
ls -la ~/.local/share/docker/
# 查看使用的存储驱动
docker info | grep "Storage Driver"
```

**关键限制**：

```bash
# 1. 无法绑定 < 1024 的端口（这是特权端口）
docker run -p 80:80 nginx  # 会失败！
# 解决：使用 iptables 重定向或在宿主机用 socat 转发
sudo socat TCP-LISTEN:80,fork,reuseaddr TCP:127.0.0.1:8080

# 2. Cgroup 功能受限
# rootless 模式下默认无法设置 --cpus、--memory 等 cgroup 限制
# 需要 cgroup v2 + systemd 委派
# 验证：
docker run --rm -m 100m alpine echo "will work in cgroup v2"

# 3. Overlay2 存储驱动不可用
# 自动退回到 fuse-overlayfs 或 vfs
docker info | grep "Storage Driver"  # 通常显示 fuse-overlayfs

# 4. AppArmor、SELinux 等安全模块受限
# 5. --privileged 模式在 rootless 中无实际效果
```

**生产适用性评估**：

Rootless Docker 在以下场景中表现出色：
- 开发者个人环境（不希望 sudo）
- 多租户 CI/CD 系统（每个用户运行自己的 Docker 实例）
- 受限环境（像 OpenShift 这种不允许 root 容器的平台）

但在以下场景中还不适合：
- 高性能网络场景（slirp4netns 的性能损失）
- 需要精确资源控制（cgroup 限制不完整）
- 需要实现在宿主机上监听特权端口的服务

**追问**:
- Q: Rootless Docker 中 `userns-remap` 模式和完全的 rootless 模式有什么区别？
- Q: Cgroup v2 对 rootless 模式有什么改善？为什么 cgroup v2 更适合 rootless？
- Q: Podman 的 rootless 模式和 Docker rootless 实现有什么本质差异？

---

## Q7: Docker 和 Podman 在架构设计上有哪些本质区别？Podman 的 "daemonless" 架构带来了哪些实际问题？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、华为、小米

**答案要点**:
- Docker 采用 C/S 架构（dockerd daemon + CLI），Podman 采用 fork/exec 无守护进程架构
- Podman 不依赖中心化 daemon，每个容器操作直接由 CLI 进程处理
- Podman 原生支持 rootless（不需要像 Docker 那样单独安装配置）
- Docker 的 daemon 模式提供统一管理但也引入单点故障
- Podman 和 Docker 都遵循 OCI 标准，镜像和容器可以互换使用
- Podman 通过 Pod 概念更能模拟 Kubernetes 的编排行为

**完整回答**:

先从架构差异讲起，这是核心区别。

**Docker 的 C/S 架构**：

```
docker CLI → REST API → dockerd (daemon) → containerd → shim → runc
```

Docker CLI 只是一个 HTTP 客户端，所有的容器生命周期管理、镜像管理、网络管理都由 dockerd 这个中央 daemon 完成。这意味着：

- 所有 `docker` 命令必须经过一个中心化进程
- dockerd 负责维持所有容器的状态
- 重载 dockerd 配置需要重启 daemon，会影响管理能力（虽然容器不挂）
- dockerd 出现 Bug 导致 OOM 或 hang 时，所有 `docker` 命令都无法响应

**Podman 的 fork/exec 架构**：

```
podman run → podman CLI (fork) → conmon (per container) → runc/crun
```

Podman 没有 daemon。当你执行 `podman run` 时，CLI 进程直接 fork 出容器进程，一个轻量级的 `conmon` 进程（类似 containerd-shim）负责监控容器的 IO 和状态。CLI 进程在启动完成后退出。

这意味着：

- 不需要常驻的后台进程，降低资源占用
- 没有中心化 gateway，每个命令独立处理
- 配合 systemd，可以让 systemd 直接管理容器生命周期
- 用户级 systemd 可以实现开机自启动容器，不需要 sudo

```bash
# Podman 配合 systemd 管理容器
# 生成 systemd unit 文件
podman generate systemd --new --name mycontainer > ~/.config/systemd/user/container-mycontainer.service

# 作为用户服务启动
systemctl --user daemon-reload
systemctl --user enable container-mycontainer.service
systemctl --user start container-mycontainer.service
# 重启后也自动启动
loginctl enable-linger $USER
```

**Rootless 体验差异**：

Docker 的 rootless 需要额外安装和配置（uidmap、slirp4netns 等），并且需要单独运行 `dockerd-rootless`。Podman 原生支持 rootless：

```bash
# Podman rootless 开箱即用
podman run --rm hello-world
# 不需要安装任何额外的包（在大多数现代发行版上）

# 验证确实是以非 root 运行
podman info | grep rootless
```

**Pod（Pod）概念的差异**：

Podman 支持 Pod 概念（直接将 Kubernetes 的 Pod 语义带入）：

```bash
# 创建一个 pod（共享 network 和 pid namespace）
podman pod create --name mypod -p 8080:80

# 在 pod 中启动容器
podman run -d --pod mypod --name nginx nginx
podman run -d --pod mypod --name sidecar sidecar:latest

# 两个容器共享网络栈，通过 localhost 互访
# 更接近 K8s 中的 Pod 行为
podman exec nginx curl http://localhost:<sidecar-port>
```

Docker Compose 可以通过 `network_mode: "service:xxx"` 实现类似效果，但语法和使用方式不如 Podman 的 Pod 概念直观。

**兼容性层：Podman 的 Docker CLI 别名**：

Podman 提供了 Docker CLI 兼容模式：

```bash
# 设置别名后，可以用 docker 命令操作 Podman
alias docker=podman
# 或者配置 system 级别的别名
sudo dnf install podman-docker
```

绝大多数 `docker` 命令在 Podman 中兼容。有些微妙的差异需要注意：

```bash
# Docker 有 docker buildx，Podman 使用 buildah 提供构建功能
# 某些 docker-compose 特性在 podman-compose 中不支持

# 日志位置不同
# Docker: /var/lib/docker/containers/<id>/*-json.log
# Podman: ~/.local/share/containers/storage/<id>/userdata/
```

**Docker 的优势**：

- 生态最完整：几乎所有 CI/CD、监控、编排工具都优先支持 Docker
- Docker Compose 成熟度高，Podman Compose 还在追赶
- Docker Swarm 模式提供简单的集群编排能力
- 企业级支持（Docker Enterprise 虽然停售了但 Docker Desktop 有商业版）

**Podman 的优势**：

- 安全性：无 daemon + 原生 rootless = 攻击面更小
- 更适合 systemd 生态：容器可以作为 systemd 服务管理
- 更适合 Red Hat/CentOS/Fedora 生态（Red Hat 主导开发）
- Pod 概念更方便本地调试 K8s 工作负载

**迁移考量**：

从 Docker 迁移到 Podman 需要关注的点：

```bash
# 1. 网络：Podman 默认使用 slirp4netns，推荐改用 pasta（更新、性能更好）
podman run --network=pasta nginx

# 2. Volume 挂载：SELinux 标签处理不同
podman run -v /host:/container:Z nginx  # :Z 自动设置 SELinux 标签

# 3. 日志查看
podman logs --tail 100 <container>

# 4. 构建镜像
podman build -t myimage .
# 或者用 buildah（更灵活）
buildah bud -t myimage .
```

**追问**:
- Q: Podman 的 conmon 和 Docker 的 containerd-shim 功能定位有什么异同？
- Q: 在 CI/CD 中使用 Podman 代替 Docker 可能遇到哪些坑？
- Q: Podman 的 Machine 子系统和 Docker Desktop 的工作原理有什么不同？
