---
id: interview-k8s
title: Kubernetes 生产场景面试题
description: 8 个真实 Kubernetes 生产故障场景，涵盖 Pod、Node、网络、存储、安全等核心问题
---

# Kubernetes 生产场景面试题

---

## Q1: 新版本上线后 Pod 持续 CrashLoopBackOff，describe 显示健康检查失败

**场景描述**

团队将新版本微服务部署到生产环境，Deployment 的 Pod 启动后几秒钟就退出，状态显示 CrashLoopBackOff。查看 `kubectl describe pod` 发现 Liveness probe 失败。但开发人员在本地 Docker 运行完全没有问题。运维检查了镜像版本，确认是最新的，Pod 启动日志也显示服务正常启动了。

请问为什么本地正常但在 Kubernetes 中健康检查会失败？如何一步步排查？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、腾讯、快手

**答案要点**:
- CrashLoopBackOff 是 Kubernetes 在 Pod 反复重启后的退避状态
- 通过 `kubectl logs --previous` 查看上次容器的退出原因
- liveness/readiness probe 失败需要检查 probe 的 path、port、initialDelaySeconds
- 本地正常但 K8s 异常的原因可能是 probe 路径不一致、容器端口映射错误、依赖服务未就绪

**完整回答**:

CrashLoopBackOff 意味着 Pod 启动后立即崩溃，kubelet 不断重启它，每次重启间隔指数增长（10s、20s、40s...300s 封顶）。需要从状态、事件、日志三个维度联合排查。

排查流程：

```bash
# 1. 查看 Pod 状态和重启次数
kubectl get pod <pod-name>
# 输出示例：
# NAME                     READY   STATUS             RESTARTS   AGE
# myapp-6b4f9c5d7f-xk2lp   0/1     CrashLoopBackOff   12         15m
# 12 次重启，说明问题持续存在

# 2. 查看详细信息和事件
kubectl describe pod <pod-name>
# 重点关注以下字段：
# State:          Waiting (CrashLoopBackOff)
# Last State:     Terminated
#   Reason:       Error
#   Exit Code:    137
#   Finished At:  ...
# Events:
#   Warning  Unhealthy  12s  kubelet  Liveness probe failed: HTTP probe failed with statuscode: 503
```

Exit Code 137 表示进程被 SIGKILL（9）杀死。如果是 OOMKilled，状态里会明确指出。这里 exit code 137 + Health check probe failed，说明 Probe 失败了，kubelet 认为容器不健康而杀死它。

```bash
# 3. 查看容器上次运行的完整日志（--previous 看上次退出的日志）
kubectl logs <pod-name> --previous
# 日志正常，服务启动了，没有异常错误

# 4. 检查 liveness probe 配置
kubectl get pod <pod-name> -o yaml | grep -A 15 livenessProbe
# livenessProbe:
#   httpGet:
#     path: /health
#     port: 8080
#   initialDelaySeconds: 5
#   periodSeconds: 10
#   timeoutSeconds: 3
```

对比开发环境和 K8s 环境。这是一个真实案例：开发人员在代码中配置了 HTTP 监听端口为 8081（application.properties 中 `server.port=8081`），但 Dockerfile 中的 EXPOSE 是 8080，liveness probe 也配置的 8080。本地测试时开发人员用 docker run -p 8080:8081 做了端口映射所以正常，但在 K8s 中 port 定义是 8080，probe 连 8080 而容器在 8081 监听，导致 probe 失败。

```bash
# 5. 确认容器实际监听的端口
# 通过 kubectl exec 进入容器查看
kubectl exec -it <pod-name> -- netstat -tunlp
# 如果没有 netstat，用 ss
kubectl exec -it <pod-name> -- ss -tunlp

# 或者查看进程监听情况
kubectl exec -it <pod-name> -- cat /proc/1/cmdline
# 从启动参数中确认端口号

# 6. 查看 Pod 的 container port 定义
kubectl get pod <pod-name> -o yaml | grep -A 2 ports
```

发现容器实际在 8081 监听，但 liveness probe 配置的 8080，这就是问题原因。

修复方法：

```yaml
# 修改 Deployment，使 probe 端口与容器端口一致
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: myapp
        ports:
        - containerPort: 8081  # 与代码中的 server.port 一致
        livenessProbe:
          httpGet:
            path: /health
            port: 8081  # 修复这里
          initialDelaySeconds: 15  # 也适当增加启动等待时间
          periodSeconds: 10
```

还有其他常见的导致 CrashLoopBackOff 的原因：

**依赖服务未就绪**：应用启动时连接数据库/Redis，如果连接超时或拒绝连接，应用可能直接退出。解决方案是增加 initialDelaySeconds 或在应用层加入启动重试机制。

**资源限制过低**：memory limit 设置得太小，应用启动阶段即触发 OOM，exit code 137。

**启动命令或参数错误**：Entrypoint 或 CMD 与镜像实际路径不匹配。

**ConfigMap 挂载问题**：配置文件缺失或格式错误，应用启动时解析失败。

**追问**:
- Q: CrashLoopBackOff 中 backoff 的延迟时间是怎么计算的？为什么不能立即重启？
- Q: Exit Code 137 和 Exit Code 143 都代表 SIGKILL，怎么区分是 OOM 还是手动 kill？
- Q: readinessProbe 和 livenessProbe 的区别是什么？用错会导致什么后果？

