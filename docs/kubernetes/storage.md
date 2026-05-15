---
id: storage
title: 存储管理
description: Kubernetes 存储卷与持久化
---

# Kubernetes 存储

## 面试官想考什么

* 存储卷类型
* PV/PVC 机制
* 存储类
* CSI

## 标准答案

### 存储卷类型

| 类型 | 说明 | 生命周期 |
|------|------|----------|
| emptyDir | 临时存储 | Pod 删除即丢失 |
| hostPath | 节点文件 | Pod 删除保留 |
| NFS | 网络文件系统 | 持久化 |
| cloud | 云存储 | 持久化 |
| PersistentVolumeClaim | 持久卷申领 | 持久化 |

### emptyDir

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp:v1
    volumeMounts:
    - name: cache
      mountPath: /tmp/cache
  volumes:
  - name: cache
    emptyDir:
      sizeLimit: 100Mi
      medium: Memory  # 内存文件系统
```

### hostPath

```yaml
volumes:
- name: data
  hostPath:
    path: /data/myapp
    type: DirectoryOrCreate
```

### NFS

```yaml
volumes:
- name: nfs-storage
  nfs:
    server: nfs.example.com
    path: /share
```

## PV/PVC

### 概念

```
┌─────────────────────────────────────────────────────────┐
│                         PVC                              │
│                 (PersistentVolumeClaim)                   │
│                 request: 10Gi storage                    │
└─────────────────────────┬───────────────────────────────┘
                          │ Bind
┌─────────────────────────▼───────────────────────────────┐
│                          PV                               │
│              (PersistentVolume)                            │
│                  50Gi NFS storage                        │
└─────────────────────────────────────────────────────────┘
```

### PV 定义

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-nfs
spec:
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteMany      # 多个节点可读写
  persistentVolumeReclaimPolicy: Retain  # Retain/Delete/Recycle
  storageClassName: nfs
  nfs:
    server: nfs.example.com
    path: /data
```

### PVC 使用

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mypvc
spec:
  storageClassName: nfs
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp:v1
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: mypvc
```

### Access Modes

| 模式 | 简写 | 说明 |
|------|------|------|
| ReadWriteOnce | RWO | 单节点读写 |
| ReadOnlyMany | ROX | 多节点只读 |
| ReadWriteMany | RWX | 多节点读写 |

## StorageClass

### 动态供给

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-storage
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: regional-pd
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
```

### 云厂商示例

```yaml
# AWS EBS
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ebs-sc
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  encrypted: "true"

# Azure Disk
provisioner: disk.csi.azure.com
parameters:
  storageAccountType: StandardSSD_LRS

# GCP PD
provisioner: pd.csi.storage.gke.io
```

## CSI

### 工作原理

```
┌─────────────────────────────────────────┐
│            Pod                          │
│  volumeMounts:                          │
│    - name: data                         │
│      mountPath: /data                   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         CSI Driver (第三方)               │
│  - Controller Plugin (控制平面)          │
│  - Node Plugin (节点平面)                 │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         CSI Plugin (用户空间)              │
│  - CreateVolume                          │
│  - DeleteVolume                          │
│  - NodeStage/NodePublish                 │
└─────────────────────────────────────────┘
```

### CSI 使用示例

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: csi-sc
provisioner: hostpath.csi.k8s.io
reclaimPolicy: Delete
volumeBindingMode: Immediate
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mypvc
spec:
  storageClassName: csi-sc
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

## 常见问题

### PVC 一直 Pending

```bash
# 查看原因
kubectl describe pvc mypvc

# 常见原因
# - 存储类不存在
# - 没有满足条件的 PV
# - StorageClass 未配置默认
```

### 权限问题

```yaml
# 使用 Pod Security Standards
apiVersion: v1
kind: Pod
spec:
  securityContext:
    fsGroup: 1000
    runAsUser: 1000
  containers:
  - name: myapp
    securityContext:
      allowPrivilegeEscalation: false
```

### 数据持久化

```bash
# StatefulSet 存储
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    spec:
      containers:
      - name: mysql
        volumeMounts:
        - name: data
          mountPath: /var/lib/mysql
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: "standard"
      resources:
        requests:
          storage: 10Gi
```

## 延伸问题

* Local PV vs Remote PV？
* 存储快照如何实现？
* 如何迁移 PV 数据？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
