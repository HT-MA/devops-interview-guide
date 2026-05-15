---
id: pod-lifecycle
title: Pod 生命周期
description: Kubernetes Pod 生命周期与状态管理
---

# Pod 生命周期

## 面试官想考什么

* Pod 状态与相位
* 容器状态
* Init Container
* 探针配置
* 生命周期钩子

## 标准答案

### Pod 生命周期

```
                    ┌─────────────────────┐
                    │     Pending         │
                    │  (调度+拉取镜像)    │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │     Running          │
                    │  Init容器→主容器运行 │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │    Succeeded         │
                    │  (正常完成退出码=0)  │
                    └─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     Failed          │
                    │  (异常退出退出码≠0) │
                    └─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    CrashLoopBackOff │
                    │  (容器重启循环)     │
                    └─────────────────────┘
```

### Pod 相位 (Phase)

| Phase | 说明 |
|-------|------|
| Pending | Pod 已被 Kubernetes 系统接受，等待调度 |
| Running | Pod 已绑定到节点，容器已创建 |
| Succeeded | 所有容器正常退出，不会重启 |
| Failed | 所有容器已终止，至少一个容器失败 |
| Unknown | 无法获取 Pod 状态 |
| CrashLoopBackOff | 不是 Phase，是容器状态 |

## Init Container

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  initContainers:
  - name: init-db
    image: busybox:1.36
    command: ['sh', '-c', 'until nslookup db-service; do echo waiting for db; sleep 2; done']
  - name: init-cache
    image: busybox:1.36
    command: ['sh', '-c', 'sleep 5']
  
  containers:
  - name: myapp
    image: myapp:v1
    ports:
    - containerPort: 8080
```

### 特点

* 先于主容器执行
* 必须全部成功才能启动主容器
* 每次重启都会重新执行
* 可以包含敏感数据

## 探针 (Probes)

### 存活探针 (livenessProbe)

判断容器是否需要重启

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp:v1
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 30      # 启动后等待时间
      periodSeconds: 10            # 检查间隔
      timeoutSeconds: 5            # 超时时间
      failureThreshold: 3          # 失败次数后重启
      successThreshold: 1          # 成功次数
```

### 就绪探针 (readinessProbe)

判断容器是否可以接收流量

```yaml
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 3
```

### 启动探针 (startupProbe)

判断容器是否启动完成

```yaml
    startupProbe:
      httpGet:
        path: /started
        port: 8080
      failureThreshold: 30
      periodSeconds: 10
```

### 三种探针对比

| 探针 | 失败后果 | 用途 |
|------|----------|------|
| livenessProbe | 重启容器 | 检测应用是否存活 |
| readinessProbe | 停止接收流量 | 检测是否可以服务 |
| startupProbe | 延迟其他探针 | 检测启动完成 |

## 生命周期钩子

```yaml
    lifecycle:
      postStart:
        exec:
          command: ["/bin/sh", "-c", "echo hello"]
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 10"]
```

## 常见问题

### CrashLoopBackOff

```bash
# 查看原因
kubectl describe pod myapp
kubectl logs myapp --previous

# 常见原因
# - 应用启动失败
# - 健康检查失败
# - OOMKilled
# - 镜像拉取失败
# - 配置文件缺失
```

### 排查流程

```bash
# 1. 查看 Pod 状态
kubectl get pod myapp -o wide

# 2. 查看详细事件
kubectl describe pod myapp

# 3. 查看日志
kubectl logs myapp
kubectl logs myapp -c init-container

# 4. 如果是 OOMKilled
kubectl describe pod myapp | grep -A 5 "Last State"
```

## 延伸问题

* Pod 重启策略是什么？
* 什么是 graceful shutdown？
* 探针失败阈值如何设置？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
