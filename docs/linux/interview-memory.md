---
id: interview-memory
title: 内存管理面试题
description: Linux 内存管理高频面试题，涵盖 HugePages、mmap、Page Cache、Swap、NUMA、cgroup 内存等真实面试场景
---

# Linux 内存管理面试题

## Q1: 透明大页（THP）对数据库应用有什么影响？生产环境中应该怎么配置 HugePages？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- 传统 4KB 页表项过多导致 TLB Miss 频繁，HugePages 用 2MB/1GB 大页减少页表项
- THP 由内核后台自动合并 4KB 页为 2MB 大页，但可能引入内存分配延迟和碎片问题
- 数据库场景（MySQL/PostgreSQL/Redis）强烈建议关闭 THP
- 手动配置 HugePages 需要预留连续内存，适用于有确定性内存需求的场景

**完整回答**:

先讲清楚为什么需要大页。现代服务器内存容量动辄几百 GB，如果使用传统的 4KB 页大小，页表本身就会占用大量内存。假设一个进程占用了 256GB 内存，仅进程级的页表就需要约 512MB。更重要的是，CPU 的 TLB 容量有限，如果 TLB 无法覆盖进程的工作集，每次内存访问都会发生 TLB Miss，导致性能严重下降。HugePages 将页表项放大到 2MB 或 1GB，同样的 TLB 容量可以覆盖更大的内存区域，显著降低 TLB Miss。

**透明大页（THP）的问题**：

THP 是内核自动将 4KB 页合并为 2MB 大页的机制，初衷是"让应用无感受益"。但在生产环境中，THP 经常带来严重问题：

- **内存分配延迟**：THP 需要分配连续的 2MB 物理内存，在内存碎片严重时，kswapd 需要做内存规整（compaction），这个过程可能耗时数百毫秒甚至秒级。在延迟敏感的服务中，这会造成明显的响应毛刺。
- **内存浪费**：有些应用只用了大页中的一小部分，但整页都被锁定在内存中。
- **数据库性能下降**：MySQL/PostgreSQL 对内存分配延迟极其敏感。Percona 和 MariaDB 官方文档都明确建议关闭 THP。实际案例中，某电商平台的 MySQL 集群开启 THP 后，偶尔出现几十毫秒的查询延迟尖刺，关闭后消失。

```bash
# 检查当前 THP 状态
cat /sys/kernel/mm/transparent_hugepage/enabled
# 输出通常为: [always] madvise never
# 方括号表示当前模式

# 临时关闭
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag

# 永久关闭——推荐通过内核启动参数
# 编辑 /etc/default/grub，在 GRUB_CMDLINE_LINUX 添加:
# transparent_hugepage=never
# 然后 update-grub 重启

# 或通过 systemd service（可热生效）
# /etc/systemd/system/disable-thp.service
[Unit]
Description=Disable Transparent Hugepages
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled && echo never > /sys/kernel/mm/transparent_hugepage/defrag'
RemainAfterExit=true

[Install]
WantedBy=multi-user.target
```

**手动配置 HugePages**（适用于明确知道内存需求的场景，如 DPDK、Oracle DB、Redis 企业版）：

```bash
# 查看当前 HugePages 配置
cat /proc/meminfo | grep -E "HugePages|Hugepage"
# HugePages_Total: 预留的大页总数
# HugePages_Free: 空闲的大页
# Hugepagesize: 大页大小（通常是 2048 kB）

# 预留 1024 个 2MB 大页（共 2GB）
echo 1024 > /proc/sys/vm/nr_hugepages

# 永久配置
# /etc/sysctl.d/hugepages.conf
vm.nr_hugepages = 1024
```

MySQL 8.0 支持 `large_pages=ON` 参数自动使用 HugePages。PostgreSQL 也支持配置 `huge_pages=on`。

**追问**:
- Q: THP 的 defrag 参数（always/madvise/never）有什么区别？生产环境中建议怎么配置？
- Q: HugePages 在 Kubernetes 环境中怎么使用？Pod 如何通过 resources 字段申请大页？
- Q: 除了大页，还有哪些降低 TLB Miss 的机制？MAP_HUGETLB 是什么？

