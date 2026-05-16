---
id: interview-storage
title: 存储与 IO 面试题
description: Linux 存储与 IO 高频面试题，涵盖 RAID、LVM、文件系统选型、IO 调度器、fio 基准测试、Page Cache 调优等真实面试场景
---

# Linux 存储与 IO 面试题

## Q1: 生产环境中你用过哪些 RAID 级别？RAID10 和 RAID5 在数据库场景下怎么选？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- RAID0 条带化、RAID1 镜像、RAID5 分布式奇偶校验、RAID6 双奇偶校验、RAID10 条带化镜像
- 数据库场景优先选 RAID10，性能和可靠性平衡最好
- RAID5 在机械硬盘时代写惩罚严重（每次 IO 需要 4 次磁盘操作），SSD 时代有所缓解但仍存在
- 硬件 RAID 和软件 RAID（mdadm）各有优劣

**完整回答**:

**各 RAID 级别的核心特性**：

- **RAID0（条带化）**：数据分片写入所有磁盘，读写性能 N 倍于单盘，但任何一块盘损坏数据全丢。只适合非关键数据或临时存储。
- **RAID1（镜像）**：数据同时写入两块盘，读性能翻倍（可从任意盘读），写性能等同单盘。最多容忍半数磁盘故障。
- **RAID5（条带化+分布式奇偶校验）**：N 块盘容量为 N-1 块。单盘故障时数据可恢复。但随机写入存在严重的写惩罚。
- **RAID6（双奇偶校验）**：N 块盘容量为 N-2 块。最多容忍两块盘故障。比 RAID5 多一次校验计算。
- **RAID10（RAID1+0）**：先镜像再条带化。N 块盘容量为 N/2。结合了 RAID0 的性能和 RAID1 的可靠性。

**写惩罚（Write Penalty）的解释**：

这是一个面试官很喜欢问的考点。写惩罚指的是执行一次逻辑 IO（应用发起的）时，实际发生的物理 IO 次数。

- RAID0：写惩罚 1。一次逻辑写入对应一次物理写入。
- RAID1：写惩罚 2。一次逻辑写入需要写入两块盘。
- RAID5：写惩罚 4。一次 4KB 的随机写入需要：读取旧数据、读取旧奇偶校验、计算新奇偶校验、写入新数据、写入新奇偶校验。即读两次写两次。在 SSD 上虽然读写延迟差异不大，但额外的 IO 次数仍然消耗磁盘带宽。
- RAID6：写惩罚 6。同 RAID5 但需要处理两个校验值。
- RAID10：写惩罚 2。复制写入两块盘，不需要读取和计算。

**数据库场景选型**：

```bash
# 硬件 RAID 配置常见方案
# - 4 块 NVMe SSD 做 RAID10：最佳性能，推荐在 MySQL/PostgreSQL 生产环境使用
# - 8 块 SSD 做 RAID10：吞吐量接近单盘 4 倍，故障容忍度好
# - 不推荐 RAID5 用于 OLTP 数据库
```

数据库对存储的核心要求是随机读写延迟低、IOPS 高。RAID5 的写惩罚在随机写场景下会显著增加平均延迟。MySQL InnoDB 的双写缓冲（doublewrite buffer）机制也会放大这个影响。

**硬件 RAID 和软件 RAID**：

- **硬件 RAID**（LSI/Broadcom）：
  - 带有独立的 RAID 芯片和缓存（含电池备份），不消耗主机 CPU
  - 写缓存大幅提升写入性能（数据先写入缓存，然后异步刷盘）
  - 配置命令：`storcli64` 或 `MegaCli64`
  - 缺点是：如果 RAID 卡故障，换同型号卡才能恢复

- **软件 RAID**（mdadm）：
  - 不依赖特定硬件，只要 Linux 都能识别
  - 占用主机 CPU 和内存资源
  - 配置灵活，可以随时扩展（RAID5/6 可以热添加磁盘）

```bash
# 使用 mdadm 创建 RAID10
mdadm --create /dev/md0 --level=10 --raid-devices=4 /dev/nvme0n1 /dev/nvme1n1 /dev/nvme2n1 /dev/nvme3n1

# 查看 RAID 状态
cat /proc/mdstat
mdadm --detail /dev/md0

# 监控 RAID 健康
mdadm --monitor --mail=admin@example.com --delay=300 /dev/md0
```

