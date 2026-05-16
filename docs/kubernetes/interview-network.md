---
id: interview-network
title: Kubernetes 网络面试题
description: CNI 插件对比、kube-proxy 模式、Service/EndpointSlice、NetworkPolicy、CoreDNS、Gateway API、双栈网络等高级面试题
---

# Kubernetes 网络面试题

## Q1: 请对比 Calico、Flannel 和 Cilium 三种 CNI 插件的架构设计、性能差异和适用场景。在选择 CNI 时需要考虑哪些因素？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯、华为

**答案要点**:
- Flannel 使用 VXLAN 或 host-gw 封装，简单但功能有限
- Calico 使用纯三层 BGP 路由，性能高且内置 NetworkPolicy
- Cilium 基于 eBPF 技术，提供网络、安全和可观测性一体化方案
- 选择 CNI 需考虑性能要求、网络策略需求、团队技术栈和运维复杂度
- 大规模集群推荐 Calico 或 Cilium，小规模测试可选 Flannel

**完整回答**:

CNI（Container Network Interface）是 Kubernetes 网络模型的具体实现。在生产环境中选择 CNI 直接影响到集群的网络性能、安全性和运维复杂度。

**Flannel**：

Flannel 是 Kubernetes 生态中最早的 CNI 插件之一，设计哲学是简单。核心机制是为每个节点分配一个子网（如 /24），节点内的 Pod 从该子网获取 IP。跨节点的 Pod 通信通过 VXLAN 隧道或 host-gw 模式实现。

VXLAN 模式下，Flannel 在宿主机上创建一个 flannel.1 接口作为 VTEP，Pod 发出的数据包经过 veth 到 cni0 网桥，再到 flannel.1 隧道接口，封装 VXLAN 头部后通过宿主机的 eth0 发送出去。接收端解封装后交付给目标 Pod。VXLAN 模式的优势是对底层网络没有特殊要求（只需要 IP 可达），但封装和解封装带来了大约 5-10% 的性能损耗。

host-gw 模式不经过隧道封装，直接在节点路由表中添加远端 Pod 子网的路由条目，下一跳指向对端节点的物理 IP。这种模式性能接近裸机网络，但要求所有节点必须在同一个二层网络内（ARP 可达），不具备跨子网能力。

Flannel 的核心局限在于不提供 NetworkPolicy 支持，也没有更高级的网络安全能力。此外 Flannel 的架构不支持基于策略的路由，不适用于复杂的多租户隔离需求。

**Calico**：

Calico 采用纯三层 BGP 路由方案，没有隧道封装。每个节点运行一个 BGP 客户端（通常是 Bird），将 Pod CIDR 路由广播给其他节点或 ToR 交换机。数据包到达宿主机后直接根据路由表转发到对端节点，性能接近宿主机之间的直接通信。

Calico 的核心优势在于：
- Felix（Calico 的 Agent）负责将 NetworkPolicy 翻译为 iptables 规则，提供完整的 Kubernetes NetworkPolicy 实现
- 支持 eBPF 数据面模式，进一步减少内核网络栈的损耗
- 支持 IPIP 封装（当节点不在同一网络段时作为 BGP 的补充）
- 支持 DSR（Direct Server Return），减少返回路径的跳数

Calico 的主要缺点：
- BGP 在大规模集群（超过 1000 节点）时需要小心设计，防止路由表膨胀
- 配置复杂度高于 Flannel
- iptables 模式下规则数量多时性能退化明显（每增加一条 NetworkPolicy 规则都会转化为多条 iptables chain 规则）

**Cilium**：

Cilium 是当前 CNI 领域最前沿的方案，基于 Linux 内核的 eBPF（extended Berkeley Packet Filter）技术实现。eBPF 允许在不需要修改内核代码或加载内核模块的情况下，动态注入和执行沙箱化的程序到内核中。

Cilium 的技术特点：
- 完全绕过 iptables，通过 eBPF 程序直接在内核网络栈的关键钩子点处理数据包
- 使用 BPF 的 map 结构实现高效的 Pod 查表和负载均衡
- 内置 L3/L4/L7 网络策略，支持 HTTP/gRPC/Kafka 等七层协议的可见性和访问控制
- 提供 Hubble 可观测性平台，实时展示服务到服务的通信拓扑
- 支持基于 identity 的安全策略（而非基于 IP），Pod 创建时分配安全身份，避免 IP 变动违反策略

性能对比（基于 Cloud Native Lab 的基准测试）：
- 吞吐量：Cilium（eBPF）> Calico（BGP）> Flannel（host-gw）> Flannel（VXLAN）
- TCP 吞吐：Cilium 比 iptables 模式的 Calico 高约 30-50%
- 延迟：Cilium（eBPF）比 Flannel（VXLAN）低约 40-60%

