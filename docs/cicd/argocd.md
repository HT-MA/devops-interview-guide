---
id: argocd
title: ArgoCD
description: GitOps 与 ArgoCD 部署
---

# ArgoCD

## 面试官想考什么

* GitOps 理念
* ArgoCD 工作原理
* 应用部署
* 同步策略

## 标准答案

### GitOps 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Git Repo                             │
│                  (应用定义/配置/K8s manifests)                │
└─────────────────────────┬───────────────────────────────────┘
                          │ 拉取
┌─────────────────────────▼───────────────────────────────────┐
│                      ArgoCD                                  │
│                   (GitOps 控制器)                            │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  Sync Engine    │    Health Check    │    Rollback  │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ 部署
┌─────────────────────────▼───────────────────────────────────┐
│                   Kubernetes Cluster                          │
└─────────────────────────────────────────────────────────────┘
```

### Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/example/k8s-config
    targetRevision: HEAD
    path: production/myapp
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### Sync 策略

```yaml
spec:
  syncPolicy:
    automated:
      prune: true      # 自动删除
      selfHeal: true  # 自动同步
      allowEmpty: false
```

## 常用命令

```bash
# CLI 安装
argocd login argocd.example.com

# 同步应用
argocd app sync myapp

# 手动同步
argocd app set myapp --sync-policy automated

# 回滚
argocd app rollback myapp

# 查看状态
argocd app get myapp
```

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
