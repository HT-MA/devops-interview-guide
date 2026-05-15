---
id: database-slow
title: 数据库慢查询
description: 数据库性能问题
---

# 场景：数据库慢查询

## 背景

接口响应时间突然变长，数据库 CPU 使用率高。

## 排查流程

### 第一阶段：定位慢查询

```sql
-- MySQL
SHOW FULL PROCESSLIST;
SELECT * FROM information_schema.processlist WHERE Command != 'Sleep';

-- PostgreSQL
SELECT * FROM pg_stat_activity WHERE state != 'idle';

-- MongoDB
db.currentOp()
```

### 第二阶段：分析执行计划

```sql
-- MySQL
EXPLAIN <query>;

-- PostgreSQL
EXPLAIN ANALYZE <query>;
```

### 第三阶段：查看索引

```sql
-- MySQL
SHOW INDEX FROM table_name;

-- PostgreSQL
SELECT * FROM pg_indexes WHERE tablename = 'table_name';
```

### 常见原因

| 原因 | 特征 | 解决方案 |
|------|------|----------|
| 缺少索引 | type=ALL | 添加索引 |
| 全表扫描 | rows 很大 | 优化 SQL |
| 锁等待 | State=Sleep | 减少长事务 |
| 连接池耗尽 | Too many connections | 增加连接数 |

## 解决措施

1. **临时处理**
   ```sql
   -- 杀掉慢查询
   KILL <process_id>;
   ```

2. **长期优化**
   - 添加合适索引
   - 优化 SQL 语句
   - 使用缓存
   - 读写分离

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
<span className="company-tag">阿里</span>