**选型决策因素**：

| 因素 | 推荐 |
|------|------|
| 团队 eBPF 经验充足，对性能敏感 | Cilium |
| 需要严格的 NetworkPolicy，已部署 iptables 生态 | Calico |
| 小规模测试、PoC，运维人员少 | Flannel 或 Calico |
| 需要 L7 网络策略和可观测性（HTTP/gRPC 流量可视化） | Cilium |
| 已有 BGP 网络基础设施 | Calico |
| 云原生安全审计、零信任网络 | Cilium |

**追问**:
- Q: Calico 的 eBPF 数据面和 Cilium 的 eBPF 实现有什么本质区别？
- Q: Flannel VXLAN 模式下，数据包的 MTU 需要考虑什么？为什么 Pod 之间通信的 MTU 通常是 1450？
- Q: 如何在不重建集群的情况下迁移 CNI 插件？迁移过程中需要注意什么？

---

## Q2: kube-proxy 的三种工作模式（iptables、IPVS、eBPF）在实现原理、性能特性和功能范围上有什么区别？生产环境如何选择？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 阿里、字节跳动、腾讯云

**答案要点**:
- iptables 模式基于 Netfilter 的规则链匹配，随着 Service 数量增加性能线性下降
- IPVS 模式基于内核哈希表，时间复杂度 O(1)，支持更多负载均衡算法
- eBPF 模式（Cilium 等实现）直接在 XDP/TC 层处理，性能最高
- iptables 模式在 Service 超过 1000 时规则更新延迟显著增加
- IPVS 模式是当前大多数生产集群的默认选择

**完整回答**:

kube-proxy 是 Kubernetes 网络模型的实现者之一，负责将 Service 的 ClusterIP 流量转发到后端 Pod。在理解 kube-proxy 之前需要明确：kube-proxy 在数据面上并不是真正的"代理"，它不接收流量再转发，而是通过修改节点的网络规则，让内核直接处理流量转发。

**iptables 模式**：

iptables 模式是最早的 kube-proxy 实现方式。kube-proxy 监听 API Server 的 Service 和 Endpoint 变更，然后将转发规则写入 iptables 的 NAT 表中。

工作原理如下：当请求到达 ClusterIP:Port，iptables 的 PREROUTING 链将其引导到 KUBE-SERVICES 自定义链。KUBE-SERVICES 链匹配目标 ClusterIP 后跳转到对应的 Service 链。Service 链使用 statistic 模块的 random 模式实现概率负载均衡，每个后端 Pod 对应一条规则。

iptables 模式的问题在于规则链是线性遍历的。当集群中的 Service 数量增加时，规则链的长度同步增长。一个有 5000 个 Service 的集群，iptables 规则的数量可达 5-10 万条。每次匹配都需要遍历整个链，虽然 conntrack 能缓解一部分压力，但新连接的首包延迟明显。更严重的问题是规则更新——当 Service 增加或删除时，kube-proxy 需要更新所有 iptables 规则，这是全量替换操作，更新过程中可能造成短暂的连接中断。

**IPVS 模式**：

IPVS（IP Virtual Server）是 Linux 内核内置的 Layer 4 负载均衡模块，使用哈希表实现 O(1) 时间复杂度的查找。IPVS 模式下的 kube-proxy 将 Service 对应到 IPVS 的 virtual server，将 Endpoint 对应到 real server。

IPVS 支持多种调度算法：
- rr（轮询）：按顺序分配，请求均匀分布但无法感知后端负载
- wrr（加权轮询）：给不同后端分配不同权重
- lc（最少连接）：分配给活跃连接最少的后端
- sh（源地址哈希）：同一源 IP 映射到同一后端

IPVS 相比 iptables 的优势：
- 查找时间复杂度 O(1)，不受 Service 数量影响
- 支持更多负载均衡算法
- 后端健康检查能力（虽然 kube-proxy 自己维护 Endpoint，未直接利用 IPVS 的 health check）
- 规则更新只需调用 ipvsadm 操作对应的 virtual server，不需要全量替换

缺点：
- 依赖 ip_vs 内核模块和 conntrack 模块加载
- 不支持更复杂的匹配条件（如基于源 IP 的 QoS），在这些场景下仍需回退到 iptables
- kube-proxy 用 ipset 辅助管理需要 iptables 参与的部分（如 NodePort、externalIPs）

**eBPF 模式**：

严格来说这不是 kube-proxy 内置的模式，而是 Cilium 等 CNI 插件替代 kube-proxy 的方式。通过 eBPF 在 XDP（eXpress Data Path）层或 TC（Traffic Control）层实现 Service 的负载均衡。