---

## Q2: Node 突然 NotReady，节点上所有 Pod 不可用

**场景描述**

Kubernetes 集群中一个 worker node 突然从 Ready 变为 NotReady 状态，该节点上运行的 30 多个 Pod 全部失联。监控显示该节点的 CPU、内存、磁盘使用率都正常（都在 60% 以下）。`kubectl get nodes` 看到状态为 NotReady，但 ssh 登录到节点本身没有问题。

请问什么情况下 Node 会 NotReady？节点本身正常但 K8s 认为它不健康的原因可能是什么？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、阿里、字节跳动

**答案要点**:
- kubelet 定期向 apiserver 上报 Node 状态，如果 kubelet 的汇报异常则 node 变成 NotReady
- `journalctl -u kubelet` 查看 kubelet 日志寻找错误
- 常见原因：kubelet hang、CNI 插件故障、容器运行时（containerd/docker）异常
- 检查 `systemctl status kubelet` 确认 kubelet 进程状态
- 检查 `crictl pods` 确认容器运行时是否正常

**完整回答**:

Node 状态由 kubelet 通过 `NodeStatus` 更新机制定期上报。`--node-status-update-frequency` 默认为 10 秒，如果 controller-manager 在 `--node-monitor-grace-period`（默认 40 秒）内没有收到更新，就会将 node 标记为 Unknown，超过 `--pod-eviction-timeout`（默认 5 分钟）后将 Pod 驱逐。

排查步骤：

```bash
# 1. 确认 Node 的详细状态
kubectl describe node <node-name>
# 查看 Conditions 字段
# Conditions:
#   Type                 Status  LastHeartbeatTime  LastTransitionTime
#   Ready                Unknown ...               ...
#   DiskPressure         False
#   MemoryPressure       False
#   PIDPressure          False
# 注意 Ready 状态为 Unknown 而不是 False

# 2. SSH 登录节点，检查 kubelet 进程
ssh <node-ip>
systemctl status kubelet
# 可能输出：active (running) 或 inactive (dead) 或 failed
```

如果 kubelet 还是 running 但 node 状态异常：

```bash
# 3. 查看 kubelet 日志中的错误
journalctl -u kubelet --no-pager --since "5 minutes ago" | tail -100
# 可能出现的错误：
# - "failed to get node" — apiserver 连接问题
# - "PLEG is not healthy" — kubelet 内部的 Pod 生命周期事件处理异常
# - "Failed to update node status" — 上报状态失败
# - "network plugin is not ready" — CNI 异常

# 4. 检查容器运行时
crictl pods
# 如果 crictl 命令超时或报错，说明 containerd 有问题
systemctl status containerd

# 5. 检查 CNI 插件
ls /opt/cni/bin/
cat /etc/cni/net.d/*.conf

# 6. 检查 kubelet 证书是否过期
openssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -noout -dates
# 检查证书时间是否在有效期内
```

在实际案例中，有一种情况下节点本身一切正常（CPU、内存、磁盘都正常），但 kubelet 上报状态失败——原因是 kubelet 与 apiserver 之间的网络连接被网络策略或防火墙拦截了。

另一个实际案例：kubelet 的 PLEG（Pod Lifecycle Event Generator）不健康，导致 kubelet 无法正确感知 Pod 状态变化。PLEG 每 1 秒轮询一次容器运行时，如果 containerd 响应变慢，PLEG 会标记为不健康，进而 kubelet 停止上报 Node 状态，最终 Node 变成 NotReady。

```bash
# 检查 PLEG 状态
# 查看 kubelet 日志中是否有 "PLEG is not healthy"
journalctl -u kubelet --no-pager | grep -i "PLEG"

# PLEG 异常时的 kubelet 输出：
# Mar 11 10:30:00 node01 kubelet[12345]: E0311 10:30:00.123456   12345 pleg.go:320] 
#   PLEG is not healthy: pleg was last seen active 3m30s ago
```

PLEG 问题通常的根因是容器运行时（containerd/docker）出现了 hang 或响应超时。

恢复步骤：

```bash
# 情况 A：kubelet hang，重启 kubelet
systemctl restart kubelet
# 等 1-2 分钟后检查
kubectl get nodes

# 情况 B：容器运行时异常
systemctl restart containerd
# 然后重启 kubelet
systemctl restart kubelet

# 情况 C：证书过期
# 手动请求新证书
kubeadm certs renew kubelet.conf
systemctl restart kubelet

# 情况 D：节点被 controller-manager 驱逐
# 解决节点问题后，删除 NotReady 节点上的 Pod
kubectl delete pod <pod-name> --grace-period=0 --force
# 或者直接修复节点状态
kubectl patch node <node-name> -p '{"status":{"conditions":[{"type":"Ready","status":"True"}]}}'
```

**追问**:
- Q: `PLEG` 的工作原理是什么？为什么 PLEG 不健康会导致 Node 状态异常？
- Q: `kubectl get nodes` 显示 Ready 但节点上的 Pod 无法正常提供服务，可能是什么问题？
- Q: `node.kubernetes.io/unreachable` 和 `node.kubernetes.io/not-ready` 这两种 taint 有什么区别？对 Pod 调度有什么影响？

---

## Q3: 集群内服务间调用报错——DNS 解析间歇性失败

**场景描述**

