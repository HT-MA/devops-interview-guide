---
id: pod-crash
title: Pod 崩溃
description: Pod CrashLoopBackOff 排查
---

# 场景：Pod CrashLoopBackOff

## 背景

Pod 一直处于 CrashLoopBackOff 状态，不断重启。

## 排查流程

### 第一阶段：查看状态

```bash
# 查看 Pod 状态
kubectl get pod <name>

# 查看详细事件
kubectl describe pod <name>
```

### 第二阶段：查看日志

```bash
# 查看当前日志
kubectl logs <name>

# 查看上次运行的日志
kubectl logs <name> --previous
```

### 第三阶段：常见原因

| 原因 | 排查方法 | 解决方案 |
|------|----------|----------|
| 镜像拉取失败 | `kubectl describe pod` | 检查镜像仓库 |
| 健康检查失败 | 查看探针配置 | 调整探针 |
| OOMKilled | `kubectl describe pod` | 增加内存限制 |
| 命令错误 | 查看 exit code | 修正启动命令 |
| 配置文件缺失 | 查看日志 | 挂载配置 |

### OOMKilled 排查

```bash
# 查看终止原因
kubectl describe pod <name> | grep -A 5 "Last State"

# 查看系统日志
dmesg | grep -i "oom"
dmesg | grep -i "killed process"
```

## 解决措施

1. **增加资源限制**
   ```yaml
   resources:
     requests:
       memory: "256Mi"
     limits:
       memory: "512Mi"
   ```

2. **调整健康检查**
   ```yaml
   livenessProbe:
     httpGet:
       path: /health
       port: 8080
     initialDelaySeconds: 30
     periodSeconds: 10
   ```

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