eBPF 模式的性能优势：
- 在 XDP 层处理的请求完全绕过了内核协议栈，延迟极低
- 使用 BPF 哈希表做 Service 查找，性能不受规模影响
- 支持 direct routing 模式，不需要 DNAT 和 SNAT，减少 conntrack 条目
- Cilium 的 Maglev 一致性哈希算法在 backend 变更时影响最小

**生产环境选择建议**：

集群规模在 1000 个 Service 以下时，iptables 和 IPVS 的性能差异不明显，选择哪个取决于运维习惯。集群规模在 1000 个 Service 以上，强制选择 IPVS 模式。如果对延迟敏感（如金融交易系统），考虑使用 Cilium 的 eBPF kube-proxy replacement，在 XDP 层处理 Service 转发，延迟可降低 30-50%。

切换命令：
```bash
# 修改 kube-proxy 配置
kubectl edit configmap -n kube-system kube-proxy
# 将 mode 从 "" 改为 "ipvs"
# 重启 kube-proxy Pod
kubectl rollout restart -n kube-system daemonset kube-proxy
```

**追问**:
- Q: kube-proxy 的 IPVS 模式下为什么要保留一部分 iptables 规则？这些规则的作用是什么？
- Q: Cilium 替代 kube-proxy 后，Service 的 NodePort 和 LoadBalancer 类型是如何实现的？
- Q: 启用 IPVS 模式后，如何监控每个 Service 的后端连接分布？有哪些工具可以查看？

---

## Q3: Kubernetes Service 有哪几种类型？它们在底层实现上有什么区别？EndpointSlice 相比传统的 Endpoints 有哪些优势？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- 四种 Service 类型：ClusterIP、NodePort、LoadBalancer、ExternalName
- ClusterIP 在集群内部通过 kube-proxy 实现虚拟 IP 的负载均衡
- NodePort 在 ClusterIP 的基础上在每个节点上开放端口
- LoadBalancer 在 NodePort 的基础上对接外部负载均衡器
- EndpointSlice 解决了传统 Endpoints 在大量后端时的性能瓶颈

**完整回答**:

Service 是 Kubernetes 中访问 Pod 的抽象层。它的核心价值在于为后端 Pod 提供稳定的访问入口，无论 Pod 如何动态扩缩容、重启或迁移。

**四种 Service 类型的工作机制**：

**ClusterIP**：这是默认类型。Kubernetes 会为 Service 分配一个虚拟 IP（ClusterIP），这个 IP 只在集群内部可达。kube-proxy 在该 IP 上设置 iptables/IPVS/eBPF 规则，将目标为 ClusterIP:Port 的流量转发到后端 Pod。

ClusterIP 的设计有一个有意思的细节：这个 IP 实际上并不存在于任何网络接口上（它不是通过 L2/L3 协议可达的），它是一个存在于内核 Netfilter 规则中的虚拟 IP。所以也无法 ping 通 ClusterIP——ping 使用的是 ICMP 协议，而 Service 的转发规则只处理 TCP/UDP/SCTP。

**NodePort**：在 ClusterIP 的基础上，kube-proxy 在每个节点的 30000-32767 端口范围内开放监听。流量路径为：外部请求 → 宿主机 IP:NodePort → ClusterIP:Port → 后端 Pod。

注意 NodePort 有一个"二次跳转"的问题。当请求到达 Node A 的 30080 端口时，kube-proxy 不保证后端 Pod 在本节点，可能跨节点转发。跨节点转发意味着多一次网络跳转和 SNAT，推荐在 NodePort 前面加一层 LoadBalancer（无论是云厂商的 LB 还是自建的 HAProxy/Nginx）。

**LoadBalancer**：云托管集群（如 AKS、EKS、GKE）中，创建 LoadBalancer 类型的 Service 会触发云厂商自动创建外部负载均衡器。负载均衡器的后端是集群中所有节点的 NodePort 端口。数据路径为：外部请求 → 云 LB → 节点 IP:NodePort → ClusterIP:Port → Pod。

这里有一个性能优化点：某些云厂商支持保留客户端源 IP（externalTrafficPolicy: Local），当设置为 Local 时，流量被转发到 Pod 所在节点的 NodePort，不再跨节点转发，避免了 SNAT。但代价是负载可能不均匀，因为 LB 不知道每个节点有多少 Pod。

**ExternalName**：不是一个真正的代理服务，只是一个 DNS CNAME 记录。当 Pod 通过 Service 名称访问 ExternalName Service 时，CoreDNS 直接返回 CNAME 指向的外部域名。这个类型通常用于将集群外部的数据库、中间件等服务封装为 Kubernetes 原生的访问方式。

**EndpointSlice 的引入**：