**追问**:
- Q: RAID5 在 SSD 和 HDD 上的写惩罚表现有什么不同？SSD 时代 RAID5 靠谱吗？
- Q: RAID 卡上的缓存（Cached/WriteBack/WriteThrough）各有什么作用？
- Q: mdadm 创建的 RAID 如何扩容？RAID10 可以加盘吗？

---

## Q2: LVM 的原理是什么？你在生产中使用 LVM 遇到过什么坑？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、快手

**答案要点**:
- LVM 在物理磁盘和文件系统之间增加了逻辑卷管理层
- 核心组件：PV（物理卷）、VG（卷组）、LV（逻辑卷）
- 快照（snapshot）使用 COW 机制，写性能在快照创建后会下降
- 生产常见坑：thin provisioning 空间溢出、快照写满后自动失效、lvm 元数据损坏

**完整回答**:

**LVM 架构**：

LVM 的逻辑层次如下：

```
物理磁盘 (/dev/sda, /dev/sdb)
    ↓ 创建 PV
物理卷 (Physical Volume, PV)
    ↓ 加入 VG
卷组 (Volume Group, VG)
    ↓ 创建 LV
逻辑卷 (Logical Volume, LV)
    ↓ 格式化
文件系统 (ext4/xfs)
```

```bash
# 典型操作流程
pvcreate /dev/sdb /dev/sdc
vgcreate vg_data /dev/sdb /dev/sdc
lvcreate -n lv_mysql -L 500G vg_data
mkfs.xfs /dev/vg_data/lv_mysql

# 扩容
lvextend -L +100G /dev/vg_data/lv_mysql
xfs_growfs /mount/point  # XFS 在线扩容
resize2fs /dev/vg_data/lv_mysql  # ext4 在线扩容
```

**LVM 快照**：

LVM 快照使用 COW（Copy-on-Write）机制——创建快照时不复制数据，只有当源卷上的数据块被修改时，原始数据才被复制到快照卷。

```bash
# 创建 10GB 的快照（估算 COW 区域大小）
lvcreate -s -n mysql_snapshot -L 10G /dev/vg_data/lv_mysql

# 挂载快照做备份
mount /dev/vg_data/mysql_snapshot /mnt/backup

# 备份完成后删除快照
lvremove /dev/vg_data/mysql_snapshot
```

**生产环境中 LVM 的坑**：

1. **快照空间写满即自动失效**：这可能是 LVM 最大的坑。如果 COW 区域（快照预留的空间）被用完，快照会自动变为"无效"状态，无法访问。备份脚本必须监控快照使用率。

```bash
# 监控快照使用率
lvs -a -o name,snap_percent,snap_origin
# 当 snap_percent 接近 100% 时，快照会失效
```

2. **Thin Provisioning 的空间溢出**：创建 thin LV 时只声明最大容量，不实际分配空间。如果 thin pool 实际物理空间不足以支持 thin LV 的写入，所有 thin LV 都会挂起，需要立即扩展 thin pool。

```bash
# 创建 thin pool
lvcreate -L 100G -T vg_data/thin_pool
# 创建 thin LV（最大 1TB，但实际只占用 thin pool 的空间）
lvcreate -V 1T -T vg_data/thin_pool -n thin_mysql

# 监控 thin pool 使用率
lvs -a -o+data_percent
```

3. **重新识别 LVM 元数据不可靠**：给服务器换盘后，如果新磁盘的 LVM 元数据和旧不一致，VG 可能无法识别。建议对关键数据的 LVM 配置做备份。

```bash
# 备份 LVM 元数据
vgcfgbackup vg_data  # 输出到 /etc/lvm/backup/vg_data

# 在另一台机器上恢复
vgcfgrestore vg_data -f /etc/lvm/backup/vg_data
```

**追问**:
- Q: LVM 快照和文件系统级别快照（btrfs/zfs）有什么区别？性能上有什么差异？
- Q: lvmcache（LVM 缓存）怎么用？可以通过 SSD 给 HDD 加速吗？
- Q: LVM 的 pvmove 是怎么在线迁移数据的？迁移时 IO 延迟会受影响吗？

---

## Q3: ext4、XFS、btrfs 有什么区别？你怎么为不同场景选择文件系统？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- ext4 稳定成熟，适合通用场景，大目录下性能不佳
- XFS 适合大文件和大容量场景，并行 IO 性能突出，是 RHEL/CentOS 7+ 的默认文件系统
- btrfs 支持快照、压缩、校验和、子卷等高级特性，但稳定性和性能成熟度不如 ext4/XFS
- 数据库场景优先选 XFS，容器 overlay 层使用 XFS 需要注意 d_type 和 reflink 支持

