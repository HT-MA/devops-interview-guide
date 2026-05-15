---
id: process-management
title: 进程管理
description: Linux 进程管理核心知识点
---

# Linux 进程管理

## 面试官想考什么

* 进程与线程的区别
* 进程状态转换
* 进程调度机制
* 进程间通信

## 标准答案

### 进程 vs 线程

| 特性 | 进程 | 线程 |
|------|------|------|
| 资源占用 | 独立地址空间 | 共享地址空间 |
| 创建开销 | 大 | 小 |
| 通信 | IPC | 直接读写 |
| 切换开销 | 大 | 小 |

### 进程状态

```
R - Running/S Runnable
S - Sleeping (可中断)
D - Disk Sleep (不可中断)
Z - Zombie
T - Stopped
I - Idle
```

## 常见命令

### ps 命令

```bash
# 查看所有进程
ps aux

# 查看特定进程
ps -ef | grep nginx

# 树形显示进程
pstree -p

# 显示线程
ps -eLf
```

### top 命令

```bash
# 交互式界面
top

# 显示特定用户进程
top -u www-data

# 高亮排序
top 后按 M (内存) 或 P (CPU)
```

### 进程控制

```bash
# 后台运行
nohup command &

# 杀死进程
kill -9 PID
kill -15 PID

# 查看进程树
pstree
```

## 实战经验

生产环境中最常见的进程问题：

1. **僵尸进程** - 子进程退出但父进程未回收
   ```bash
   # 查看僵尸进程
   ps aux | grep defunct
   
   # 杀死父进程
   kill -9 PPID
   ```

2. **进程 CPU 100%** - 先定位是哪个进程，再定位具体线程
   ```bash
   top
   # 按 H 切换到线程视图
   ```

3. **进程僵死** - D 状态不可中断，通常是 I/O 问题

## 延伸问题

* Linux 调度算法是什么？(CFS 完全公平调度器)
* 什么是 OOM Killer？
* 如何限制进程资源？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