在 Kubernetes 1.21 之前，Service 的后端 Pod 列表存储在 Endpoints 资源中。当 Endpoints 中的后端数量增多时，问题逐渐暴露：一个 Service 对应唯一的 Endpoints 对象，后端 Pod 数量增加时该对象的大小也不断增长。当 Service 有 1000 个后端 Pod 时，Endpoints 对象可能超过 50KB。每次后端变更（Pod 扩缩容、滚动更新），API Server 都需要序列化整个 Endpoints 对象并通知所有 watcher，这对 API Server 和 etcd 都是不小的压力。

EndpointSlice 将后端的存储打散：

```yaml
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: myapp-svc-abc123
  labels:
    kubernetes.io/service-name: myapp-svc
addressType: IPv4
ports:
- name: http
  port: 8080
  protocol: TCP
endpoints:
- addresses:
  - 10.244.1.10
  conditions:
    ready: true
  node: node1
  zone: us-east-1a
```

每个 EndpointSlice 默认最多包含 100 个端点。当 Service 有 1000 个 Pod 时，会被分为 10 个 EndpointSlice。其中一个 Pod 的变更只需要更新对应的 EndpointSlice，影响范围缩小到原来的十分之一。这对于 Service Mesh、Gateway API 等需要在每个 Pod 上运行 sidecar 监听 Service 变更的场景，是至关重要的性能提升。

**追问**:
- Q: externalTrafficPolicy: Local 的优缺点是什么？哪些场景下适合使用？
- Q: Headless Service（clusterIP: None）的 DNS 解析行为是怎样的？StatefulSet 为什么依赖它？
- Q: ClusterIP 如果指定为特定 IP（非自动分配），需要满足什么条件？有哪些注意事项？

---

## Q4: Kubernetes 原生的 NetworkPolicy 有哪些功能和局限性？CiliumNetworkPolicy 在这些基础上做了哪些增强？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、华为、蚂蚁集团

**答案要点**:
- NetworkPolicy 通过标签选择器定义 Pod 之间的网络访问规则
- NetworkPolicy 支持 L3/L4（IP + 端口）级别，不支持 L7（HTTP/gRPC 等）控制
- NetworkPolicy 的默认行为是允许所有流量，一旦有策略应用到 Pod，未显式允许的流量将被拒绝
- CiliumNetworkPolicy 在 NetworkPolicy 基础上增加了 L7、CIDR 规则、DNS、Kubernetes 实体等能力
- CiliumNetworkPolicy 还支持基于身份的安全策略，不依赖 IP 地址

**完整回答**:

**Kubernetes NetworkPolicy 的实现机制**：

NetworkPolicy 是一个规格资源，真正的策略执行由 CNI 插件（Calico、Cilium、Antrea 等）完成。如果 CNI 插件不支持 NetworkPolicy（如 Flannel），配置了 NetworkPolicy 也不会产生任何作用。

NetworkPolicy 的工作原理基于白名单模式。一个 Namespace 中没有任何 NetworkPolicy 时，所有 Pod 的进出流量不受限制。一旦一个 NetworkPolicy 选中了某个 Pod，默认策略变为拒绝所有未显式允许的流量。

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-policy
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          role: frontend
    ports:
    - port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - port: 5432
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 10.0.0.0/8
```

这个例子做了三件事：
1. 允许标签为 app=api 的 Pod 接收来自标签为 role=frontend 的 Pod 在 8080 端口的请求
2. 允许 app=api 的 Pod 访问 app=database 的 Pod 的 5432 端口
3. 允许 app=api 的 Pod 访问除 10.0.0.0/8 外的所有外部地址

**NetworkPolicy 的局限性**：

**不支持 L7 协议**：无法限制允许 HTTP GET 但禁止 HTTP DELETE，或者限制访问 /api/v1/users 但不能访问 /admin。这不只是策略表达的问题，更是安全模型上的缺口——在零信任网络模型中，需要按应用协议做控制。

**ipBlock 管理困难**：当使用 ipBlock 规则时，如果后端的 Pod IP 频繁变动（尤其是使用 Calico 等动态分配 IP 的 CNI），策略维护变得非常棘手。这也是为什么 Kubernetes 原生策略推荐尽量使用 podSelector 而不是 ipBlock。

**不支持 DNS 解析策略**：无法表达"允许访问 example.com:443 但禁止其他外部地址"这类策略。所有的规则必须以 IP/CIDR 形式表达。

**不支持 deny 规则**：NetworkPolicy 只有 allow 语义，无法表达"禁止访问某个特定 IP"这样的否定规则。如果需要 deny，只能通过不将该规则加入 allow 列表实现，但这在大规模集群中难以管理。

**CiliumNetworkPolicy 的增强**：

CiliumNetworkPolicy（CNP）是 Cilium 提供的 CRD，完全兼容 Kubernetes NetworkPolicy 的全部语义，并在此基础上增加了大量高级功能。

**L7 策略**：

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: api-l7-policy
spec:
  endpointSelector:
    matchLabels:
      app: api
  ingress:
  - fromEndpoints:
    - matchLabels:
        role: frontend
    toPorts:
    - ports:
      - port: "8080"
        protocol: TCP
      rules:
        http:
        - method: GET
          path: "/api/v1/orders/?"
        - method: POST
          path: "/api/v1/orders"
```

