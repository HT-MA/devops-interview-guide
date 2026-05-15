---
id: cpu-analysis
title: CPU 分析
description: Linux CPU 性能分析核心知识点
---

# Linux CPU 分析

## 面试官想考什么

* CPU 负载理解
* 性能分析工具
* 瓶颈定位方法
* 调度机制

## 标准答案

### CPU 负载理解

```bash
# 查看负载
uptime
# 16:30:00 up 30 days,  5:42,  2 users,  load average: 0.52, 0.58, 0.59
#                                                      1min   5min   15min
```

Load Average 表示：
- 单位时间内在运行队列中的平均进程数
- 理想值 = CPU 核心数
- 超过核心数说明有积压

### CPU 使用率类型

| 类型 | 说明 |
|------|------|
| us (user) | 用户态 CPU |
| sy (system) | 内核态 CPU |
| ni (nice) | 低优先级用户态 |
| id (idle) | 空闲 |
| wa (iowait) | I/O 等待 |
| hi (hardware interrupt) | 硬件中断 |
| si (softirq) | 软件中断 |
| st (steal) | 虚拟化 steal |

## 常见命令

### top 命令

```bash
# 默认显示
top

# 线程视图(按 H)
top -H -p PID

# 高亮运行中进程
top

# 按 1 显示所有 CPU 核心
```
按 1 后的输出示例：
```
%Cpu0:  5.2 us,  2.1 sy,  0.0 ni, 92.0 id, 0.0 wa, 0.0 hi, 0.7 si, 0.0 st
%Cpu1: 10.3 us,  3.5 sy,  0.0 ni, 85.5 id, 0.0 wa, 0.0 hi, 0.7 si, 0.0 st
```

### mpstat

```bash
# 安装 sysstat
apt install sysstat

# 每秒显示 CPU 统计
mpstat 1

# 查看所有 CPU 详情
mpstat -P ALL 1
```

### pidstat

```bash
# 监控特定进程 CPU
pidstat -p PID 1

# 查看线程 CPU
pidstat -p PID -t 1

# 报告 I/O 统计
pidstat -d 1
```

### 其他工具

```bash
# 查看 CPU 信息
lscpu
cat /proc/cpuinfo

# 实时监控
htop
btop
```

## CPU 飙高排查流程

### 第一阶段：定位问题进程

```bash
top
# 查看 %CPU 最高的进程
```

### 第二阶段：定位问题线程

```bash
# 找到进程 PID 后
top -Hp PID
# 或
ps -eLf | grep PID
```

### 第三阶段：定位代码位置

```bash
# 使用 perf 采样
perf top -p PID

# 或使用 strace (开销大)
strace -p PID -c
strace -p PID -T
```

### 第四阶段：常见原因

| 原因 | 特征 | 排查方法 |
|------|------|----------|
| 死循环 | 单核 100% | top -Hp |
| GC | 多核同时高 | jstat -gc |
| 数据库阻塞 | iowait 高 | iostat |
| 正则回溯 | CPU 持续高 | 代码审查 |
| 加密/压缩 | CPU 持续高 | 正常现象 |

## 实战经验

1. **CPU 使用率低但负载高**
   - 可能是 I/O 等待或进程处于不可中断睡眠(D)

2. **多核负载不均**
   - 可能是单线程程序
   - 检查 CPU 亲和性

3. **Java 应用**
   ```bash
   # 查看 GC 是否频繁
   jstat -gcutil PID 1000
   
   # 查看 JIT 编译
   jstat -printcompilation PID
   ```

## 延伸问题

* CPU 亲和性是什么？如何设置？
* 什么是上下文切换？
* 如何用 perf 做火焰图？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>

<span className="company-tag">阿里</span>
<span className="company-tag">字节</span>