**完整回答**:

**ext4**：

ext4 是 ext3 的进化版，引入的主要改进：
- 支持最大 1EB 文件系统和 16TB 单个文件
- extents 替代 block mapping，减少大文件的元数据开销
- 延迟分配（delayed allocation），提高写入性能
- 预分配（fallocate），减少磁盘碎片

```bash
# ext4 优化挂载选项
mount -o noatime,nodelalloc,data=ordered /dev/sda1 /mnt

# 关闭日志（极端场景，非正常关机后数据风险高）
mount -t ext4 -o nojournal /dev/sda1 /mnt
```

ext4 的弱点：单目录下大量文件（超过几十万）时，目录索引（htree）性能下降明显。大量小文件创建和删除时，inode 表管理效率不如 XFS。

**XFS**：

XFS 是 64 位高性能日志文件系统，最初由 SGI 开发。在 RHEL 7+ 和所有主流云平台镜像中已是默认文件系统。

```bash
# 创建 XFS
mkfs.xfs -f -m reflink=1 -d agcount=4 /dev/sda1

# 优化挂载选项
mount -o noatime,nobarrier,largeio,inode64,swalloc /dev/sda1 /mnt

# 查看 XFS 的分配组信息
xfs_info /mnt
```

XFS 对并行 IO 的优化体现在分配组（Allocation Group, AG）的设计上。每个 AG 独立管理自己的 inode 和数据空间，多核 CPU 可以同时写入不同的 AG，不存在 ext4 那种全局的 inode 锁。这也是为什么数据库场景推荐 XFS 的原因之一。

XFS 的限制：
- 不能缩小（shrink），只能扩大 —— 部署前要规划好大小
- 如果分区做 lvm 快照还原，需要 xfs_repair 修复日志（虽然不太影响）
- 删除大量文件后，AG 内的空闲空间不会自动归还到其他 AG

**btrfs**：

btrfs（B-tree File System）的设计目标类似于 ZFS——集成了卷管理、快照、校验和、压缩、RAID 等特性。

```bash
# btrfs 创建子卷（类似 lvm 的逻辑卷）
btrfs subvolume create /mnt/data
btrfs subvolume snapshot /mnt/data /mnt/data_snap

# 开启压缩
mount -o compress=zstd /dev/sda1 /mnt

# 查看校验和错误
btrfs device stats /mnt
```

btrfs 的优势：
- **快照**：瞬间创建，空间高效（COW）
- **压缩**：透明压缩 zstd/lzo/zlib，节省磁盘空间
- **校验和**：检测静默数据损坏（silent data corruption）
- **子卷**：灵活的层次结构，可独立快照和回滚

btrfs 的不足：
- 在极端高并发写入下的性能不够稳定
- RAID5/6 的实现有已知 Bug，不建议生产使用
- 重删（dedup）不成熟

**选型建议**：

| 场景 | 推荐 | 原因 |
|------|------|------|
| OLTP 数据库 | XFS | 并行 IO 好，文件大，稳定 |
| 日志存储 | XFS 或 ext4 | 顺序写入，两者都可以 |
| 容器镜像层 | XFS（reflink） | overlay2 需要 d_type，reflink 节省空间 |
| 大量小文件 | ext4 | 简单稳定，小文件创建快 |
| 归档/备份 | btrfs 或 XFS | btrfs 压缩和快照好用 |
| 冷数据存储 | btrfs | 压缩节省空间，校验和防静默损坏 |

**追问**:
- Q: 文件系统的 atime/relatime/noatime 有什么区别？为什么 noatime 能提升性能？
- Q: XFS 的 reflink 和 cow 文件系统有什么区别？reflink 在容器场景有什么用处？
- Q: 文件系统对 IO 路径上的 page cache 管理有什么影响？XFS 和 ext4 的预读策略有什么不同？

---

## Q4: Linux IO 调度器有哪些？SSD 和 HDD 分别应该怎么配置？

**难度**: ⚫⚪⚪ 初级 | **面试公司**: 字节跳动、腾讯、美团

**答案要点**:
- 传统 IO 调度器：CFQ、Deadline、NOOP
- 多队列块层（blk-mq）调度器：mq-deadline、bfq、kyber、none
- HDD 推荐 mq-deadline 或 bfq，SSD/NVMe 推荐 none
- IO 调度器在 NVMe 场景下的影响很小，none 是默认且最优选择