这个策略允许前端只调用 API 服务的 GET /api/v1/orders 和 POST /api/v1/orders，其他路径或方法（DELETE /api/v1/orders、GET /admin 等）被拒绝。L7 策略通过 Cilium 的代理（Envoy）实现，请求经过策略检查后再转发到后端 Pod。

**基于 Identity 而非 IP 的策略**：

Cilium 为每个 Pod 分配一个安全身份（Security Identity），基于 label 的 SHA256 哈希。即使 Pod 的 IP 发生变化，只要 label 不变，安全身份保持不变。这意味着 CiliumNetworkPolicy 的 toEndpoints/fromEndpoints 策略不受 IP 变化的影响。

**DNS 策略**：

```yaml
egress:
- toFQDNs:
  - matchName: "*.amazonaws.com"
  toPorts:
  - ports:
    - port: "443"
```

直接通过域名允许访问外部服务，Cilium 会在 DNS 解析层面做策略校验。注意这里的 DNS 策略只在 Pod 发起 DNS 查询时生效，Cilium 拦截 DNS 响应并缓存解析结果用于后续策略检查。

**追问**:
- Q: Cilium 的 L7 策略是否对所有经过的 HTTP 请求都增加了延迟？如何优化？
- Q: 在裸金属集群中，如何实现类似云厂商安全组的节点级别网络隔离？NetworkPolicy 能做到吗？
- Q: 如何实现"拒绝所有来自 test Namespace 的流量"这类全局策略？Kubernetes 原生和 Cilium 分别如何实现？

---

## Q5: CoreDNS 在 Kubernetes 集群中的 DNS 解析流程是怎样的？ndots 参数如何影响 DNS 查询行为？如何排查和优化 DNS 性能问题？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、美团

**答案要点**:
- CoreDNS 是 Kubernetes 的默认 DNS 组件，通过 kubernetes 插件实现服务发现
- Pod 的 /etc/resolv.conf 通过 dnsPolicy 控制，默认值为 ClusterFirst
- ndots 参数决定域名查询的搜索域尝试策略，默认值为 5
- ndots:5 导致大量不必要的 DNS 查询，是 DNS 延迟的常见原因
- 优化策略包括调整 ndots、使用 NodeLocal DNSCache、合理配置 CoreDNS 的 autopath 插件

**完整回答**:

**CoreDNS 架构**：

CoreDNS 通过插件链工作。当收到 DNS 查询时，按照 Corefile 配置的插件顺序依次处理。对于 Kubernetes 集群，最关键的插件是 kubernetes 插件，它将 Service 名称解析为 ClusterIP。

```
Pod → CoreDNS Service ClusterIP (10.96.0.10) → CoreDNS Pod
                                                    │
                                                    ├── kubernetes 插件 (Service 解析)
                                                    ├── forward 插件 (外部 DNS 转发)
                                                    └── prometheus 插件 (指标暴露)
```

CoreDNS 部署为 Deployment，通常 2 个副本。每个副本的 Corefile 配置：

```yaml
apiVersion: v1
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
```

**DNS 解析流程**：

当一个 Pod 发起域名解析（如 `curl http://myapp-svc`）时，系统调用 `getaddrinfo` 时首先检查 `/etc/resolv.conf`中的 ndots 配置来决定查询策略。

Pod 的 `/etc/resolv.conf` 内容示例：
```
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

解析流程如下：

1. 应用发起查询 `myapp-svc`
2. libc 检查域名中的点的数量。`myapp-svc` 有 1 个点，而 ndots=5，1 小于 5
3. libc 认为这是短名称，需要先用搜索域尝试绝对域名
4. 依次向 CoreDNS 发起查询：
   - `myapp-svc.default.svc.cluster.local.`
   - `myapp-svc.svc.cluster.local.`
   - `myapp-svc.cluster.local.`
   - 然后尝试原始名称 `myapp-svc.`（作为绝对域名）
5. `myapp-svc.default.svc.cluster.local.` 被 CoreDNS 的 kubernetes 插件匹配并返回 ClusterIP
6. 后续的搜索域查询被终止

这里的问题在于第 4 步中，前三次查询都会产生 DNS 流量，虽然最终在第一个就成功，但剩余的查询仍然被发出（只是 libc 会缓存结果并使用第一个有效的响应）。在某些实现中（如 musl libc、alpine 的基础镜像），DNS 解析不遵循 ndots 的搜索域行为，导致解析失败。

**ndots 参数的优化**：

ndots:5 的默认值是为了在内部服务名（如 myapp-svc，没有点）和外部域名（如 example.com，有一个点）之间取得平衡。但实际生产环境中，这个默认值会导致大量的 DNS 查询放大。

优化方案：
- 对于已知域名都有点的应用程序，设置 `ndots:1`
- 或者直接使用 FQDN（Fully Qualified Domain Name）：`myapp-svc.default.svc.cluster.local.`（注意末尾的点）

可以通过 Pod 的 dnsConfig 字段：

```yaml
spec:
  dnsConfig:
    options:
    - name: ndots
      value: "2"
  dnsPolicy: ClusterFirst