Kubernetes 集群中，Service A 通过 Service Name 调用 Service B，每天固定时间段会有数十次 "connection refused" 或 "no such host" 错误。监控显示 Service B 的 Pod 正常运行，直接通过 Pod IP 调用也没有问题。而且 DNS 解析问题不是持续性，而是间歇性出现。

请问为什么通过 Service Name 调用会间歇性失败？如何定位 DNS 相关问题？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- CoreDNS Pod 异常重启或高负载会导致 DNS 解析间歇性失败
- `kubectl -n kube-system logs -l k8s-app=kube-dns` 查看 CoreDNS 日志
- 检查 CoreDNS 的配置（ConfigMap），确认是否配置了外部 DNS 转发
- 检查 Pod 的 `/etc/resolv.conf` 确认 DNS 搜索域和 nameserver
- CoreDNS 的 Pod 数与 Node 数比例不合适可能导致单点压力

**完整回答**:

这个场景的特点是：通过 Pod IP 调用正常（说明目标服务本身正常），但通过 Service Name 调用失败（说明 DNS 解析或 Service 转发有问题）。间歇性出现则说明不是配置写死的问题，而是某个组件在高负载或特定条件下出现性能瓶颈。

排查分为三个层面：DNS 解析层、Service 发现层、应用层。

第一步：确认 DNS 解析是否正常

```bash
# 在故障应用的 Pod 内测试 DNS 解析
kubectl exec -it <pod-a> -- nslookup service-b.default.svc.cluster.local
# 或
kubectl exec -it <pod-a> -- dig service-b.default.svc.cluster.local

# 如果 Pod 内没有 dig/nslookup，用 getent
kubectl exec -it <pod-a> -- getent hosts service-b
```

对比正常时段和故障时段的输出。故障时的可能输出：

```bash
# 正常：返回 Cluster IP
;; ANSWER SECTION:
service-b.default.svc.cluster.local. 5 IN A 10.96.1.15

# 故障：无应答或超时
;; connection timed out; no servers could be reached
```

第二步：检查 CoreDNS 状态

```bash
# 1. 查看 CoreDNS Pod 状态
kubectl -n kube-system get pods -l k8s-app=kube-dns
# NAME                       READY   STATUS    RESTARTS   AGE
# coredns-7d899874b7-abc12   1/1     Running   3          30d
# coredns-7d899874b7-xyz98   1/1     Running   0          30d
# 注意第一个 Pod 有 3 次重启记录

# 2. 查看 CoreDNS 日志
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=50
# 搜索关键字：timeout、refused、error
# 如果看到大量 "connection refused" 或 "i/o timeout" 说明上游 DNS 有问题

# 3. 检查 CoreDNS 的资源使用
kubectl -n kube-system top pod -l k8s-app=kube-dns
# CPU 如果持续接近 limit，说明 CoreDNS 在处理能力瓶颈
```

第三步：检查 Pod 的 DNS 配置

```bash
# 查看 Pod 的 DNS 解析配置
kubectl exec -it <pod-a> -- cat /etc/resolv.conf
# nameserver 10.96.0.10
# search default.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5
# 10.96.0.10 是 CoreDNS 的 Service Cluster IP
```

一个真实的案例：集群中有 100+ 个 Node，但 CoreDNS 只有 2 个副本。每天的流量高峰时段（晚 8-10 点），大量 Pod 同时进行 DNS 解析，2 个 CoreDNS Pod 的 CPU 被打满，导致部分 DNS 请求超时。应用端的表现就是间歇性的 "no such host"。

另一个案例：CoreDNS 配置了上游 DNS 转发（`forward . 8.8.8.8`），但外部 DNS 服务器在某些时段响应缓慢，导致 DNS 解析超时。这个问题的特征是：解析集群内 Service Name 正常（由 CoreDNS 直接回答），但解析外部域名时间歇性失败。

解决方案：

```bash
# 方案一：增加 CoreDNS 副本数
kubectl scale deployment -n kube-system coredns --replicas=5

# 方案二：使用 cluster-proportional-autoscaler 自动扩缩容
# 根据集群 Node 数和 Core 数自动调整 CoreDNS 副本
# 公式通常为：replicas = max(ceil(cores * 0.0625), ceil(nodes * 0.0625))
```

或者调整 CoreDNS 的部署拓扑：

```yaml
# 使用 anti-affinity 将 CoreDNS Pod 分布在不同 Node
# 避免单节点故障影响所有 DNS 解析
affinity:
  podAntiPreferredDuringSchedulingIgnoredDuringExecution:
  - weight: 100
    podAffinityTerm:
      labelSelector:
        matchExpressions:
        - key: k8s-app
          operator: In
          values:
          - kube-dns
      topologyKey: kubernetes.io/hostname
```

如果问题出在外部 DNS 转发：

```yaml
# 修改 CoreDNS ConfigMap，增加缓存时间和超时配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
        }
        prometheus :9153
        forward . /etc/resolv.conf {
            max_concurrent 1000  # 限制最大并发
            expire 30s          # 连接过期时间
        }
        cache 30                # 增加 DNS 缓存
        loop
        reload
        loadbalance
    }
```

**追问**:
- Q: Pod 中 /etc/resolv.conf 的 ndots:5 是什么意思？它对域名解析行为有什么影响？
- Q: headless Service（ClusterIP=None）的 DNS 解析和普通 Service 有什么不同？
- Q: CoreDNS 中的 plugin 执行顺序是怎么确定的？怎么排查某个 plugin 的 Bug？