---

## Q2: mmap 和传统的 read/write 系统调用在底层实现上有什么区别？实际开发中如何选择？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 腾讯、阿里、字节跳动

**答案要点**:
- read/write 需要在内核缓冲区和用户缓冲区之间用 copy_to_user 拷贝数据
- mmap 通过缺页机制将文件页直接映射到进程地址空间，减少一次拷贝
- mmap 适用于大文件随机访问和进程间共享，小文件顺序读时 read/write 更优
- mmap 需要处理 SIGBUS 信号防止文件截断导致的访问异常

**完整回答**:

这个问题的核心在于理解"零拷贝"的思想和缺页机制。

**read/write 的路径**：

调用 `read(fd, buf, 4096)` 时，内核路径如下：
- 发起系统调用，从用户态切换到内核态
- 内核检索 page cache，如果命中则将数据从 page cache 通过 copy_to_user 拷贝到用户缓冲区
- 如果 page cache 未命中，发起磁盘 IO 将数据读入 page cache，再拷贝到用户缓冲区
- 系统调用返回，切换回用户态

这里至少有一次内核态到用户态的数据拷贝（从 page cache 到用户缓冲区）。如果同时用 write() 写到 socket，还需要再拷贝一次到 socket 缓冲区。

**mmap 的路径**：

调用 `mmap(addr, length, PROT_READ, MAP_SHARED, fd, offset)` 时：
- 进程的虚拟地址空间中分配一段 VMA（Virtual Memory Area），此时还没有实际分配物理内存
- 当进程访问映射区域时触发缺页中断（page fault），内核从磁盘读取数据并建立页表映射
- 后续访问直接通过页表访问物理内存，不再涉及系统调用和数据拷贝

**关键差异**：

- **数据拷贝次数**：mmap 减少了一次内核态到用户态的数据拷贝。数据从磁盘到物理内存后，用户进程直接访问同一块物理内存（MAP_SHARED 模式）。
- **系统调用开销**：read() 每次调用都涉及系统调用上下文切换。mmap 只有第一次缺页时有开销，后续访问不涉及系统调用。
- **内存占用**：mmap 占用的页无法被内核轻易回收（除非通过 madvise 提示）。read() 读取后内存可被内核回收。
- **文件大小变化**：mmap 映射的文件如果被截断（truncate），访问超出新文件大小的区域会触发 SIGBUS，需要注册信号处理函数保护。
- **同步问题**：mmap MAP_SHARED 写操作缺页时会触发写时复制或直接在原始页写入，多个进程共享时需要考虑同步。

**实际场景选择**：

- **大文件随机读取（数据库、K/V 存储）**：用 mmap。RocksDB、LevelDB 大量使用 mmap 管理 SST 文件，Elasticsearch 也使用 mmap 映射倒排索引。
- **小文件顺序读取（日志处理、Web 静态文件）**：用 read/write。简单直接，不需要处理缺页异常和信号。
- **进程间共享数据**：用 mmap MAP_SHARED。比 System V shm 更通用，可以持久化到文件。
- **网络传输场景**：优先考虑 sendfile()。它是比 mmap+write 更高效的零拷贝方式，直接从 page cache 到 socket 缓冲区，不需要经过用户空间。

**生产案例**：某次 ES 集群频繁 OOM，排查发现 ES 使用 mmap 映射倒排索引文件，mmap 占用大量 RSS。ES 默认的 `bootstrap.memory_lock` 未开启，内核虽然在后台回收 mmap 页，但回收不及时导致内存压力持续升高。解决方案是调大 `vm.max_map_count` 并开启 memory_lock 锁住堆内存。

**追问**:
- Q: mmap 在 MAP_SHARED 和 MAP_PRIVATE 下的写时复制行为有什么区别？
- Q: sendfile()、splice() 和 mmap+write 相比各有什么优劣？
- Q: Java 中的 MappedByteBuffer 底层也是 mmap 实现的，有什么限制？