```

**性能优化策略**：

**NodeLocal DNSCache**：在集群规模大（节点数 > 500）时，CoreDNS 的查询压力可能成为瓶颈。NodeLocal DNSCache 在每个节点上运行一个 DaemonSet，作为本地 DNS 缓存代理。Pod 的 DNS 请求首先到达本地缓存，缓存未命中时才请求 CoreDNS。这大幅降低了 CoreDNS Pod 的查询压力，同时减少了 DNS 延迟（缓存命中时延迟从 ms 级降到 us 级）。

```bash
# 部署 NodeLocal DNSCache
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kubernetes/master/cluster/addons/dns/nodelocaldns/nodelocaldns.yaml
```

**CoreDNS autopath 插件**：autopath 插件可以优化搜索域展开的查询。当 CoreDNS 收到一个搜索域展开的查询时，autopath 可以判断这个查询是否来自已知 Namespace 的 Pod，如果是，直接返回正确的响应，不需要等待其他搜索域的查询。这需要在 Corefile 中启用 autopath 插件并与 kubernetes 插件配合。

**CoreDNS HPA**：生产环境建议为 CoreDNS 启用基于 CPU 和内存指标的 HPA，监控 CoreDNS Pod 的 `coredns_dns_requests_total` 和 `coredns_dns_request_duration_seconds` 指标，当请求量高时自动扩容。

**追问**:
- Q: 为什么使用 Alpine 镜像的 Pod 有时会出现 DNS 解析问题？Alpine 使用的 musl libc 与 glibc 的 DNS 解析行为有什么不同？
- Q: CoreDNS 的 forward 插件中 max_concurrent 参数的作用是什么？设置得过低或过高分别有什么后果？
- Q: 如何排查"偶尔出现 DNS 解析超时"的间歇性 DNS 故障？排查路径是什么？

---

## Q6: Ingress 和 Gateway API 在设计理念、能力和适用场景上有什么区别？Gateway API 解决了 Ingress 的哪些不足？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯云

**答案要点**:
- Ingress 是 Kubernetes 1.19 进入 GA 的 API，定义了 HTTP/HTTPS 路由规则
- Gateway API 是 SIG-Network 推动的新一代 API，将 Ingress 的功能分解为 GatewayClass、Gateway、HTTPRoute 等多个角色
- Ingress 的局限在于：只支持 HTTP、无法精细化管理南北向流量、缺乏角色分离
- Gateway API 支持 HTTP、TCP、UDP、TLS 等多种协议，支持跨 Namespace 的路由和策略绑定
- Gateway API 引入了面向角色的资源模型：基础设施提供商、集群管理员、应用开发者

**完整回答**:

**Ingress 的设计和局限**：

Ingress 是 Kubernetes 中最早的南北向流量管理 API。它的设计非常简洁：一个 Ingress 资源定义路由规则，一个 Ingress Controller 实现这些规则。Ingress 的设计哲学是"为 HTTP 应用提供一个简单、统一的入口"。

Ingress 在生产环境中遇到的问题：

**协议支持单一**：Ingress 只支持 HTTP 和 HTTPS（通过 TLS 配置）。在微服务普及的今天，很多服务使用 gRPC（需要 HTTP/2 支持）、WebSocket、TCP 或 UDP 协议，Ingress 无法原生处理这些场景。虽然有 nginx.ingress.kubernetes.io/ 注解来处理部分情况，但注解的本质是绕过标准的 Ingress API，导致可移植性差。

**路由配置和基础设施配置耦合**：Ingress 中同时包含路由规则（path matching、host matching）和基础设施配置（TLS 证书、SSL 策略、负载均衡算法）。这些信息本应由不同角色管理——基础设施配置由平台团队管理，路由规则由应用团队管理。但在 Ingress 中它们混在同一个资源定义中。

**跨 Namespace 路由困难**：一个 Ingress 资源只能将流量路由到同 Namespace 下的 Service 后端。虽然某些 Ingress Controller 提供注解来突破这一限制，但注解没有标准化。

**策略表达能力不足**：Ingress 不支持流量分割（金丝雀发布）、请求镜像、速率限制、重试策略、熔断等高级流量管理能力。即使通过注解实现（如 nginx.ingress.kubernetes.io/canary），也是各个 Ingress Controller 各自为政，缺乏统一的语义。

**Gateway API 的设计理念**：

Gateway API 从设计之初就明确了面向角色的 API 分层：

```
GatewayClass（基础设施提供商定义）
    │
    ▼
