---
id: systemd
title: Systemd
description: Systemd 服务管理核心知识点
---

# Systemd 服务管理

## 面试官想考什么

* Systemd 基础概念
* Unit 文件配置
* 服务管理命令
* 日志管理

## 标准答案

### Systemd 架构

```
systemctl
    ↓
systemd (PID 1)
    ↓
    ├── unit files
    ├── cgroups
    └── systemd-journald
```

### Unit 类型

| 类型 | 后缀 | 说明 |
|------|------|------|
| Service | .service | 进程服务 |
| Socket | .socket | 套接字 |
| Target | .target | 目标组 |
| Timer | .timer | 定时任务 |
| Path | .path | 路径监控 |
| Mount | .mount | 挂载点 |

## 常见命令

### 服务管理

```bash
# 启动/停止/重启
systemctl start nginx
systemctl stop nginx
systemctl restart nginx

# 重载配置
systemctl reload nginx

# 查看状态
systemctl status nginx

# 开机自启
systemctl enable nginx
systemctl disable nginx

# 查看是否自启
systemctl is-enabled nginx

# 查看所有服务
systemctl list-units --type=service
systemctl list-unit-files --type=service
```

### 依赖管理

```bash
# 查看依赖
systemctl list-dependencies nginx.service

# 查看被依赖
systemctl list-dependencies --reverse nginx.service
```

## Unit 文件结构

```ini
[Unit]
Description=Nginx HTTP Server
Documentation=https://nginx.org/en/docs/
After=network.target remote-fs.target nss-lookup.target
Wants=network-online.target

[Service]
Type=forking
PIDFile=/run/nginx.pid
ExecStartPre=/usr/sbin/nginx -t
ExecStart=/usr/sbin/nginx
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s QUIT $MAINPID
PrivateTmp=true
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Type 类型

| Type | 说明 | 使用场景 |
|------|------|----------|
| simple | 主进程直接运行 | 大多数服务 |
| forking | fork 后父进程退出 | 传统 daemon |
| oneshot | 执行一次退出 | 一次性任务 |
| dbus | 通过 D-Bus 获取名称 | 需要 D-Bus |
| notify | 启动完成发送通知 | systemd 感知 |

### Restart 策略

```ini
Restart=no           # 不重启
Restart=on-failure    # 失败时重启
Restart=on-success    # 成功时重启
Restart=always        # 总是重启
RestartSec=5          # 重启间隔
```

## 日志管理

### journalctl

```bash
# 查看所有日志
journalctl

# 查看实时日志
journalctl -f

# 查看特定服务日志
journalctl -u nginx

# 查看最近日志
journalctl -n 100

# 按时间过滤
journalctl --since "1 hour ago"
journalctl --since "2024-01-01" --until "2024-01-02"

# 查看错误日志
journalctl -p err

# 查看内核日志
journalctl -k

# 磁盘占用
journalctl --disk-usage
```

### 日志配置

```bash
# /etc/systemd/journald.conf
MaxRetentionSec=30day
MaxSize=500M
SystemMaxUse=2G
```

## 常见问题

### 服务启动失败

```bash
# 查看详细状态
systemctl status nginx -l

# 查看启动日志
journalctl -u nginx -n 100 --no-pager

# 测试配置文件
nginx -t

# 检查依赖
systemctl list-dependencies nginx
```

### 资源限制

```ini
[Service]
# 内存限制
MemoryMax=512M
MemoryHigh=400M

# CPU 限制
CPUQuota=50%

# 文件句柄
LimitNOFILE=65535

# 进程数
LimitNPROC=4096
```

### 性能相关

```bash
# 查看 cgroup 资源
systemd-cgtop

# 查看服务资源占用
systemctl status nginx

# 查看服务 PID
systemctl show nginx -p MainPID
```

## 实战经验

1. **服务卡住无法停止**
   ```bash
   # 强制杀死
   systemctl kill -s SIGKILL nginx
   
   # 或修改 Unit 添加强制杀死
   TimeoutStopSec=1
   ```

2. **忘记 Root 密码**
   ```bash
   # 进入 rescue 模式修改
   # 勿用于生产环境!
   ```

3. **升级后服务异常**
   ```bash
   # 重新加载 systemd
   systemctl daemon-reload
   
   # 重启服务
   systemctl try-restart nginx
   ```

## 延伸问题

* cgroup 是什么？
* 如何限制容器资源？
* Systemd 和 Docker 的关系？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