---

## Q3: Linux Page Cache 的写回机制是怎样的？生产环境中如何调优 dirty page 参数？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、拼多多、快手

**答案要点**:
- 写操作不直接写磁盘，先写入 Page Cache 标记为 dirty
- flusher 线程周期性将 dirty page 写回磁盘，由水位线和超时共同驱动
- 关键参数：dirty_background_ratio、dirty_ratio、dirty_expire_centisecs、dirty_writeback_centisecs
- 突发写入时 dirty_ratio 设置过高会导致同步刷盘阻塞

**完整回答**:

**Page Cache 写回机制**：

Linux 的写操作是"延迟写"的。当进程调用 write() 时：
- 数据从用户缓冲区拷贝到内核的 Page Cache
- 对应的 page 被标记为 dirty
- write() 系统调用返回成功（数据实际还在内存中）
- 后台 flusher 线程在适当时机将 dirty page 刷入磁盘

**Flusher 线程的触发条件**：

- **定时触发**：`dirty_writeback_centisecs`（默认 500，即 5 秒），flusher 线程周期性唤醒。
- **过期触发**：dirty page 在内存中停留超过 `dirty_expire_centisecs`（默认 3000，即 30 秒），下次 flusher 运行时会强制刷入磁盘。
- **水位触发**：
  - `dirty_background_ratio`（默认 10%）：dirty page 占总内存的比例达到此值时，后台 flusher 线程开始异步刷盘，不阻塞进程。
  - `dirty_ratio`（默认 20%）：dirty page 比例达到此值时，进程自己的 write() 调用会被阻塞，同步刷盘，直到 dirty 比例降低。

```bash
# 查看当前 dirty page 状态
cat /proc/meminfo | grep -E "^(Dirty|Writeback)"
# Dirty: 当前脏页大小（kB）
# Writeback: 正在写回的大小（kB）

# 查看全部相关内核参数
sysctl -a | grep dirty
```

**生产环境调优实践**：

**场景 1：数据库服务器（MySQL/PostgreSQL）**

数据库通常有自己的事务日志和 redo log 机制，不需要内核帮它缓存写入。建议降低 dirty 阈值：

```bash
# /etc/sysctl.d/db-tuning.conf
vm.dirty_background_ratio = 3
vm.dirty_ratio = 10
vm.dirty_expire_centisecs = 500
vm.dirty_writeback_centisecs = 100
```

**场景 2：文件服务器/NFS**

大文件传输场景，希望利用 Page Cache 合并写入以提高吞吐：

```bash
vm.dirty_background_ratio = 20
vm.dirty_ratio = 50
```

**场景 3：使用 O_DIRECT 的应用**

如果应用使用 Direct IO（如 InnoDB 的 `innodb_flush_method=O_DIRECT`），数据绕过 Page Cache 直接写入磁盘。但系统整体的脏页管理仍受这些参数影响。

**真实案例**：

某次大促活动中，一个容器化服务突然出现 write() 调用大量超时。排查发现 dirty page 达到 dirty_ratio（默认 20%）阈值后，进程陷入同步刷盘。宿主机的内存是 256GB，dirty_ratio 对应的 dirty 上限约 51GB——当 51GB 的脏页需要一次性刷入磁盘时，磁盘 IO 根本扛不住，IO 延迟从 2ms 飙升到 500ms+。最终将 dirty_ratio 调低到 5%，同时限制容器内存上限为 8GB，问题解决。

**追问**:
- Q: dirty_ratio 和 dirty_bytes 有什么区别？在内存特别大的机器上应该用哪个？
- Q: 内核 5.10+ 的 writeback 机制有什么变化？cgroup v2 如何影响 writeback？
- Q: O_DIRECT 和 O_SYNC 有什么区别？分别绕过 Page Cache 的哪个阶段？

---

## Q4: Linux 的 Swap 机制是怎么工作的？生产环境中到底该不该开启 Swap？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、美团