Gateway（集群管理员管理）
    │
    ▼
HTTPRoute/TCPRoute/UDPRoute/TLSRoute（应用开发者管理）
```

**GatewayClass**：类似于 StorageClass 的角色，定义了一类 Gateway 的实现和配置。由基础设施提供商（如云厂商、Ingress Controller 团队）定义。

**Gateway**：代表一个具体的负载均衡器实例。由集群管理员创建，指定 GatewayClass、监听端口、TLS 配置等基础设施层面的配置。Gateway 可以跨多个 Namespace 引用路由规则。

**HTTPRoute/TCPRoute/UDPRoute/TLSRoute**：由应用开发者定义，指定了流量匹配规则和后端转发目标。路由资源可以跨 Namespace 绑定到 Gateway，通过 namespaceSelector 控制权限。

**Gateway API 相比 Ingress 的关键增强**：

**1. 协议多路复用**：Gateway API 原生支持 HTTP（HTTPRoute）、TCP（TCPRoute）、UDP（UDPRoute）、TLS（TLSRoute）、gRPC（在 HTTPRoute 中通过 method 匹配）。同一个 Gateway 可以同时监听多个协议的端口。

**2. 流量分割和镜像**：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
spec:
  parentRefs:
  - name: shared-gateway
  hostnames:
  - myapp.example.com
  rules:
  - backendRefs:
    - name: myapp-v1
      port: 80
      weight: 90
    - name: myapp-v2
      port: 80
      weight: 10
```

这里实现了标准的金丝雀发布：10% 流量到 v2，90% 到 v1。语法是标准 API 的一部分，不需要依赖特定控制器的注解。

**3. 跨 Namespace 路由和引用授权**：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: ReferenceGrant
metadata:
  name: allow-httproute
  namespace: backend-ns
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: frontend-ns
  to:
  - group: ""
    kind: Service