---

## Q4: 集群证书过期，kubectl 所有命令报证书错误

**场景描述**

周一早上，运维人员执行 `kubectl get nodes` 时看到错误："Unable to connect to the server: x509: certificate has expired or is not yet valid"。检查 $HOME/.kube/config 确认 kubeconfig 文件没有变化。上周五下班前集群还在正常运行，周末没有人操作过集群。所有 kubectl 命令都无法执行，包括 `kubectl get pods`。

请问证书过期的影响范围有多大？如何在不重建集群的情况下恢复？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 腾讯、华为、阿里

**答案要点**:
- Kubernetes 集群有多层证书：CA 证书、apiserver 证书、kubelet 证书、kubeconfig 中的 client 证书
- kubeadm 部署的集群证书默认有效期 1 年
- 使用 `kubeadm certs check-expiration` 确认哪些证书过期
- kubeadm 可以提供证书续期命令，无需重建集群
- 如果 CA 证书过期，需要手动更新 kubeconfig 和所有组件的证书

**完整回答**:

Kubernetes 集群严重依赖证书体系。kube-apiserver 使用 TLS 证书对外提供 HTTPS 服务，kubelet、kube-scheduler、kube-controller-manager、kubectl 等所有组件都使用客户端证书进行身份验证。一旦 apiserver 的证书或 CA 证书过期，整个集群的控制面就不可用了——但节点上已有的 Pod 可能会继续运行，直到 Pod 需要重新连接 apiserver。

首先确认是哪种证书过期：

```bash
# 1. 查看 kubeconfig 中的证书过期时间
# kubeconfig 中嵌入了 client 证书（data 字段中的 client-certificate-data）
kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' | base64 -d | openssl x509 -noout -dates
# 如果这条命令也报错，说明客户端证书已经过期

# 如果 kubectl 无法使用，直接查看 kubeconfig 文件
cat ~/.kube/config | grep client-certificate-data | awk '{print $2}' | base64 -d | openssl x509 -noout -dates -noout
```

如果是 kubeadm 部署的集群：

```bash
# 2. 直接 SSH 到 master 节点，用 kubeadm 检查所有证书
ssh master-node
kubeadm certs check-expiration
# 输出示例：
# [check-expiration] Reading configuration from the cluster...
# CERTIFICATE                EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY EXTERNALLY MANAGED
# admin.conf                 May 10 2026 09:00 GMT    1d              no
# apiserver                  May 10 2026 09:00 GMT    1d              no      
# apiserver-kubelet-client   May 10 2026 09:00 GMT    1d              no
# front-proxy-client         May 10 2026 09:00 GMT    1d              no
# kubeadm.conf               May 10 2026 09:00 GMT    1d              no
# kubelet.conf               May 10 2026 09:00 GMT    1d              no       <- kubelet 证书也过期了
# controller-manager.conf    May 10 2026 09:00 GMT    1d              no
# scheduler.conf             May 10 2026 09:00 GMT    1d              no
# CA                         Jun 15 2035 09:00 GMT    9y              no       <- CA 证书还有效（10 年）
```

如果 CA 证书仍然有效（通常 CA 有效期 10 年，而组件证书仅 1 年），可以快速续期：

```bash
# 3. 续期所有证书
kubeadm certs renew all

# 4. 确认续期成功
kubeadm certs check-expiration
# 所有证书的 EXPIRES 应该更新为一年后

# 5. 重启控制面组件
# 如果使用 static pod（kubeadm 默认方式），需要重启 kubelet
systemctl restart kubelet

# 如果控制面组件是 systemd 服务
systemctl restart kube-apiserver kube-controller-manager kube-scheduler
```

如果 CA 证书也已过期，情况就复杂了——需要重建整个 PKI 体系：

```bash
# 6. 更新 kubeconfig 文件（CA 有效时也需要）
# kubeadm 不会自动更新 admin.conf
kubeadm kubeconfig user --client-name kubernetes-admin --config kubeadm-config.yaml > /etc/kubernetes/admin.conf
# 更新用户的 ~/.kube/config
cp /etc/kubernetes/admin.conf ~/.kube/config
```

对于非 kubeadm 部署的集群（二进制部署、kops、kubespray 等），续期方式各不相同，但核心思路一致——重新签发证书并分发到各个组件。

对于托管集群（EKS、AKS、TKE 等），证书由云厂商管理，通常不会出现这个问题。

恢复后的预防措施：

```bash
# 1. 设置证书过期监控（Prometheus 告警）
# 使用 blackbox-exporter 或 kube-cert-manager

# 2. kubeadm 的自动续期
# kubeadm v1.15+ 的 kubelet 证书在达到 80% 生命周期时会自动续期
# 但 apiserver、admin.conf 等需要手动续期

# 3. 延长证书有效期（如果安全策略允许）
# 在 kubeadm 初始化时指定 --certificate-validity-period
kubeadm init --certificate-validity-period=36500d  # 100 年

# 4. 使用 cert-manager 自动管理证书
# cert-manager 可以自动轮换 TLS 证书
```

**追问**:
- Q: kube-apiserver 使用的证书 SAN 需要包含哪些域名/IP？漏了会怎样？
- Q: etcd 的证书和 Kubernetes 控制面的证书是同一套吗？etcd 证书过期会影响集群吗？
- Q: Kubernetes 1.22+ 版本中，kubelet 的 TLS bootstrap 机制是如何自动轮换证书的？