**完整回答**:

**IO 调度器的演进历史**：

在内核 5.0+ 版本中，传统的单队列 IO 调度器已经完全被多队列块层（blk-mq，Block Multi-Queue）取代。理解这个演进对回答面试问题有帮助：

**单队列时代（内核 5.0 之前）**：
- **CFQ（Completely Fair Queuing）**：按进程分配 IO 时间片，桌面场景效果好，服务器场景吞吐一般。
- **Deadline**：为每个 IO 设置超时时间，避免 IO 饿死。读请求优先级高于写请求。数据库场景推荐。
- **NOOP（No Operation）**：先进先出简单合并。适合 SSD 等寻道时间短的设备。

**多队列时代（内核 5.0+，blk-mq）**：
- **mq-deadline**：Deadline 的多队列版，每个硬件队列独立排序和 deadline。是当前多数发行版的默认调度器。
- **bfq（Budget Fair Queuing）**：CFQ 的替代品，提供更精细的 IO 带宽分配。桌面和交互式场景推荐。
- **kyber**：基于延迟的调度器，自动调节队列深度以保持目标延迟。适合低延迟场景。
- **none**：不执行任何 IO 排序，直接将请求传递给驱动。NVMe 场景推荐。

```bash
# 查看当前 IO 调度器
cat /sys/block/sda/queue/scheduler
# 输出示例: [mq-deadline] kyber bfq none
# 方括号表示当前使用的调度器

# 修改 IO 调度器
echo none > /sys/block/sda/queue/scheduler

# 永久修改（通过 udev 规则）
# /etc/udev/rules.d/60-iosched.rules
ACTION=="add|change", KERNEL=="nvme[0-9]n[0-9]", ATTR{queue/scheduler}="none"
ACTION=="add|change", KERNEL=="sd*[!0-9]", ATTR{queue/rotational}=="1", ATTR{queue/scheduler}="mq-deadline"

# 查看设备是否旋转（判断 HDD/SSD）
cat /sys/block/sda/queue/rotational
# 0 = SSD/NVMe, 1 = HDD
```

**生产环境配置建议**：

- **NVMe SSD**：使用 none（即 no IO scheduler）。NVMe 设备内部的 FTL（Flash Translation Layer）已经做了 IO 排序和调度，内核层面再调度一次只是浪费 CPU。而且 NVMe 的原生队列深度很高（通常 64K+），可以自己消化并发 IO。
- **SATA SSD**：none 或 mq-deadline。SATA SSD 的队列深度较低（NCQ 通常 32），mq-deadline 可以帮助优化。
- **HDD**：mq-deadline 或 bfq。机械硬盘需要 IO 调度来解决寻道问题。mq-deadline 最适合服务器场景。

**NVMe 和多队列的深入理解**：

NVMe 控制器支持多个硬件 IO 队列（通常每个 CPU 核心一个），blk-mq 层将软件队列直接映射到硬件队列，实现了无锁或低锁竞争的 IO 提交路径。这也是 NVMe 为什么能轻松跑到百万级 IOPS 的原因之一。

```bash
# 查看 NVMe 队列信息
nvme list
cat /sys/block/nvme0n1/queue/nr_requests
cat /sys/block/nvme0n1/device/queue_count
```

**追问**:
- Q: IO 调度器的"合并"（merging）和"排序"（sorting）分别做什么？对哪些场景影响最大？
- Q: BFQ 是如何实现进程级别的 IO 带宽公平分配的？和 CFQ 有什么不同？
- Q: io_uring 和传统的 IO 调度器是什么关系？io_uring 的 IO 路径在调度器之前还是之后？

---

## Q5: 你怎样用 fio 做存储性能测试？关键参数怎么设置才能模拟真实负载？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- fio 是 Linux 最主流的 IO 基准测试工具，灵活性极高
- 关键参数：rw（读写模式）、bs（块大小）、iodepth（队列深度）、numjobs（并发数）
- 不同场景的负载模型差异很大（OLTP vs OLAP vs 流式写入）
- 测试结果要关注：IOPS、延迟（p99/p999）、带宽，三个指标综合评估

**完整回答**:

**fio 的核心参数**：

```bash
# fio 基础命令结构
fio --name=test --filename=/dev/sda --direct=1 --rw=randwrite --bs=4k --iodepth=32 --numjobs=4 --time_based --runtime=60

# 推荐使用 job 文件，更清晰
```

推荐写 job 文件来避免漏掉参数：