**答案要点**:
- Swap 将不活跃的匿名页换出到磁盘，释放物理内存给 Page Cache 或其他活跃进程
- kswapd 在内存低于水位线时异步换页，直接内存回收在内存严重不足时同步阻塞
- swappiness 控制内核倾向回收 Page Cache 还是 swap 匿名页
- 延迟敏感服务建议关闭或限制 swap，批处理场景可以保留

**完整回答**:

**Swap 的工作流程**：

内核有两个"内存消费者"：匿名页（进程的堆、栈、数据段）和文件页（Page Cache）。当内存压力增大时，内核选择回收哪部分：

- **回收文件页**：干净的 page cache 直接丢弃，脏页写回后丢弃。代价低，需要时可以从磁盘重新读取。
- **回收匿名页**：将匿名页写入 swap 分区后释放物理内存，读取时再换入。代价高，因为涉及磁盘 IO。

**触发 Swap 的时机**：

内核维护着三个内存水位线（通过 `/proc/zoneinfo` 查看）：
- **pages_min**：最低水位。到达此水位只有直接内存回收（direct reclaim）可以分配内存，进程会被阻塞。
- **pages_low**：低水位。kswapd 内核线程开始异步回收。
- **pages_high**：高水位。kswapd 回收到此水位后休眠。

当 free 内存低于 pages_low 时，kswapd 被唤醒，优先回收 clean page cache，如果不够再考虑 swap 匿名页。

**swappiness 参数**：

```bash
cat /proc/sys/vm/swappiness
# 默认 60，范围 0-200

# 修改
sysctl -w vm.swappiness=10
```

swappiness 的值常常被误解——它不是"使用 swap 的概率"，而是影响匿名页和文件页回收倾向的系数：
- swappiness=0：极端情况下才 swap（注意内核 5.8+ 之后 0 的含义变成了完全禁止匿名页 swap）
- swappiness=10-30：优先回收文件页，仅在必要时 swap
- swappiness=60（默认）：均衡策略
- swappiness=100：积极使用 swap

**生产环境实践**：

**延迟敏感服务（数据库、Redis、API Server）**：

```bash
# 建议限制 swap 使用
vm.swappiness = 1

# 或者直接关闭 swap
swapoff -a

# 永久关闭 swap：注释 /etc/fstab 中的 swap 条目
```

原因：Swap 的 IO 延迟在毫秒级别，对于 Redis 这类亚毫秒级响应的服务，一次 swap 就可能造成请求超时。数据库的 buffer pool 如果被 swap 出去，性能会断崖式下跌。

**批处理/离线计算场景**：

可以保留 swap。批处理任务可以容忍一定延迟，允许不活跃的匿名页被 swap 出去，让文件页使用更多内存。

**zram 和 zswap**：
- **zram**：在内存中分配压缩块作为 swap 设备。适合内存较小的场景，换出数据被压缩存储在内存中。
- **zswap**：介于 page cache 和磁盘 swap 之间的压缩缓存。换出的页面先压缩存储在内存中，如果内存压力继续增大才真正写入磁盘。
- **选择**：zram 适合内存捉襟见肘的场景，zswap 适合有 swap 但希望减少磁盘 IO 的场景。

**追问**:
- Q: Swap 和 OOM Killer 的关系是什么？什么情况下 OOM Killer 比 swap 先触发？
- Q: NUMA 环境下 Swap 有什么特殊考虑？zone_reclaim_mode 是什么？
- Q: /proc/meminfo 中的 Committed_AS 是什么指标？它和 swap 有什么关系？

---

## Q5: 什么是 NUMA？在多 NUMA 节点服务器上，内存分配有什么需要注意的？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- NUMA 将 CPU 和内存划分为多个节点（Node），访问本地内存延迟远低于远程内存
- 默认分配策略可能导致内存分配不均匀，Node 0 内存可能先被耗尽
- numactl 控制内存和 CPU 亲和性，numastat 监控跨节点访问
- 数据库场景中跨 Node 内存访问会显著影响性能