---

## Q5: kubectl apply 返回 "exceeded quota"，资源配额超限

**场景描述**

开发团队在部署新服务时，执行 `kubectl apply -f deployment.yaml` 后收到错误 "exceeded quota"。但该命名空间中运行的 Pod 数量并不多（不到 10 个），每个 Pod 的资源请求也很小。开发人员怀疑是运维设置了过紧的资源配额。

请问资源配额（ResourceQuota）的检查范围包括哪些资源？如何查看当前使用量和配额限制？如果确实需要更多资源，应该如何操作？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、美团、快手

**答案要点**:
- ResourceQuota 限制的是命名空间级别的资源累计使用量（requests/limits 的总和）
- 即使 Pod 数量不多，如果每个 Pod 声明了较大的 requests/limits，累计可能超限
- `kubectl describe quota -n <namespace>` 查看当前配额和使用量
- `kubectl get quota -n <namespace>` 查看资源配额名称
- 解决方案：增加配额或调整 Pod 的资源请求

**完整回答**:

ResourceQuota 是命名空间级别的资源限制机制，它统计的是该命名空间下所有 Pod 的资源请求（requests）和限制（limits）的累计值。不仅是 CPU 和内存，还包括存储卷声明（PVCs）的数量和大小、Services、ConfigMaps、Secrets 等对象数量。

排查步骤：

```bash
# 1. 查看错误详情
# 完整的错误信息通常包含具体超出哪个配额的哪项资源
# Error from server (Forbidden): error when creating "deployment.yaml":
#   exceeded quota: compute-resources
#   requested: requests.memory=2Gi
#   used: requests.memory=190Gi
#   limited: requests.memory=200Gi
# 看到 requests.memory 已经用了 190Gi，只剩下 10Gi，但新服务需要 2Gi

# 2. 查看命名空间的所有配额
kubectl get quota -n <namespace>
# NAME                AGE    REQUEST                      LIMIT
# compute-resources   30d    requests.cpu: 80/100,        limits.cpu: 150/200
#                            requests.memory: 190Gi/200Gi, limits.memory: 350Gi/400Gi
#                            pods: 8/50

# 3. 查看配额的详细信息
kubectl describe quota -n <namespace>
# 这会列出每项资源的使用量/上限
```

从输出来看，`requests.memory` 使用了 190Gi，上限 200Gi，剩余不到 10Gi。新 Deployment 要求 2Gi，超出了剩余配额。

但开发人员说 "只有不到 10 个 Pod，每个 Pod 资源很小"——这里可能有认知偏差：Pod 的资源声明和实际使用是两个概念。

```bash
# 4. 查看每个 Pod 实际声明的资源 requests
kubectl get pods -n <namespace> -o custom-columns=NAME:.metadata.name,MEM_REQ:.spec.containers[0].resources.requests.memory,CPU_REQ:.spec.containers[0].resources.requests.cpu

# 5. 如果缺省值（没有显式设置 resources.requests），查看 LimitRange
kubectl describe limitrange -n <namespace>
# LimitRange 会设置默认的 requests/limits 值
# 如果 Pod 没有显式设置 resources，LimitRange 会注入默认值
```

一个真实案例：开发人员编写 Deployment 时没有显式设置 `resources.requests`，但命名空间中配置了 LimitRange，默认注入 `requests.memory: 512Mi`。8 个 Pod 每个 512Mi 并不会导致 190Gi。深入排查发现命名空间中存在很多 "僵尸" Pod——这些 Pod 已经被 Deployment 滚动更新替换了，但旧的 ReplicaSet 和 Pod 没有被清理。

```bash
# 6. 查看所有 ReplicaSet（包括旧的）
kubectl get rs -n <namespace>
# NAME                        DESIRED   CURRENT   READY   AGE
# myapp-6b4f9c5d7f           3         3         3       1d
# myapp-5a2e8b9c1d           0         0         0       30d   <- 这个旧的 RS 虽然 DESIRED=0，但配额已计入
```

旧的 ReplicaSet（RS）虽然 DESIRED=0，但在某些版本中存在配额计算 Bug，或者其实有残留 Pod 没有被完全清理。检查并清理：

```bash
# 清理旧 RS
kubectl delete rs -n <namespace> myapp-5a2e8b9c1d

# 确认使用量下降
kubectl describe quota -n <namespace>
```

如果确认确实是业务增长需要更多资源，可以向集群管理员申请调整配额：

```bash
# 7. 编辑 ResourceQuota（需要足够权限）
kubectl edit quota compute-resources -n <namespace>
```

调整后的 ResourceQuota 示例：

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-resources
spec:
  hard:
    requests.cpu: "200"          # 从 100 增加到 200
    requests.memory: "400Gi"     # 从 200Gi 增加到 400Gi
    limits.cpu: "400"
    limits.memory: "800Gi"
    pods: "100"
    persistentvolumeclaims: "20"
    services: "50"
    configmaps: "30"
    secrets: "30"