```ini
# mysql-oltp.fio
[global]
direct=1
ioengine=libaio
group_reporting=1
time_based=1
runtime=120
randrepeat=0

[oltp-read]
rw=randread
bs=4k
iodepth=32
numjobs=4
filename=/dev/sda

[oltp-write]
rw=randwrite
bs=4k
iodepth=32
numjobs=4
filename=/dev/sda

[oltp-mixed]
rw=randrw
rwmixread=70
bs=4k
iodepth=32
numjobs=4
filename=/dev/sda
```

```bash
# 运行 fio job 文件
fio mysql-oltp.fio
```

**核心参数详解**：

- **direct=1**：使用 O_DIRECT 绕过 Page Cache，测试真实磁盘性能。如果不加这个参数，测试结果反映的是 Page Cache 的性能而非磁盘的。
- **rw（读写模式）**：
  - `randread` / `randwrite`：随机读写，模拟 OLTP 数据库场景
  - `read` / `write`：顺序读写，模拟日志写入、大数据扫描场景
  - `randrw`：混合随机读写，指定 `rwmixread` 比例
- **bs（块大小）**：
  - 4KB/8KB：OLTP 数据库场景（MySQL InnoDB 页默认 16KB）
  - 64KB/1MB：OLAP 分析场景、HDFS 写入
  - 128KB+：流式写入（视频录制、大文件传输）
- **iodepth（IO 队列深度）**：
  - 1-8：模拟低并发场景
  - 16-64：模拟典型数据库负载
  - 128+：模拟高并发或 NVMe 设备的极限能力
- **numjobs**：并发进程/线程数，和 iodepth 组合决定总并发量

**测试结果解读**：

```bash
# fio 输出关键指标
# IOPS: 每秒 IO 次数（最重要）
# BW: 带宽（MB/s）
# lat (usec): 延迟
#   - p50, p95, p99, p99.9, p99.99: 百分位延迟
#   - mean: 平均延迟
# clat: 完成延迟（submission -> completion）
# slat: 提交延迟（io_submit 调用）
# lat: 总延迟

# 示例输出片段
# lat (usec): min=50, max=5000, avg=120.50, stdev=30.20
# 99.00th=[200], 99.90th=[400], 99.99th=[800]
```

**不同场景的 fio 配置参考**：

**场景 1：MySQL OLTP 负载（模拟 InnoDB IO 行为）**

```ini
[global]
direct=1
ioengine=libaio
group_reporting=1
time_based=1
runtime=300
randrepeat=0

[mysql-oltp]
rw=randrw
rwmixread=70
bs=16k
iodepth=16
numjobs=8
filename=/dev/nvme0n1
```

**场景 2：Kafka/日志写入（顺序写，大块）**

```ini
[kafka-log]
rw=write
bs=64k
iodepth=8
numjobs=1
filename=/dev/nvme1n1
```

**场景 3：Redis 持久化（小随机写）**

```ini
[redis-aof]
rw=randwrite
bs=4k
iodepth=1
numjobs=1
filename=/dev/nvme2n1
```

**追问**:
- Q: fio 的 ioengine 参数 libaio、io_uring、posixaio、sync 各有什么不同？性能上差异多大？
- Q: 测试结果中前几分钟的数据能作为基准吗？fio 的 ramp_time 参数是干什么用的？
- Q: 如何用 fio 测试 cgroup IO 限制是否生效？

---

## Q6: Page Cache 相关有哪些内核参数可以调优？生产环境中怎么配置？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- vm.vfs_cache_pressure 控制 dentry/inode 缓存的回收倾向
- vm.min_free_kbytes 保证最低内存水位，防止内存分配阻塞
- vm.zone_reclaim_mode 控制 NUMA 内存回收模式
- vm.page-cluster、vm.pagecache_limit 等参数影响 Page Cache 交换效率
- vm.drop_caches 用于主动清空缓存（只在特定场景使用）

**完整回答**:

Page Cache 调优是一个面试中比较少有人能讲清楚的高级话题。这些参数在日常排障中非常有用。

**vfs_cache_pressure**：

控制内核回收 dentry（目录项缓存）和 inode 缓存的积极程度。

```bash
cat /proc/sys/vm/vfs_cache_pressure
# 默认 100

# 降低压力——保留更多元数据缓存
echo 50 > /proc/sys/vm/vfs_cache_pressure
```