```

这个机制让应用团队在 frontend-ns 中创建 HTTPRoute 引用 backend-ns 中的 Service，而后端团队通过 ReferenceGrant 显式授权，实现了跨 Namespace 的安全路由。

**4. 策略绑定和可扩展性**：Gateway API 通过 Policy Attachment 机制允许将策略（如速率限制、重试、超时）绑定到 Gateway、路由或后端。这些策略资源可以是由第三方自定义的 CRD，Gateway API 只定义绑定模型。

**生产环境迁移建议**：目前 Gateway API 的实现成熟度因控制器而异。nginx-ingress-controller、Contour、Istio、Cilium 都已经实现了 Gateway API 的部分或全部标准。对于新项目，建议直接在 Gateway API 上构建。对于已有 Ingress 的存量集群，可以通过设置 annotation `kubernetes.io/ingress.class` 让两个 API 共存，逐步迁移。

**追问**:
- Q: Gateway API 的 BackendTLSPolicy 如何实现后端 mTLS？Ingress 能实现类似的功能吗？
- Q: Ingress 的 annotation（如 nginx 特有的配置）在迁移到 Gateway API 后如何处理？Gateway API 的 Policy Attachment 能够完全替代吗？
- Q: Gateway API 的 Service Mesh 支持（GAMMA 倡议）是如何实现的？同一个 HTTPRoute 能否同时控制南北向和东西向流量？

---

## Q7: Kubernetes 的双栈网络（Dual-Stack）是如何工作的？在启用 IPv4/IPv6 双栈时，Service、Pod 网络和 DNS 需要做哪些配置？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 华为、腾讯云、阿里云

**答案要点**:
- 双栈网络允许 Pod 和 Service 同时拥有 IPv4 和 IPv6 地址
- 启用双栈需要在 kube-apiserver、kube-controller-manager、kubelet、kube-proxy 和 CNI 层面统一配置
- Service 支持 ipFamilyPolicy 字段，可选 SingleStack、PreferDualStack、RequireDualStack
- Pod 的双栈地址由 CNI 分配，需要 CNI 插件支持 dual-stack
- 双栈 DNS 查询遵循 RFC 3484/6724 的地址选择规则

**完整回答**:

**双栈网络的基本架构**：

Kubernetes 1.23 将双栈网络（Dual-Stack）推进到 GA。双栈意味着 Pod 和 Service 可以同时获得 IPv4 和 IPv6 地址，集群内的网络通信可以同时支持两种协议族。这对于 IPv6 过渡期、需要直接 IPv6 公网访问的场景以及法规合规要求使用 IPv6 的场景至关重要。

**启用双栈的先决条件**：

1. **Kubernetes 版本**：1.23+
2. **kube-apiserver**：必须配置 `--service-cluster-ip-range` 同时包含 IPv4 和 IPv6 的 CIDR
3. **kube-controller-manager**：配置 `--cluster-cidr` 同时包含 IPv4 和 IPv6 CIDR
4. **kubelet**：配置 `--node-ip` 为双栈节点的 IP 地址
5. **kube-proxy**：配置 `--proxy-mode=ipvs`（iptables 模式也支持，但 IPVS 更推荐）
6. **CNI 插件**：需要明确支持双栈

**CNI 支持情况**：

| CNI | 双栈支持 |
|-----|----------|
| Calico | 支持，需要在安装时配置 IPIP 或 VXLAN 的 dual-stack 模式 |
| Cilium | 支持，通过 ipam.mode=kubernetes 和 ipv6.enabled=true |
| Flannel | 不支持双栈，需要额外的 IPv6 隧道方案 |

**Service 的双栈配置**：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  type: ClusterIP
  ipFamilyPolicy: RequireDualStack
  ipFamilies:
  - IPv4
  - IPv6
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

`ipFamilyPolicy` 有三个值：
- **SingleStack**：默认值，仅分配单个协议族的 ClusterIP
- **PreferDualStack**：如果集群支持双栈则分配两个 ClusterIP，否则回退到单栈
- **RequireDualStack**：强制要求双栈，如果集群不支持则拒绝创建 Service

当指定 RequireDualStack 时，Kuberetes 会为该 Service 分配两个 ClusterIP（一个 IPv4、一个 IPv6），Service 的 EndpointSlice 中也会同时包含后端的 IPv4 和 IPv6 地址。

**Pod 的双栈网络**：

双栈模式下的 Pod，每个 Pod 从 CNI 获取 IPv4 和 IPv6 地址各一个。Pod 内的网络接口：

```
# 在 Pod 内部查看
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST> mtu 1500
    inet 10.244.1.10/24  (IPv4 地址)
    inet6 fd00::10:244:1:10/120 (IPv6 地址)
```

Pod 内部的应用默认使用哪个地址发起对外连接，取决于应用的地址选择策略（通常遵循 RFC 6724，优先使用 IPv6）。如果需要强制使用特定协议族，应用需要显式绑定地址或使用 DNS 解析指定记录类型。

**DNS 在双栈中的行为**：

双栈集群中，CoreDNS 为 Service 同时注册 A 和 AAAA 记录。当 Pod 发起 DNS 查询时：
- 如果 Pod 是双栈的，DNS 查询会同时向 A 和 AAAA 记录发起请求
- 查询结果返回后，libc（glibc）的地址排序算法根据 RFC 6724 决定优先使用哪个地址
- 如果 Pod 是单栈的（只有 IPv4 或 IPv6），DNS 按 Pod 的 dnsPolicy 和协议族选择性查询

**生产环境中的注意事项**：

双栈 Scenarios 在公有云环境中使用时，需要特别注意 VPC 网络对 IPv6 的支持情况。AWS VPC 需要配置 IPv6 CIDR，GCP VPC 需要启用 IPv6 子网。如果在云环境启用双栈但底层网络未配置 IPv6 路由，会导致 Pod 的 IPv6 地址虽然分配成功但网络不通。

另一个常见的坑是 NodePort 在双栈下的行为。当 Service 是双栈时，NodePort 也会在节点上同时监听 IPv4:NodePort 和 IPv6:NodePort。如果 kube-proxy 的 `--bind-address` 没有正确配置，可能导致只监听了其中一个协议族。

**追问**:
- Q: 双栈集群中，如果应用只监听 IPv4 但 DNS 返回了 AAAA 记录，连接会失败吗？如何防止这种情况？
- Q: 在双栈 Service 中，externalTrafficPolicy: Local 是如何在两个协议族下工作的？后端 Pod 的地址选择策略是什么？
- Q: IPv6 的唯一本地地址（ULA）和全局单播地址（GUA）在 Kubernetes 双栈中分别有什么应用场景？

---

## 本题难度等级说明

| 难度 | 图标 | 对应层级 |
|------|------|----------|
| ⚫⚪⚪ 初级 | 初级 | 1-3 年经验 |
| ⚫⚫⚪ 中级 | 中级 | 3-5 年经验 |
| ⚫⚫⚫ 高级 | 高级 | 5 年+ 经验 |
