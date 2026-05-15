---
id: memory-leak
title: 内存泄漏问题
description: 内存泄漏排查
---

# 场景：内存泄漏

## 背景

应用运行一段时间后内存持续增长，最终触发 OOM。

## 排查流程

### 第一阶段：确认问题

```bash
# 查看进程内存使用
ps -o pid,vsz,rss,pmem,comm -p <PID>

# 持续监控
while true; do 
  ps -o pid,vsz,rss,pmem,comm -p <PID> | tail -1
  sleep 5
done
```

### 第二阶段：定位内存分布

```bash
# 查看内存映射
pmap -x <PID>

# 查看详细信息
cat /proc/<PID>/status | grep -E "Vm|Rss"
```

### Java 应用排查

```bash
# 1. 生成堆转储
jmap -dump:format=b,file=heap.hprof <PID>

# 2. 分析堆
# 使用 MAT (Eclipse Memory Analyzer)
# 或 jhat
jhat heap.hprof

# 3. 查看对象数量
jmap -histo <PID> | head -50
```

### 常见原因

| 原因 | 特征 | 解决方案 |
|------|------|----------|
| 集合类无限增长 | HashMap 未清理 | 定期清理/限流 |
| 静态集合 | 类加载后不释放 | 重构代码 |
| 连接池泄漏 | 数据库连接未关闭 | 确保关闭 |
| 缓存未清理 | 缓存无上限 | LRU/TTL |
| ThreadLocal | 线程池复用 | 清理 |

## 解决措施

1. **临时处理**
   ```bash
   # 重启应用
   kubectl rollout restart deployment/myapp
   ```

2. **长期优化**
   ```java
   // 正确使用 ThreadLocal
   try {
       threadLocal.set(value);
       // 业务逻辑
   } finally {
       threadLocal.remove();  // 清理
   }
   ```

## 难度标签

<span className="difficulty-badge difficulty-advanced">高级</span>
<span className="company-tag">腾讯</span>