```

配额规划的建议：

- requests 应设置为业务实际使用量的 1.2-1.5 倍
- limits 应设置为 requests 的 2-4 倍（根据业务的突发特性）
- 不要将配额设得太紧，留出 20-30% 的缓冲空间
- 使用 `kubectl describe quota` 定期审查配额使用率，提前扩容

**追问**:
- Q: ResourceQuota 和 LimitRange 的区别是什么？LimitRange 会影响 ResourceQuota 的计算吗？
- Q: 如果一个 Pod 没有设置 resources.requests，也没有 LimitRange，ResourceQuota 如何计算它的资源使用？
- Q: 不同 QoS 等级（Guaranteed、Burstable、BestEffort）的 Pod，ResourceQuota 的计算方式有区别吗？

---

## Q6: PVC 一直处于 Pending 状态，无法挂载到 Pod

**场景描述**

部署一个有状态服务时，Pod 一直处于 Pending 状态。`kubectl describe pod` 显示原因是 "persistentvolumeclaim "data-pvc" not found"。但 `kubectl get pvc` 显示 PVC 存在，状态是 Pending。StorageClass 已经配置，集群中有多个可用 Node。

请问 PVC Pending 的原因可能有哪些？如何一步步排查到根因？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、华为、阿里

**答案要点**:
- 检查 PVC 的 StorageClass 是否存在：`kubectl get storageclass`
- 检查 PV 是否已被创建：`kubectl get pv`
- PVC Pending 说明没有匹配的 PV 可用，且动态 provisioning 没有成功创建 PV
- 常见原因：StorageClass 的 provisioner 不存在、存储后端连接失败、卷数量达到配额上限
- `kubectl describe pvc <name>` 中的 Events 会给出具体原因

**完整回答**:

PVC（PersistentVolumeClaim）是 Pod 对存储的请求。PVC Pending 意味着 Kubernetes 无法为其找到一个可用的 PersistentVolume（PV）。有两种模式：静态绑定（匹配已有的 PV）和动态绑定（通过 StorageClass 的 provisioner 创建新 PV）。

排查流程：

```bash
# 1. 查看 PVC 的详细信息和事件
kubectl describe pvc data-pvc
# 重点查看：
# Status:        Pending
# Events:
#   Normal  FailedBinding  2m  persistentvolume-controller  no persistent volumes available for this claim and no storage class is set
# 或者：
#   Warning  ProvisioningFailed  1m  persistentvolume-controller  Failed to provision volume with StorageClass "fast-storage": ...
```

从 Events 可以看出是哪种情况。

```bash
# 2. 检查 StorageClass 是否存在
kubectl get storageclass
# NAME            PROVISIONER                    RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION
# fast-storage    kubernetes.io/no-provisioner   Delete          Immediate           false
# 注意这里的 PROVISIONER 是 no-provisioner，说明这是一个"静态"StorageClass
# 或者 PROVISIONER 应该是一个 CSI 驱动名，如 disk.csi.aliyun.com、ebs.csi.aws.com

# 3. 检查 StorageClass 详情
kubectl describe storageclass fast-storage
# Parameters 字段可能包含 region、zone 等参数
```

场景一：StorageClass 使用 `kubernetes.io/no-provisioner`（即静态绑定）。这种情况下不会自动创建 PV，需要手动创建 PV 才能绑定。

```bash
# 检查是否有可绑定的 PV
kubectl get pv
# 如果没有匹配的 PV，需要手动创建
```

创建匹配的 PV：

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: manual-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteOnce
  # 最关键：匹配 PVC 的 StorageClass
  storageClassName: fast-storage
  nfs:
    path: /data/nfs
    server: nfs-server.internal
```

场景二：StorageClass 使用了动态 provisioner（如 CSI 驱动），但 provisioner 工作异常。

```bash
# 查看 CSI 驱动的 Pod 是否正常运行（通常在 kube-system）
kubectl get pods -n kube-system | grep csi

# 查看 provisioner 的日志
kubectl logs -n kube-system <csi-controller-pod> --tail=100
```

常见的 provisioner 错误：

```bash
# 错误 1：存储后端连接失败
# "Failed to create disk: RequestError: send request failed"
# 原因：云厂商 API 限流或网络问题
# 解决：重试或联系云厂商

# 错误 2：存储限额不足
# "Maximum volume count exceeded"
# 原因：云账号的磁盘配额已满
# 解决：申请提高磁盘配额

# 错误 3：可用区不匹配
# "Disk can only be created in zone us-east-1a, but node is in us-east-1b"
# 原因：StorageClass 或 PVC 指定了可用区，但调度 Pod 的节点在不同可用区
# 解决：使用 WaitForFirstConsumer 卷绑定模式
```

```yaml
# 方案：设置 volumeBindingMode 为 WaitForFirstConsumer
# 这样 PV 的创建时机推迟到 Pod 被调度之后，provisioner 会根据 Pod 所在的可用区创建磁盘
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-storage
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer  # 修复关键
parameters:
  type: gp3
```

**追问**:
- Q: `volumeBindingMode: WaitForFirstConsumer` 和 `Immediate` 有什么区别？各有什么适用场景？
- Q: PV 的 Reclaim Policy（Retain/Delete/Recycle）对数据安全有什么影响？
- Q: 一个 PVC 可以同时被多个 Pod 使用吗？accessModes（ReadWriteOnce、ReadOnlyMany、ReadWriteMany）各适用于什么场景？

---

## Q7: Pod 反复 OOMKilled，增加内存限制后仍然被 Kill

**场景描述**