**完整回答**:

**NUMA 的背景**：

早期的多 CPU 系统使用 UMA 架构，所有 CPU 通过共享内存总线访问同一个内存控制器。但随着 CPU 核心数增加，内存总线成为瓶颈。NUMA 将 CPU 和内存划分为多个节点（Node），每个 Node 有自己的内存控制器。CPU 访问本地 Node 内存最快，访问远程 Node 内存需要跨 QPI/UPI 总线。在 4 Node 的服务器上，远程访问延迟可能是本地的 1.5-2 倍。

```bash
# 查看 NUMA 拓扑
lscpu | grep -i numa
# NUMA node(s):        2
# NUMA node0 CPU(s):   0-15
# NUMA node1 CPU(s):   16-31

# 查看每个节点的内存
numactl --hardware
# available: 2 nodes (0-1)
# node 0 size: 128 GB
# node 1 size: 128 GB

# 查看当前策略
numactl --show
```

**常见问题**：

- **Node 0 内存耗尽**：多数进程默认在 Node 0 上启动，内存优先从 Node 0 分配。Node 0 耗尽后进程被迫使用 Node 1 内存，但此时已出现性能下降。
- **分配不均**：使用默认策略且未设置 CPU 亲和性，可能出现 Node 0 内存使用率 90% 而 Node 1 只有 30%。

```bash
# 查看跨节点访问统计
numastat
#                   node0           node1
# numa_hit         1000000          800000
# numa_miss          50000          200000    <- 跨节点分配
# numa_foreign      200000           50000
# local_node       950000          600000
# other_node         50000         200000    <- 远程访问
```

numa_miss 和 other_node 过高说明跨节点访问频繁，内存延迟会增加。

**生产环境优化方案**：

```bash
# 1. 绑定 CPU 和内存到同一 Node（数据库场景推荐）
numactl --cpunodebind=0 --membind=0 ./my-database

# 2. 交错分配——HPC/计算密集型
# 所有 Node 轮询分配，最大化带宽但不保证本地性
numactl --interleave=all ./my-app

# 3. systemd service 中设置
[Service]
CPUAffinity=0-15
NUMAPolicy=bind
NUMAMask=0
```

**数据库场景**：

MySQL/PostgreSQL 是多线程架构，所有线程共享 buffer pool。当线程在 Node 1 上运行而访问 Node 0 内存中的数据时，发生跨节点访问。常见的做法是：

- 小规模实例：使用 `numactl --interleave=all` 让内存均匀分布在所有节点上，避免某个 Node 内存耗尽触发跨节点分配。
- 大规模部署：一个物理机只运行一个数据库实例，绑定到所有 Node 并启用 interleave。
- 容器化方案：一个 Node 一个数据库实例，每个实例绑定到单个 NUMA Node。

**内核 NUMA 平衡**：

`/proc/sys/kernel/numa_balancing` 控制内核是否自动迁移页面到访问它的线程所在的 Node。默认启用（1），但在某些场景下（如数据库），NUMA 自动平衡可能带来额外的性能开销，建议评估后决定。

**追问**:
- Q: KVM 虚拟化中怎么配置 vCPU 的 NUMA 亲和性？如何避免虚拟机跨 Node 访问？
- Q: Kubernetes Topology Manager 是怎么处理 NUMA 的？和 CPU Manager 如何配合？
- Q: zone_reclaim_mode 这个参数有什么用？什么场景下需要开启？

---

## Q6: cgroup 内存限制是如何实现的？当进程超过 memory.limit_in_bytes 时会发生什么？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、腾讯、滴滴

**答案要点**:
- cgroup memory controller 通过 memcg 子系统跟踪和限制进程组的内存使用
- memory.limit_in_bytes 设置硬限制，超过后触发 cgroup 内部 OOM 或进程被阻塞
- memory.soft_limit_in_bytes 是软限制，只在系统整体内存压力下生效
- 内存计费包含 RSS + Page Cache + swap，内核内存需要单独限制

**完整回答**:

**cgroup v1 内存子系统**：

在 cgroup v1 中，每个 cgroup 有独立的 memcg 实例跟踪组内所有进程的内存使用：

```bash
# 创建一个内存限制为 512MB 的 cgroup
mkdir -p /sys/fs/cgroup/memory/myapp
echo 536870912 > /sys/fs/cgroup/memory/myapp/memory.limit_in_bytes
echo $$ > /sys/fs/cgroup/memory/myapp/tasks
```

**超过限制后的行为**：

当 cgroup 内进程的内存使用达到 limit_in_bytes 时，内核的处理流程如下：
- 内核尝试回收内存：清理 Page Cache、swap 匿名页
- 如果回收后仍然无法满足分配请求
- 触发 cgroup 级别的 OOM Killer，杀死 cgroup 内 oom_score 最高的进程
- 如果 oom_control 中设置了 oom_kill_disable=1，进程会被挂起（throttled）等待内存释放

```bash
# 查看 OOM 控制状态
cat /sys/fs/cgroup/memory/myapp/memory.oom_control
# oom_kill_disable 0    <- 0 表示允许 OOM Kill
# under_oom 0           <- 当前是否处于 OOM 状态
# oom_kill 5            <- 累计被杀死的进程数
```

**内存计费范围**：

在 cgroup v1 中：
```
memory.usage_in_bytes = RSS + Page Cache + swap
```

这里有一个重要的问题：Page Cache 是重复计费的（double charging）。如果两个 cgroup 中的进程读取同一个文件，该文件的 Page Cache 在两个 cgroup 中各计算一次。这会导致 `usage_in_bytes` 之和可能超过实际物理内存。这是 v1 的设计缺陷，v2 已修复。

**实际排查命令**：

```bash
# 查看 cgroup 内存详情
cat /sys/fs/cgroup/memory/myapp/memory.stat

# 关键指标说明
# cache: Page Cache 大小
# rss: 匿名页（堆+栈）
# rss_huge: 大页 RSS
# mapped_file: mmap 文件大小
# swap: swap 使用量
# active_anon / inactive_anon: 活跃/非活跃匿名页
# active_file / inactive_file: 活跃/非活跃文件页
# pgfault / pgmajfault: 缺页次数/主缺页次数
```

**生产环境注意事项**：

- **限制值预留余量**：不要将 limit_in_bytes 设得和进程实际需求完全一样，建议预留 10-20% 的缓冲。小波动就可能触发 OOM。
- **Kubernetes 中的对应关系**：Pod 的 `resources.limits.memory` 映射到容器的 `memory.limit_in_bytes`。
- **Docker 场景**：`docker run -m 512M` 本质就是设置这个 cgroup 参数。
- **排查容器 OOM**：`dmesg | grep -i "Memory cgroup"` 可以看到是哪个 cgroup 下哪个进程被 OOM Killer 杀死。

**追问**:
- Q: memory.limit_in_bytes 设置多大合适？设得太大和太小分别有什么风险？
- Q: cgroup 的 memory.kmem.limit_in_bytes 是做什么的？内核内存泄漏时怎么排查？
- Q: Kubernetes 中有哪些情况会导致 Pod 被 OOMKill？和节点级别的 OOM Killer 是什么关系？

---

## Q7: cgroup v2 在内存管理方面相比 v1 有什么重要改进？PSI 机制是什么？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- cgroup v2 统一了 hierarchy，所有控制器在同一个目录树中工作
- 内存控制从两级（hard/soft）扩展为四级：memory.min / memory.low / memory.high / memory.max
- PSI（Pressure Stall Information）提供细粒度的内存压力量化指标
- 修复了 v1 的 Page Cache double charging 问题
- swap 控制集成到 memory 控制器中，不再需要独立的 memsw 参数

**完整回答**:

cgroup v2 在 Linux 4.5 引入，目前主流发行版（Ubuntu 22.04+、RHEL 9+、Debian 12）已默认使用 cgroup v2。对于 DevOps 工程师来说，理解 v2 的差异是容器化环境排障的基础。

