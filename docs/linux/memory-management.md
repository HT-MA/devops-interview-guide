---
id: memory-management
title: 内存管理
description: Linux 内存管理核心知识点
---

# Linux 内存管理

## 面试官想考什么

* 内存寻址机制
* 虚拟内存与物理内存
* 内存分配与回收
* OOM 处理

## 标准答案

### 内存布局

```
+------------------+ 高地址
|     Stack        | 向下增长
+------------------+
|       ↓          |
|                  |
|       ↑          |
+------------------+
|      Heap        | 向上增长
+------------------+
|   BSS Segment    | 未初始化数据
+------------------+
|   Data Segment   | 已初始化数据
+------------------+
|   Text Segment   | 代码段
+------------------+ 低地址
```

### 内存类型

| 类型 | 说明 | 命令查看 |
|------|------|----------|
| RSS | 实际物理内存 | `ps aux` |
| VSS | 虚拟内存大小 | `ps -o vsz` |
| PSS | 比例内存(共享库均分) | `/proc/PID/smaps` |
| USS | 独占内存 | `/proc/PID/smaps` |

## 常见命令

### free 命令

```bash
# 显示内存使用情况
free -h

# 持续监控
watch -n 1 free -h
```

### vmstat 命令

```bash
# 显示系统内存、进程、IO等
vmstat 1

# 查看详细信息
vmstat -a 1
```

### /proc/meminfo

```bash
# 查看详细内存信息
cat /proc/meminfo

# 关键指标
# MemAvailable: 可用内存
# MemFree: 空闲内存
# Buffers/Cached: 缓存
# AnonPages: 匿名页(堆/栈)
```

## 常见问题

### 内存泄漏排查

```bash
# 1. 定位高内存进程
ps aux --sort=-%mem | head

# 2. 查看进程内存详情
cat /proc/PID/status | grep -E "Vm|Rss"

# 3. 查看内存映射
pmap -x PID

# 4. 使用 valgrind 检测
valgrind --leak-check=full ./program
```

### OOM 问题

```bash
# 查看 OOM 日志
dmesg | grep -i "out of memory"
dmesg | grep -i "oom"

# 查看 OOM 分数(越低越不会被杀)
cat /proc/PID/oom_score
cat /proc/PID/oom_score_adj
```

### 内存回收

```bash
# 手动触发回收
sync
echo 3 > /proc/sys/vm/drop_caches
```

## 实战经验

1. **可用内存 ≠ Free**
   - Linux 会使用空闲内存做缓存
   - `MemAvailable` 才是真正可用

2. **Java 应用内存问题**
   - JVM 堆外内存泄漏
   - 使用 `-XX:NativeMemoryTracking=detail` 排查

3. **生产环境监控**
   - 关注 `si/so` (swap in/out)
   - swap 使用高说明内存不足

## 延伸问题

* 什么是大页内存(HugePages)？
* mmap 原理是什么？
* 如何优化内存分配？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