某 Java 微服务的 Pod 频繁被 OOMKilled，状态中显示 "Exit Code: 137"。运维人员将 memory limit 从 512Mi 逐步增加到 2Gi，但问题仍然存在，只是复现时间从 30 分钟延长到了 2 小时。通过 `kubectl top pod` 观察到 Pod 的内存使用稳步增长直到触发 limit。

请问仅仅增加 limit 为什么不能解决问题？除了 OOMKilled 还有什么需要关注的？如何从根本上解决？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- OOMKilled 是 Pod 内存使用量超过了 limits.memory，被 cgroup OOM Killer 杀死
- 持续增加 limit 只是推迟了 OOM 发生的时间，没有解决内存泄漏的根因
- Java 应用需要关注 JVM 堆内存与非堆内存的区别
- 使用 `jstat -gc` 和 heap dump 分析内存泄漏点
- 需要区分是内存泄漏还是配置不合理（-Xmx 设置）

**完整回答**:

OOMKilled 的判断机制是：Pod 中所有容器的内存使用总和超过了 `limits.memory`，cgroup 的 OOM Killer 会选择并杀死进程。仅仅增加 limit 只是让病床变大了，但病人（应用）的内存消耗会继续增长直到填满新 limit。

这里有一个 Java 特有的陷阱：很多开发人员认为设置了 `-Xmx`（最大堆内存）就能控制内存使用，但在容器环境中，JVM 默认的 MaxRAM 可能不感知 cgroup 限制。

排查步骤：

```bash
# 1. 确认 OOMKilled 状态
kubectl describe pod <pod-name> | grep -A 10 "Last State"
# Last State:     Terminated
#   Reason:       OOMKilled
#   Exit Code:    137
#   Finished At:  ...

# 2. 查看 Pod 的资源限制
kubectl get pod <pod-name> -o yaml | grep -A 5 resources
# resources:
#   limits:
#     memory: 2Gi
#   requests:
#     memory: 1Gi

# 3. 查看 Pod 的实际内存使用
kubectl top pod <pod-name>
# NAME      CPU(cores)   MEMORY(bytes)
# myapp     850m         1950Mi
# 看到内存已经接近 2Gi 的 limit
```

持续增加 limit 后内存依然会达到新的 limit：

```bash
# 修改为 4Gi 后
kubectl top pod <pod-name>
# NAME      CPU(cores)   MEMORY(bytes)
# myapp     900m         3950Mi
# 问题仍然存在，只是延迟
```

在 Java 应用中，一个经典问题是 JVM 在容器中未正确配置：

```bash
# 4. 进入容器查看 JVM 参数
kubectl exec -it <pod-name> -- ps -ef | grep java
# 或者查看启动参数
kubectl exec -it <pod-name> -- cat /proc/1/cmdline | tr '\0' ' '
# 如果看到 -Xmx4g -Xms4g，但容器 limit 只有 2Gi，这就是问题
```

JVM 的 `-Xmx` 设置了堆内存上限，但 JVM 进程的总内存 = 堆内存 + 元空间 + 线程栈 + JIT 编译 + GC 开销 + 直接内存 + native 内存。如果 `-Xmx` 设为 4g，仅堆就可能达到 4Gi，加上非堆部分可能轻松超过 5Gi，远超容器 2Gi 的 limit。

修复方案：

```yaml
# 方案一：设置 JVM 参数适配容器内存限制
# 对于 JDK 8u131+ 和 JDK 10+，JVM 默认感知 cgroup 内存限制
# 但需要显式启用：
# -XX:+UnlockExperimentalVMOptions -XX:+UseCGroupMemoryLimitForHeap (JDK 8)
# 或直接使用 -XX:MaxRAMPercentage (JDK 8u191+)

# Deployment 中的 env:
env:
- name: JAVA_OPTS
  value: "-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
```

```yaml
# 方案二：合理的资源设置
resources:
  requests:
    memory: "2Gi"
  limits:
    memory: "4Gi"
# JVM -Xmx 设为 3Gi（即 limits 的 75%）
# 保留 1Gi 给非堆内存（元空间、线程栈、直接内存）
```

如果问题确实是内存泄漏，需要进一步分析：

```bash
# 5. 在 Pod 被 OOM 之前，获取 heap dump
# 可以提前配置 -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp
# 或者使用 jmap
kubectl exec <pod-name> -- jmap -dump:format=b,file=/tmp/heap.hprof <pid>

# 6. 复制 heap dump 到本地分析
kubectl cp <pod-name>:/tmp/heap.hprof ./heap.hprof
```

非 Java 场景的 OOMKilled：

Node.js：

```bash
# Node.js 的 --max-old-space-size 参数控制堆内存
kubectl exec <pod-name> -- node -e "console.log(v8.getHeapStatistics())"
# NODE_OPTIONS="--max-old-space-size=512" 适配容器内存
```

Go：

```bash
# Go 应用通常内存管理较好，OOMKilled 常见原因是内存泄漏或 goroutine 泄漏
# 查看 goroutine 数量
kubectl exec <pod-name> -- wget -q -O- http://localhost:8080/debug/pprof/goroutine
# 使用 pprof 分析
```

**追问**:
- Q: Exit Code 137 可能是 OOMKilled 也可能是手动 kubectl delete pod 造成的，如何区分？
- Q: Kubernetes 的 QoS 等级（Guaranteed、Burstable、BestEffort）和 OOM 优先级是什么关系？
- Q: 为什么同一个 Pod 中，OOM Killer 选择杀掉某个特定容器而不是其他容器？