**核心架构变化**：

v1 的设计是多个 hierarchy 独立挂载——memory hierarchy、cpu hierarchy、blkio hierarchy 各自为政。这种设计的初衷是灵活性，但实际使用中导致进程必须在多个 hierarchy 中同步加入，管理复杂度很高。如果某个进程漏了某个 hierarchy，该控制器的资源审计就不包含这个进程。

v2 统一为单一 hierarchy，所有控制器在同一个目录树下：

```
/sys/fs/cgroup/
├── system.slice/
│   ├── memory.max
│   ├── cpu.max
│   ├── io.max
│   └── ...
├── kubepods/
│   ├── pod123/
│   │   └── ...
│   └── ...
└── user.slice/
```

**内存控制的四层模型**：

v2 提供了比 v1 精细得多的内存控制层级：

- **memory.min**：保护最小值。此值内的内存不会因为系统内存压力被回收。类似 v1 的 soft_limit 但更强——是硬保护。
- **memory.low**：低优先级保护。低于此值时被回收的概率远低于其他 cgroup。竞争时不同 cgroup 按低值比例分担回收压力。
- **memory.high**：软限制。超过后内核异步回收，进程不会立即被杀但会受到 throttle，IO 和 CPU 都会被影响。这是 v2 最有价值的改进之一。
- **memory.max**：硬限制。超过后触发 OOM Kill。等价于 v1 的 memory.limit_in_bytes。

memory.high 的引入非常关键——它在 OOM 发生之前提供了一个"预警"阶段。超过 high 值时进程被限流但不被杀死，给系统留出了反应时间，也让运维人员可以通过 PSI 指标提前发现压力。

**PSI 机制**：

PSI 是 Linux 4.20 引入的机制，量化资源竞争导致的时间损失：

```bash
# 系统级别的内存 PSI
cat /proc/pressure/memory
# some avg10=0.00 avg60=0.00 avg300=0.00 total=0
# full avg10=0.00 avg60=0.00 avg300=0.00 total=0

# cgroup 级别的 PSI
cat /sys/fs/cgroup/system.slice/memory.pressure
# some avg10=2.35 avg60=1.87 avg300=0.95 total=895632147
```

指标含义：
- **some**：至少有一个任务因为内存不足而等待的时间比例
- **full**：所有任务都在等待内存的时间比例
- **avg10/avg60/avg300**：过去 10 秒/60 秒/300 秒的滑动平均值
- **total**：累计等待时间（微秒）

PSI 的价值在于它提供了一个预警指标来判断"系统是不是快不行了"。传统做法是等 OOM 发生再善后，PSI 可以在 OOM 之前就发出告警。

**生产实践——systemd-oomd**：

```ini
[Service]
# 当 cgroup 级别的 memory.pressure 的 10 秒均值超过 50%
# 且持续超过 5 秒时，systemd-oomd 会主动杀死 cgroup 内的进程来释放内存
ManagedOOMMemoryPressure=50%
ManagedOOMMemoryPressureLimit=5s
```

**v2 的其他改进**：

- **Page Cache 不重复计费**：v2 修复了 v1 中两个 cgroup 读取同一文件时 Page Cache 重复计费的问题。
- **swap 控制更简洁**：v1 需要 memory.limit_in_bytes + memory.memsw.limit_in_bytes 两个参数控制内存+swap。v2 统一为 memory.max 控制物理内存，memory.swap.max 控制 swap 上限。
- **内核内存自动计入**：v2 中内核内存（slab、kmalloc）默认计入 cgroup 内存限制，不再需要额外的 kmem 配置。

**追问**:
- Q: cgroup v2 的 cgroup.controllers 和 cgroup.subtree_control 是做什么的？层级控制是什么意思？
- Q: Kubernetes 1.25+ 默认使用 cgroup v2，有哪些已知的兼容性问题？
- Q: systemd-oomd 在 cgroup v2 下的工作原理是什么？它和内核 OOM Killer 有什么区别？

---
