---
id: network
title: 网络配置
description: Linux 网络配置与故障排查
---

# Linux 网络配置

## 面试官想考什么

* 网络协议栈
* 网络配置命令
* 故障排查方法
* 网络命名空间

## 标准答案

### 网络协议栈

```
应用程序 → Socket → TCP/UDP → IP → 网卡驱动 → 硬件
     ↓         ↓         ↓       ↓        ↓
   用户空间 ←────────── 内核空间 ──────────→
```

### TCP 三次握手/四次挥手

```
客户端                    服务器
  |                         |
  |----- SYN ----->        |  1. SYN
  |                         |
  |<--- SYN+ACK ----        |  2.
  |                         |
  |----- ACK ----->        |  3. 连接建立

  ... 数据传输 ...

  |----- FIN ----->        |  4.
  |                         |
  |<--- ACK -----          |  5.
  |                         |
  |<--- FIN -----          |  6.
  |                         |
  |----- ACK ----->        |  7. 连接关闭
```

## 常见命令

### ifconfig/ip

```bash
# 查看所有网卡
ip addr show
ifconfig -a

# 启用/禁用网卡
ip link set eth0 up
ip link set eth0 down

# 配置 IP
ip addr add 192.168.1.100/24 dev eth0
```

### netstat/ss

```bash
# 查看连接状态
ss -tunapl
netstat -tunapl

# 解释
# -t: TCP
# -u: UDP
# -n: 数字显示
# -a: 所有
# -p: 显示进程
# -l: 监听端口
```

### ping/traceroute

```bash
# 测试连通性
ping -c 4 8.8.8.8

# 路由追踪
traceroute 8.8.8.8
tracepath 8.8.8.8

# 探测路径 MTU
tracepath -m 10 8.8.8.8
```

### curl/wget

```bash
# 测试 HTTP
curl -v http://example.com

# 测试 DNS
dig example.com
nslookup example.com

# 查看 DNS 解析
getent hosts example.com
```

## 网络故障排查

### 排查流程

```bash
# 1. 检查链路层
ip link show
ethtool eth0

# 2. 检查 IP 配置
ip addr show
ip route show

# 3. 检查 ARP
ip neigh show
arp -a

# 4. 测试连通性
ping -I eth0 8.8.8.8

# 5. 检查端口
ss -tunapl | grep PORT
telnet HOST PORT

# 6. 检查防火墙
iptables -L -n
firewall-cmd --list-all
```

### 常见问题

| 问题 | 命令 | 原因 |
|------|------|------|
| 网卡 DOWN | `ip link show` | 网线/驱动 |
| 无 IP | `ip addr show` | DHCP/静态配置 |
| 不通 | `ping` | 路由/防火墙 |
| 端口不通 | `ss -tunapl` | 服务未启动/防火墙 |
| DNS 解析失败 | `dig` | DNS 配置 |

## 高级命令

### tcpdump

```bash
# 抓包基本用法
tcpdump -i eth0

# 抓特定端口
tcpdump port 80

# 保存到文件
tcpdump -i eth0 -w capture.pcap

# 读取文件
tcpdump -r capture.pcap

# 表达式过滤
tcpdump host 192.168.1.1 and port 80
```

### iptables

```bash
# 查看规则
iptables -L -n -v

# 查看 NAT 表
iptables -t nat -L -n

# 常见场景
# 允许已建立连接
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 开放端口
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# 端口转发
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
```

## 实战经验

1. **连接数过高**
   ```bash
   # 查看连接数统计
   ss -s
   
   # TIME_WAIT 过多
   # 调整: net.ipv4.tcp_tw_reuse = 1
   # 调整: net.ipv4.tcp_fin_timeout = 30
   ```

2. **网络延迟高**
   ```bash
   # 使用 mtr 持续追踪
   mtr 8.8.8.8
   
   # 查看网卡统计
   ethtool -S eth0
   ```

3. **Docker 网络问题**
   ```bash
   # 查看 docker0 网桥
   ip link show docker0
   
   # 查看容器网络
   docker network ls
   docker network inspect bridge
   ```

## 延伸问题

* 什么是 TCP TIME_WAIT？
* 什么是 SYN Flood？如何防御？
* 什么是 conntrack？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