- **值 > 100**：内核更积极回收 dentry/inode 缓存。如果系统中存在大量临时文件创建和删除的场景，dentry 可能很快膨胀，适当提高这个值有帮助。
- **值 = 0**：内核永远不会回收 dentry/inode 缓存（内核会阻止设为 0，允许的最小值是 50 左右，需要仔细检查内核版本）。
- **值 < 100**：内核倾向于保留更多的元数据缓存。

生产实践中，如果遇到大量目录遍历操作（如 `find` 扫描百万级文件的目录），适当降低 vfs_cache_pressure 可以保持 dentry 缓存的热度，大幅提升后续访问速度。

**min_free_kbytes**：

设置系统保留的最小空闲内存量。这个值影响 kswapd 何时开始回收内存。

```bash
cat /proc/sys/vm/min_free_kbytes
# 默认值通常偏小，内核自动计算 = 4 * sqrt(lowmem_kbytes)

# 对于内存较大的机器，建议调高
# /etc/sysctl.d/vm-tuning.conf
vm.min_free_kbytes = 524288  # 512MB
```

为什么要调高 min_free_kbytes？在一些内存密集型的场景中，free 内存消耗殆尽触发 direct reclaim（直接内存回收），进程会被阻塞等待内存释放，产生秒级的延迟尖刺。保留一定的 free 内存可以给 kswapd 更充裕的时间来异步回收。

但也不能设得太大——如果 min_free_kbytes 设得过高，内核会认为"可用内存不足"，过早触发 swap 和缓存回收，造成内存浪费。

**zone_reclaim_mode**：

控制 NUMA 节点内的内存回收行为。

```bash
cat /proc/sys/vm/zone_reclaim_mode
# 默认 0

# 值为 1：优先从本地 Node 回收内存，而不是从远程 Node 分配
echo 1 > /proc/sys/vm/zone_reclaim_mode
```

- **mode=0**：本地 Node 内存不够时，从远程 Node 分配。延迟增加，但系统整体可用内存更多。
- **mode=1**：本地 Node 内存不够时，优先回收本地 Node 的 Page Cache 和 swap。如果回收后还不够，再从远程分配。适合对内存访问延迟敏感的应用（如数据库，希望数据尽可能在本地 Node）。

**page-cluster**：

控制 swap 换入时一次读取的页面数量（以 2 的幂次为单位）。

```bash
cat /proc/sys/vm/page-cluster
# 默认 3（一次读取 8 页 = 32KB）
```

swap 换入时，预读更多的页可以增加大块 IO 的吞吐量（类似文件系统的预读），但也可能浪费带宽。如果系统 swap 频繁但内存随机访问模式很强（如数据库），建议降低这个值。

**drop_caches**（在生产中慎用）：

```bash
# echo 1: 清空 Page Cache
# echo 2: 清空 dentry 和 inode 缓存
# echo 3: 清空所有
echo 3 > /proc/sys/vm/drop_caches
```

只有在提前论证过"清空缓存不会影响业务"的前提下才使用这个操作。生产数据库节点上执行 drop_caches 后，所有数据需要从磁盘重新读取，会产生 IO 风暴。更适合的场景是：在压测前清空缓存以保证起点一致。

**内核 5.x+ 的新参数**：

```bash
# pagecache_limit — 限制 Page Cache 占用的最大内存（内核 5.x+ 部分版本支持）
echo 4294967296 > /sys/fs/cgroup/<cgroup>/memory.pagecache_limit

# cgroup v2 下对 writeback 的控制更精细
# memory.high 阈值到达后，内核会优先回收 Page Cache 而不是 swap
```

**生产环境综合配置示例**：

```bash
# /etc/sysctl.d/storage-tuning.conf

# 保留足够内存给 kswapd 腾出回收时间
vm.min_free_kbytes = 1048576

# 适当降低 dentry 回收压力
vm.vfs_cache_pressure = 75

# NUMA 本地回收优先（数据库场景）
vm.zone_reclaim_mode = 1

# 降低 page cluster（如果 swap 频繁）
vm.page-cluster = 2

# 提高脏页写回效率（配合 dirty_ratio 调整）
vm.dirty_background_ratio = 5
vm.dirty_ratio = 15
```

**追问**:
- Q: /proc/meminfo 中的 SReclaimable 和 SUnreclaim 分别代表什么？什么情况下 SUnreclaim 会异常升高？
- Q: huge pages 的 page cache 行为有什么特殊之处？MAP_NORESERVE 是做什么的？
- Q: cgroup v2 中 memory.min 和 memory.low 对 Page Cache 的回收有什么影响？

---
