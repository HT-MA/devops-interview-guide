---
id: cpu-high
title: CPU 飙高问题
description: 线上 CPU 飙高排查
---

# 场景：线上 CPU 飙高

## 背景

线上服务器 CPU 使用率突然达到 100%，服务响应变慢。

## 排查流程

### 第一阶段：定位问题进程

```bash
# 查看系统 CPU 使用
top
# 或
htop

# 找到 %CPU 最高的进程
# 记下 PID
```

### 第二阶段：定位问题线程

```bash
# 方法1: top 线程视图
top -Hp <PID>

# 方法2: ps 查看线程
ps -eLf | grep <PID>
ps -eLo pid,lwp,pcpu,comm | grep <PID>
```

### 第三阶段：定位代码位置

```bash
# 使用 perf 采样 (需要 root)
perf top -p <PID>

# 或使用火焰图
perf record -F 99 -p <PID> -g -- sleep 30
perf script | ./FlameGraph/stackcollapse-perf.pl | ./FlameGraph/flamegraph.pl > cpu.svg
```

### 第四阶段：常见原因

| 原因 | 特征 | 排查方法 |
|------|------|----------|
| 死循环 | 单核 100% | `top -Hp` 看线程 |
| GC | 多核同时高 | `jstat -gcutil` |
| 正则回溯 | 特定接口高 | APM 链路追踪 |
| 加密/压缩 | CPU 持续高 | 正常现象 |
| 数据库阻塞 | iowait 高 | `iostat` |

## Java 应用排查

```bash
# 1. 查看 GC
jstat -gcutil <PID> 1000

# 2. 查看线程
jstack <PID> > thread.log
# 分析 thread.log 中的 BLOCKED/WAITING 线程

# 3. 查看内存
jmap -heap <PID>
```

## 解决措施

1. **临时处理**
   ```bash
   # 重启服务
   kubectl rollout restart deployment/myapp
   
   # 限流
   kubectl scale deployment myapp --replicas=0
   ```

2. **长期优化**
   - 代码优化：减少重复计算
   - JVM 调优：合理设置堆大小
   - 限流熔断

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
<span className="company-tag">阿里</span>
<span className="company-tag">字节</span>
