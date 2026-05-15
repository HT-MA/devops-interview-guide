---
id: configmap-secret
title: ConfigMap 与 Secret
description: Kubernetes 配置管理
---

# ConfigMap 与 Secret

## 面试官想考什么

* ConfigMap vs Secret 区别
* 使用方式
* 最佳实践
* 安全考虑

## 标准答案

### 区别

| 特性 | ConfigMap | Secret |
|------|-----------|--------|
| 用途 | 非敏感配置 | 敏感数据 |
| 加密 | 明文存储 | Base64 编码(可选加密) |
| 类型 | 字符串/文件 | Opaque/Docker/K8s等 |
| 数量限制 | 1MB | 1MB |
| 默认存储 | etcd 明文 | etcd 可配置加密 |

## ConfigMap

### 创建方式

```bash
# 从字面量
kubectl create configmap myconfig \
  --from-literal=ENV=production \
  --from-literal=LOG_LEVEL=info

# 从文件
kubectl create configmap myconfig \
  --from-file=config.properties

# 从目录
kubectl create configmap myconfig \
  --from-file=./config/

# 从 env 文件
kubectl create configmap myconfig \
  --from-env-file=config.env
```

### YAML 定义

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myconfig
data:
  ENV: "production"
  LOG_LEVEL: "info"
  database.yml: |
    database:
      host: localhost
      port: 5432
```

## Secret

### 类型

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mysecret
type: Opaque  # 通用类型
data:
  username: dXNlcm5hbWU=      # echo -n 'username' | base64
  password: cGFzc3dvcmQ=     # echo -n 'password' | base64

---
# TLS Secret
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
type: kubernetes.io/tls
data:
  tls.crt: <cert>
  tls.key: <key>

---
# Docker Registry Secret
apiVersion: v1
kind: Secret
metadata:
  name: regcred
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-config>
```

## 使用方式

### 环境变量

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp:v1
    env:
    - name: ENV
      valueFrom:
        configMapKeyRef:
          name: myconfig
          key: ENV
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
```

### 多个环境变量

```yaml
envFrom:
- configMapRef:
    name: myconfig
- secretRef:
    name: mysecret
```

### Volume 挂载

```yaml
spec:
  containers:
  - name: myapp
    image: myapp:v1
    volumeMounts:
    - name: config
      mountPath: /etc/config
      readOnly: true
    - name: secrets
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: config
    configMap:
      name: myconfig
  - name: secrets
    secret:
      secretName: mysecret
```

### 文件挂载示例

```bash
# ConfigMap 文件会挂载为文件
kubectl exec myapp -- ls /etc/config
# 输出:
# database.yml
# ENV
# LOG_LEVEL

# Secret 文件内容
kubectl exec myapp -- cat /etc/secrets/username
# 输出:
# username
```

## 最佳实践

### 配置热更新

```bash
# ConfigMap 更新后自动同步(需要应用支持)
kubectl create configmap myconfig --from-literal=VERSION=v2 --dry-run=client -o yaml | kubectl apply -f -

# Secret 更新
kubectl patch secret mysecret -p '{"data":{"password":"bmV3cGFzc3dvcmQ="}}'
```

### SubPath 问题

```yaml
# 注意：使用 subPath 不会感知 ConfigMap 更新
volumeMounts:
- name: config
  mountPath: /etc/config/database.yml
  subPath: database.yml   # 更新不会生效
```

### 使用 volume 策略

```yaml
volumes:
- name: config
  configMap:
    name: myconfig
    items:
    - key: database.yml
      path: database.yml
```

## 安全考虑

### Secret 加密 (KMS)

```yaml
# 启用加密
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aesgcm: {}
  - kms:
      name: my-kms-plugin
      endpoint: unix:///var/run/kms.socket
```

### RBAC 控制

```yaml
# 只允许特定 namespace 访问
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["mysecret"]
  verbs: ["get", "list"]
```

### 最佳实践清单

| 实践 | 说明 |
|------|------|
| 不存储敏感信息在镜像中 | 使用 Secret |
| Secret 加密存储 | 启用 KMS |
| 最小化 RBAC | 按 namespace 隔离 |
| 定期轮换 | Secret 定期更新 |
| 不提交到 Git | 使用 sealed-secrets |
| 外部密钥管理 | Vault/ AWS Secrets Manager |

## 常见问题

### Secret 无法挂载

```bash
# 检查 Secret 是否存在
kubectl get secret mysecret

# 检查 key 是否正确
kubectl describe secret mysecret

# 检查挂载路径
kubectl describe pod myapp
```

### 权限问题

```yaml
# Pod 使用 ServiceAccount
spec:
  serviceAccountName: my-sa

# ServiceAccount 关联 Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
```

## 延伸问题

* 什么是 Sealed Secrets？
* Vault 和 Kubernetes Secret 的集成？
* External Secrets Operator？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