---

## Q8: 新部署的网络策略导致服务间调用全部超时

**场景描述**

安全团队在命名空间中应用了默认的网络策略（NetworkPolicy）以加强隔离，目标是仅允许白名单中的服务间通信。但策略应用后，该命名空间中所有服务的外部调用全部超时，包括访问外部 API。监控显示 Pod 都在运行，health check 通过，但业务接口全部返回 502。

请问 NetworkPolicy 的工作原理是什么？如何排查策略导致的问题？在不关闭安全策略的前提下如何修复？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、华为

**答案要点**:
- NetworkPolicy 通过标签选择器和命名空间选择器控制 Pod 的入站（ingress）和出站（egress）流量
- 默认情况下不设置 NetworkPolicy 时 Pod 允许所有流量
- 一旦在命名空间中应用了 NetworkPolicy，未被策略显式允许的流量会被拒绝
- 使用 `kubectl describe networkpolicy` 查看策略规则
- 使用 `kubectl run busybox --rm -it --image=busybox -- sh` 测试连通性

**完整回答**:

NetworkPolicy 是 Kubernetes 的网络安全机制，由 CNI 插件（Calico、Cilium、Weave 等）实现。关键行为特性：

- 如果没有 NetworkPolicy，所有入站和出站流量都是允许的（默认全通）
- 一旦有 NetworkPolicy 选中了一个 Pod，对该 Pod 的所有未显式允许的流量都会被拒绝
- 如果策略只定义了 ingress 规则，那么 egress 不受影响（反之亦然）
- 但如果同时有多个策略，它们是 OR 逻辑——只要有一个策略允许，流量就通过

排查步骤：

```bash
# 1. 查看命名空间中所有 NetworkPolicy
kubectl get networkpolicy -n <namespace>
# NAME                           POD-SELECTOR     AGE
# deny-all-ingress              <none>           1h
# allow-specific-ingress        app=myapp        1h

# 2. 查看具体策略的详细规则
kubectl describe networkpolicy deny-all-ingress -n <namespace>
# 如果看到 podSelector: {} 且没有 ingress 规则
# 这意味着所有 Pod 的入站流量都被拒绝
# 这就是"默认拒绝所有"策略

# 也检查 egress 规则
kubectl describe networkpolicy allow-specific-ingress -n <namespace>
```

问题定位：应用了 `deny-all-ingress` 策略后，外部请求无法到达服务。同时可能也有 `deny-all-egress` 策略阻止了 Pod 对外部 API 的调用。

```bash
# 3. 诊断连通性
# 创建一个测试 Pod 进行网络诊断
kubectl run test-pod --rm -it --image=nicolaka/netshoot -- sh

# 在 test-pod 内测试
# 测试同命名空间的服务
curl -v http://myapp-service:8080/health
# 如果卡住或超时，说明入站流量被拒绝

# 测试跨命名空间的服务
curl -v http://other-service.other-ns.svc.cluster.local:8080
# 超时也可能是因为 egress 规则

# 测试外部 API
curl -v https://api.example.com
# 超时说明 egress 规则拦截了出站流量

# 4. 检查 egress 规则是否允许 DNS 解析
# 如果 egress 规则没有允许 UDP 53 端口的出站流量，DNS 解析会失败
nslookup kubernetes.default.svc.cluster.local
# 如果解析失败，说明 DNS 被 egress 规则拦截
```

一个真实案例：安全团队部署了以下策略：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
spec:
  podSelector: {}
  policyTypes:
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
```

第一个策略 `default-deny-egress` 拒绝了所有 Pod 的出站流量。第二个策略 `allow-dns` 打开了 DNS 出口。但问题是——业务 Pod 还需要访问外部 API、数据库等服务，而它们没有被任何 egress 规则允许。

修复方案——创建合理的 egress 规则：

```yaml
# 允许 Pod 访问指定外部服务
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress-external-api
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
  - Egress
  egress:
  # 允许出口到外部 API
  - to:
    - ipBlock:
        cidr: 203.0.113.0/24  # 外部 API 的 IP 范围
    ports:
    - port: 443
      protocol: TCP
  # 允许 DNS 解析
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
  # 允许集群内访问其他服务
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: <target-namespace>
    ports:
    - port: 8080
      protocol: TCP
```

或者使用更灵活的命名空间级别默认策略：

```yaml
# 宽松但安全的默认策略
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  # 出站不受限制——只拒绝入站
# 这样 Pod 可以自由访问外部，但外部不能随意访问 Pod
```

排查 NetworkPolicy 故障的关键检查点：

```bash
# 5. 确认 CNI 插件是否正常实现了 NetworkPolicy
# Calico
calicoctl get networkpolicy

# Cilium
cilium endpoint list
cilium policy trace

# 6. 检查 CNI 是否启用了 NetworkPolicy（有些 CNI 默认不启用）
kubectl -n kube-system get pods -l k8s-app=calico-node
```

**追问**:
- Q: NetworkPolicy 的 `podSelector: {}` 和 `podSelector: null` 有什么区别？
- Q: 如果两个 NetworkPolicy 同时选中同一个 Pod，规则是 AND 还是 OR 逻辑？
- Q: Calico 的 GlobalNetworkPolicy 和 Kubernetes 的 NetworkPolicy 有什么不同？什么场景需要用到前者？

---

