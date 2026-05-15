---
id: io
title: IO 与存储
description: Linux IO 与存储核心知识点
---

# Linux IO 与存储

## 面试官想考什么

* IO 模型
* 磁盘类型与性能
* IO 调度算法
* 性能分析工具

## 标准答案

### IO 模型

| 模型 | 阻塞 | 非阻塞 | 多路复用 | 说明 |
|------|------|--------|----------|------|
| 阻塞 IO | ✓ | | | 最简单，性能差 |
| 非阻塞 IO | | ✓ | | 需要轮询 |
| IO 多路复用 | | | ✓ | select/poll/epoll |
| 异步 IO | | ✓ | | Windows IOCP |

### epoll 原理

```
用户空间                     内核空间
    |                           |
    |  epoll_create()           |
    |--------------------->     |
    |         (红黑树)           |
    |                           |
    |  epoll_ctl(ADD)           |
    |--------------------->     |
    |                           |
    |  fd1, fd2, fd3 存入红黑树 |
    |                           |
    |  epoll_wait()             |
    |--------------------->     |
    |                           |
    |        <-- 就绪事件       |
    |                           |
```

### 磁盘类型对比

| 类型 | 随机 IO | 顺序 IO | 价格 | 延迟 |
|------|---------|---------|------|------|
| HDD | 慢 | 较快 | 低 | ~10ms |
| SSD | 快 | 快 | 中 | ~0.1ms |
| NVMe | 极快 | 极快 | 高 | ~0.02ms |

## 常见命令

### iostat

```bash
# 安装 sysstat
apt install sysstat

# 查看磁盘 IO
iostat -x 1

# 显示 CPU 和磁盘
iostat -c -d 1 3

# 输出解释
# %util: IO 使用率 (接近 100% 说明饱和)
# r/s, w/s: 每秒读写次数
# rkB/s, wkB/s: 每秒读写KB
# await: 平均等待时间
# avgqu-sz: 平均队列长度
```

### iotop

```bash
# 交互式查看
iotop

# 非交互式
iotop -o

# 查看特定进程
iotop -p PID
```

### 其他工具

```bash
# 查看文件句柄
lsof -p PID

# 查看磁盘使用
df -h
du -sh /*

# 查看 inode
df -i

# 测试磁盘性能
fio -filename=/tmp/test -iodepth=1 -rw=randread -bs=4k -size=1G
```

## IO 调度算法

### 查看/修改

```bash
# 查看当前调度器
cat /sys/block/sda/queue/scheduler

# 修改调度器
echo "mq-deadline" > /sys/block/sda/queue/scheduler
```

### 调度器选择

| 场景 | 推荐调度器 |
|------|------------|
| SSD/NVMe | none (noop) |
| 数据库(随机写) | mq-deadline |
| 桌面系统 | bfq |
| 通用 | none |

## 常见问题

### IO 高的排查流程

```bash
# 1. 找到高 IO 进程
iotop

# 2. 定位具体文件
lsof -p PID

# 3. 查看系统 IO 状态
iostat -x 1

# 4. 检查是否 swap
vmstat 1
```

### 常见原因

| 原因 | 特征 | 解决方案 |
|------|------|----------|
| 应用写日志 | wbc(写字节)高 | 日志轮转 |
| 数据库刷盘 | await 高 | SSD/RAID |
| 内存不足换页 | si/so 高 | 增加内存 |
| 大文件拷贝 | 正常 | 限速/错峰 |

## 实战经验

1. **NFS/网络存储延迟高**
   ```bash
   # 查看网络存储延迟
   iostat -x | grep nfs
   
   # 检查网络
   netstat -i
   ```

2. **Docker 存储问题**
   ```bash
   # overlay2 vs devicemapper
   docker info | grep "Storage Driver"
   
   # 清理磁盘
   docker system prune -a
   ```

3. **日志写入阻塞**
   ```bash
   # 查看文件系统挂载选项
   mount | grep /var
   
   # noatime 减少写操作
   ```

## 延伸问题

* 什么是 Direct IO？
* 什么是 Page Cache？
* 如何优化数据库 IO？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>

<span className="company-tag">腾讯</span>
