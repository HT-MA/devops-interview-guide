---
id: interview-troubleshoot
title: Ansible 排错面试题
description: Ansible 生产环境排错面试题，涵盖 SSH 连接、权限提升、幂等性、性能优化等真实故障场景
---

# Ansible 排错面试题

## Q1: Ansible 执行时报告 SSH 连接失败"Timeout"或"Permission denied"，排查思路是什么？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、美团

**答案要点**:
- SSH 连接失败分为：网络不通、认证失败、SSH 配置问题三类
- 先用 `ansible hostname -m ping` 测试基础连通性
- 逐层排查：网络 → SSH 端口 → 认证方式 → SSH 配置
- 开启 `-vvv` 获取详细的 SSH 连接调试信息
- 常见原因包括：跳板机配置、Host Key 校验、SSH 超时设置

**完整回答**:

SSH 连接失败是 Ansible 排错中最常见的问题。将问题按照"从网络层到应用层"的层次排查：

**第一层：基础网络连通性**

```bash
# 确认 DNS 解析
dig +short hostname.company.com

# 确认端口可达
nc -zv hostname.company.com 22

# 查看从 Ansible 控制节点到目标节点的路由
traceroute hostname.company.com
```

**第二层：SSH 原始连接测试**

```bash
# 使用和 Ansible 相同的参数手动 SSH 连接
ssh -i /path/to/key.pem -p 22 ubuntu@hostname.company.com -v

# 如果 SSH 连接成功但 Ansible 失败，问题可能在 Ansible 配置
# 如果 SSH 也失败，问题在 SSH 配置本身
```

SSH verbose 输出的关键信息解读：
```
debug1: Authentication succeeded (publickey).  → 认证成功，问题在别处
debug1: Connecting to hostname.company.com [10.0.1.100] port 22. → 正在连接
debug1: SSH2_MSG_KEXINIT sent → 密钥交换中，网络没问题
Connection timed out → 防火墙/安全组/SG 阻止了连接
Permission denied (publickey). → 密钥认证失败
```

**第三层：Ansible 配置相关**

```ini
# ansible.cfg 中常见的 SSH 配置问题
[ssh_connection]
# 问题：ssh_args 设置了非标准的 SSH 选项，可能与其他配置冲突
ssh_args = -o ControlMaster=auto -o ControlPersist=60s

# 问题：使用了 deprecated 的加速选项
# pipelining = False  # 可以尝试关闭 pipelining
```

```bash
# 开启 Ansible 的详细 SSH 调试（三级别）
ansible hostname -m ping           # 标准输出
ansible hostname -m ping -v        # 基础调试
ansible hostname -m ping -vvv      # SSH 级别的完整调试（最常用）

# vvv 输出包含：
# <hostname> SSH: EXEC ssh -C -o ControlMaster=auto ...
# 可以看到 Ansible 实际执行的 SSH 命令，复制出来手动执行验证
```

**常见 SSH 问题及解决方案**：

问题一：Host Key 校验失败
```
Using a SSH password instead of a key is not possible because Host Key
checking is enabled and sshpass does not support this.
```

解决方案：
```ini
# ansible.cfg
[ssh_connection]
host_key_checking = False  # 关闭 Host Key 校验（生产中谨慎使用）
```

或者预先接受 Host Key：
```bash
ssh-keyscan -H hostname.company.com >> ~/.ssh/known_hosts
```

问题二：跳板机（Bastion/Jump Host）
```ini
# ansible.cfg
[ssh_connection]
ssh_args = -o ProxyCommand="ssh -W %h:%p -q bastion.company.com"
```

或在 Inventory 中配置：
```yaml
all:
  hosts:
    internal-server:
      ansible_host: 10.0.1.100
      ansible_ssh_common_args: '-o ProxyCommand="ssh -W %h:%p -q bastion.company.com"'
```

问题三：ControlPath 太长导致连接失败
```
ControlPath too long
```

解决方案：
```ini
[ssh_connection]
control_path = /tmp/ansible-%%h-%%p-%%r  # 缩短 ControlPath
control_path_dir = /tmp/cp
```

问题四：SSH 超时设置
```ini
[ssh_connection]
timeout = 30               # 默认 10 秒，网络延迟较高时增大
ssh_args = -o ConnectTimeout=30
```

**系统化排查脚本**：

```bash
#!/bin/bash
# ansible-ssh-diagnose.sh
HOST=$1

echo "=== 1. DNS Resolution ==="
dig +short $HOST

echo "=== 2. Port Connectivity ==="
nc -zv $HOST 22 2>&1

echo "=== 3. SSH Debug Connection ==="
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $HOST -v "echo OK" 2>&1 | grep -E "(debug1|Authentication|Permission|Timeout)"

echo "=== 4. Ansible Ping ==="
ansible $HOST -m ping -vvv 2>&1 | tail -20
```

**追问**:
- Q: Ansible 的 ControlPersist 参数的作用是什么？设置多大比较合适？
- Q: 如何配置 Ansible 使用多个 SSH 密钥尝试不同的连接用户？
- Q: SSH 的 `ProxyJump` 和 `ProxyCommand` 有什么区别？Ansible 2.x 中推荐用哪个？

---

## Q2: Ansible 执行 Playbook 时出现"Missing sudo password"或"Privilege escalation failed"，如何排查？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、腾讯、阿里

**答案要点**:
- 权限提升失败的典型现象：task 报错 `Incorrect sudo password` 或 `Sudo password is required`
- 权限提升机制有 `become`、`become_user`、`become_method`、`become_flags` 四个参数
- 常见原因包括：sudo 配置、requiretty、NOPASSWD 设置、密码传递方式
- 排查方法：先手动测试 sudo，再对比 Ansible 配置

**完整回答**:

权限提升（Privilege Escalation）是 Ansible 执行系统级操作的前提。当 `become: yes` 的任务失败时，问题几乎总在 sudo 配置层。

**排查流程**：

第一步：确认手动 sudo 是否正常
```bash
# 使用 Ansible 相同的连接用户手动验证
ssh ubuntu@hostname
sudo whoami
# 期望返回：root

# 测试不同 become 方法
sudo -s whoami
sudo -u root whoami
sudo -i whoami
```

第二步：检查 sudo 配置
```bash
# 查看当前用户的 sudo 权限
sudo -l

# 检查重点：
# 1. NOPASSWD 是否配置
# 2. requiretty 是否启用
# 3. 命令限制范围
```

第三步：在 Ansible 中调试
```bash
# 开启 become 调试
ansible hostname -m command -a "whoami" -b --become-method=sudo -vvv

# 测试特定 become 方式
ansible hostname -m command -a "whoami" -b --become-method=su
ansible hostname -m command -a "whoami" -b --become-method=pbrun
```

**常见问题及解决方案**：

问题一：`requiretty` 导致 sudo 失败

这是最常见的问题。当 Ansible 开启 pipelining 时，SSH 没有分配 tty，但 `/etc/sudoers` 中启用了 `Defaults requiretty`。

错误信息：
```
sudo: sorry, you must have a tty to run sudo
```

解决方案 A：在 sudoers 中关闭 requiretty
```bash
# /etc/sudoers.d/ansible
Defaults:ubuntu !requiretty
# 或针对所有用户
Defaults !requiretty
```

解决方案 B：在 ansible.cfg 中关闭 pipelining（降低性能但避免问题）
```ini
[ssh_connection]
pipelining = False
```

问题二：NOPASSWD 未配置

错误信息：
```
Incorrect sudo password
```
或
```
sudo: a password is required
```

解决方案：
```bash
# /etc/sudoers.d/ansible
ubuntu ALL=(ALL) NOPASSWD: ALL
```

问题三：`become` 密码未正确传递

```bash
# 方式一：执行时交互输入
ansible-playbook site.yml --ask-become-pass

# 方式二：配置文件中设置（不安全，不推荐）
# ansible.cfg
[privilege_escalation]
become_password = mysecret

# 方式三：使用 vault 加密（安全实践）
ansible-playbook site.yml --vault-password-file ~/.vault_pass
```

```yaml
# group_vars/all/vault.yml（AES-256 加密）
vault_become_password: !vault |
  $ANSIBLE_VAULT;1.1;AES256
  ...
```

问题四：`become_method` 不匹配

```yaml
# 目标系统不支持 sudo，必须使用 su
- name: Run as root using su
  become: yes
  become_method: su
  become_user: root
  command: /usr/bin/systemctl restart nginx
```

**`become` 配置的最佳实践**：

```yaml
# playbook 级别的默认值
---
- hosts: all
  become: yes
  become_method: sudo
  become_user: root
  become_flags: '-H'  # 设置 HOME 环境变量为 root 的家目录

  tasks:
    - name: Create system user
      user:
        name: appuser
        system: yes
```

```ini
# ansible.cfg 中的全局配置
[privilege_escalation]
become = True
become_method = sudo
become_user = root
become_ask_pass = False
```

**追问**:
- Q: `become_flags` 参数如何影响不可变基础设施？`-H` 和 `-i` 参数的区别是什么？
- Q: Ansible 2.x 中的 `become` 密码传递方式有哪些？如何安全地将 `ansible_become_password` 传递给 Playbook？
- Q: 当使用 `become: yes` 时，变量 `ansible_user` 和 `ansible_env` 的值是 become 之前的用户还是 become 之后的用户？

---

## Q3: 如何调试 Ansible 模块的幂等性问题？当 `changed: true` 不符合预期时怎么处理？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、美团

**答案要点**:
- 幂等性问题表现为：每次运行都报告 `changed: true`，或应该变更时报告 `ok: 0`
- 常见原因：模块参数中有动态值、时间戳/随机数、默认值变化
- 使用 `--check` 模式验证预期行为
- 通过 `changed_when` 和 `failed_when` 手动控制变更判断
- 对于持续漂移，使用 `--diff` 定位具体变更字段

**完整回答**:

幂等性问题是 Playbook 进入生产环境后最常见的**隐性问题**——它不会报错，但会导致一系列连锁问题：handler 被误触发、监控告警噪音、服务频繁重启。

**幂等性问题的四种类型**：

类型一：参数中包含动态值

```yaml
# ❌ 错误：每次都生成不同的临时文件路径
- name: Download application artifact
  get_url:
    url: "https://artifactory.company.com/app.zip"
    dest: "/tmp/app-{{ ansible_date_time.epoch }}.zip"
  # 每次 epoch 都不同 → 每次都 changed: true，每次都下载

# ✅ 修复：使用固定的目标路径
- name: Download application artifact
  get_url:
    url: "https://artifactory.company.com/app.zip"
    dest: "/opt/application/app.zip"
    checksum: "sha256:{{ expected_checksum }}"
  # 相同的 URL + 相同的目标路径 → 幂等
```

类型二：命令模块中的可变输出

```yaml
# ❌ 错误：command/shell 模块不检查系统状态
- name: Add firewall rule
  command: iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
  # 每次执行都添加一条新规则（即使规则已经存在）

# ✅ 修复：使用专用的 Ansible 模块
- name: Add firewall rule
  iptables:
    chain: INPUT
    protocol: tcp
    destination_port: 8080
    jump: ACCEPT
    action: append
  # iptables 模块会检查规则是否已存在

# 如果没有专用模块，使用 creates/changed_when
- name: Add firewall rule
  shell: |
    iptables -C INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || \
    iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
  changed_when: "'rule added' in result.stdout"
```

类型三：模板中的时间戳/版本号

```yaml
- name: Generate config
  template:
    src: app.yml.j2
    dest: /etc/app/config.yml
```

```jinja2
{# app.yml.j2 — 问题版 #}
# Generated at {{ ansible_date_time.iso8601 }}
# ❌ 时间戳每次变化 → 模板每次都重新渲染 → changed: true

{# app.yml.j2 — 修复版 #}
# Generated at {{ lookup('pipe', 'date +%Y%m%d') }}
# 但是更好的做法是使用 constant 值
# 或者用版本号只在版本变更时变化
```

类型四：文件权限/属性的循环变更

```yaml
# ❌ 错误：目录权限默认值冲突
- name: Create application directory
  file:
    path: /opt/app/logs
    state: directory
    owner: appuser
    group: appuser
    mode: "0755"
    # 有时候 Ansible 的默认 umask 和 mode 不匹配
    # 导致每次 plan 都检测到权限变更

# ✅ 修复：检查当前状态并只在实际变更时设置
- name: Check log directory permissions
  stat:
    path: /opt/app/logs
  register: log_dir

- name: Fix log directory permissions
  file:
    path: /opt/app/logs
    owner: appuser
    group: appuser
    mode: "0755"
  when: log_dir.stat.pw_name != 'appuser' or log_dir.stat.gr_name != 'appuser'
```

**调试幂等性的工具和方法**：

方法一：使用 `--diff` 定位具体变更
```bash
# 找出具体什么字段导致 changed: true
ansible-playbook site.yml --diff --limit problematic-host

# 输出类似：
# TASK [Copy config] ************************************************
# --- before: /etc/app/config.yml
# +++ after: /tmp/ansible-xxx/config.yml.j2
# @@ -1,4 +1,4 @@
# -# Generated at 2024-01-15
# +# Generated at 2024-01-16
#  ← 看到了，是日期变了
```

方法二：使用 `register` + `debug` 查看模块返回值
```yaml
- name: Debug the actual change detection
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  register: template_result

- name: Show what Ansible thinks changed
  debug:
    var: template_result
    # 查看 diff 字段了解前后差异
    verbosity: 2
```

方法三：幂等性验证自动化
```bash
#!/bin/bash
# test-idempotency.sh — 验证 Playbook 幂等性
echo "=== First run ==="
ansible-playbook site.yml | tee /tmp/run1.log

echo "=== Second run (should be all ok) ==="
ansible-playbook site.yml | tee /tmp/run2.log

CHANGED=$(grep -c "changed=1" /tmp/run2.log)
if [ "$CHANGED" -gt 0 ]; then
    echo "FAIL: Playbook is NOT idempotent. $CHANGED tasks report changed on 2nd run."
    exit 1
fi
echo "PASS: Playbook is idempotent."
```

**追问**:
- Q: 如何让一个 `command` 模块变成幂等的？有哪些常用的编程模式？
- Q: `lineinfile` 模块的 `regexp` 和 `line` 组合使用时，如何确保幂等性？
- Q: `copy` 模块的 `force: yes` 参数对幂等性有什么影响？

---

## Q4: 当 Ansible Playbook 执行很慢（比如数十分钟甚至更长），如何分析和优化性能？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- Ansible 性能瓶颈通常集中在：SSH 连接建立、Fact 收集、串行执行、模块执行时间
- 使用 `profile_tasks` 和 callback plugin 定位慢任务
- 优化策略包括：SSH pipelining、Fact 缓存、异步执行、并行度调整
- 大规模场景下建议使用分层管理和 pull 模式

**完整回答**:

Playbook 执行慢不会导致错误，但会消耗团队成员的大量等待时间。更严重的是，如果一次部署需要 30 分钟，部署频率和开发效率都会受到明显影响。

**第一步：测量——定位瓶颈**

使用 Ansible 的内置 profiling 工具：

```ini
# ansible.cfg
[defaults]
# 启用 task 级别的耗时统计
callback_whitelist = profile_tasks, timer, profile_roles
```

```bash
# 执行后输出示例：
# Saturday 15 January 2024  10:00:00 +0000 (0:00:00.012)       0:00:00.012 ******
# ===============================================================================
# Gather Facts ----------------------------------------------------------- 12.34s
# Install Nginx ---------------------------------------------------------- 3.45s
# Configure App ---------------------------------------------------------- 2.10s
# Restart Service --------------------------------------------------------- 0.89s
# ===============================================================================
# Total time: 18.78s
```

或者使用 `ansible-playbook --timeout` 和 `-vv` 看更粗粒度的信息。

**第二步：Gather Facts 优化——最大的性能瓶颈**

Fact 收集是 Ansible 默认执行最耗时的操作（可能占总时间 50-80%）：

```yaml
# 方案一：关闭全局 fact 收集，按需手动收集
- hosts: all
  gather_facts: no  # 全局关闭

  tasks:
    - name: Gather network facts only
      setup:
        gather_subset: "!all,!min,network"
      # 只收集网络相关 facts，跳过磁盘、硬件等
```

```yaml
# 方案二：开启 fact 缓存
# ansible.cfg
[defaults]
gathering = smart           # 智能收集：缓存命中时不重新收集
fact_caching = jsonfile     # 缓存类型
fact_caching_connection = /tmp/ansible_facts  # 缓存存储路径
fact_caching_timeout = 3600 # 缓存过期时间（秒）
```

```yaml
# 方案三：使用 Redis 作为事实缓存（多控制节点场景）
# ansible.cfg
[defaults]
fact_caching = redis
fact_caching_connection = localhost:6379:0
fact_caching_timeout = 86400
```

```yaml
# 方案四：精确控制需要收集的事实子集
- name: Gather only the necessary facts
  setup:
    gather_subset:
      - '!all'
      - '!min'
      - network
      - virtual
      - env
```

**第三步：SSH 连接优化**

```ini
# ansible.cfg
[ssh_connection]
# 开启 pipelining：减少 SSH 连接数，避免 SCP 模块文件
pipelining = True

# 开启 SSH 复用：同一主机复用 SSH 连接
ssh_args = -o ControlMaster=auto -o ControlPersist=120s

# 增加并行度
forks = 50  # 默认 5，根据控制节点性能调整

# 缩短连接超时
timeout = 10
```

```bash
# 调整 forks 对性能的影响示例（假设 100 台主机）：
# forks = 5:  20 轮 SSH 连接，每轮同时 5 台
# forks = 50: 2 轮 SSH 连接，每轮同时 50 台
# forks = 100: 1 轮同时全部
# 注意：forks 过高可能导致控制节点 CPU/内存瓶颈
```

**第四步：任务执行优化**

```yaml
# 使用 async 并行执行不依赖的任务
- name: Restart multiple services in parallel
  service:
    name: "{{ item }}"
    state: restarted
  loop:
    - nginx
    - php-fpm
    - redis
  async: 30
  poll: 5
```

```yaml
# 使用 throttle 控制 API 调用频率（避免 API 限流）
- name: Register instances to load balancer
  elb_target_group:
    name: my-tg
    instance_id: "{{ item }}"
    state: present
  loop: "{{ ec2_instances }}"
  throttle: 10  # 每轮最多同时处理 10 台
```

**第五步：结构化层面的优化**

对于大规模基础设施（500+ 主机），考虑架构层面的优化：

```ini
# 策略一：使用分层管理
# 控制节点不要直接管理所有主机，使用 AWX/Tower 的分层执行
```

```ini
# 策略二：使用 ansible-pull 替代 ansible-push
# 主机定期拉取配置本地执行，避免控制节点成为瓶颈
# */30 * * * * ansible-pull -o -U https://git.company.com/ansible.git
```

```ini
# 策略三：优化模块选择
# 优先使用专用模块（幂等 + 高效）
# 避免使用 shell/command（每次执行不检查状态）
# 大型文件分发使用 synchronize 模块（基于 rsync）而非 copy
```

**性能优化前后对比（100 台 EC2 基准测试）**：

```
优化前:         23 分 45 秒
+ pipelining:   13 分 20 秒 (-44%)
+ fact 缓存:     5 分 10 秒 (-78%)
+ forks=50:      3 分 30 秒 (-85%)
+ async 并行:    2 分 10 秒 (-91%)
```

**追问**:
- Q: `forks` 参数设置过大可能带来什么问题？控制节点上哪些资源会成为瓶颈？
- Q: `gather_subset` 的值除了 `network`、`virtual`，还有哪些常用的子集？
- Q: 在混合云环境中（部分机器延迟高、部分机器延迟低），如何避免慢机器拖慢整体 Playbook 执行？

---

## Q5: Ansible 的 Fact 收集机制是什么？如何优化和管理大规模环境下的 Fact 收集？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、腾讯、美团

**答案要点**:
- Fact 通过 `setup` 模块收集，默认在 Playbook 开始时自动执行
- Fact 信息包括：主机名、IP、OS 版本、CPU、内存、磁盘、网络接口等
- 大规模环境中 Fact 收集占总执行时间的 50% 以上
- 优化手段：关闭收集、子集收集、缓存、自定义 Fact
- `gather_facts: no` + 按需 `setup` 是最灵活的控制方式

**完整回答**:

Fact（系统事实）是 Ansible 了解受管节点信息的方式。每次 Playbook 执行时，`gather_facts` 阶段调用 `setup` 模块，返回该主机的数千个属性。

**Fact 收集的内容**：

```
ansible_all_ipv4_addresses: ["10.0.1.10"]
ansible_architecture: "x86_64"
ansible_date_time:
  date: "2024-01-15"
  time: "10:00:00"
ansible_default_ipv4:
  address: "10.0.1.10"
  gateway: "10.0.1.1"
  interface: "eth0"
ansible_distribution: "Ubuntu"
ansible_distribution_version: "22.04"
ansible_kernel: "5.15.0-91-generic"
ansible_memory_mb:
  real:
    total: 16384
    free: 8192
ansible_processor_vcpus: 8
ansible_services: {...}  # 所有服务的状态
ansible_mounts: [...]    # 所有挂载点
... 总计 1000+ 个字段
```

**Fact 收集的四种优化策略**：

策略一：按需关闭和开启
```yaml
# 完全关闭——对于不需要 facts 的 Playbook
- hosts: all
  gather_facts: no

# 只在一个 role 需要事实时手动收集
- hosts: monitoring_agents
  gather_facts: no
  tasks:
    - name: Collect system facts for monitoring config
      setup:
        gather_subset: "network,hardware"
      when: inventory_hostname in groups['monitoring_agents']
```

策略二：精确的子集收集
```yaml
# setup 模块支持的 gather_subset 值
# 'all':      收集所有 facts（默认，最慢）
# 'min':      最小子集（基本信息）
# '!all':     排除所有
# 'network':  网络相关
# 'hardware': 硬件信息
# 'virtual':  虚拟化信息
# 'env':      环境变量

# 最快：只收集最小子集
- name: Fast fact collection
  setup:
    gather_subset: "min"

# 特定需求：只要网络和硬件信息
- name: Targeted fact collection
  setup:
    gather_subset:
      - '!all'
      - '!min'
      - network
      - hardware
```

策略三：Fact 缓存（最推荐的大规模方案）
```ini
# ansible.cfg
[defaults]
# smart 模式：如果缓存未过期则跳过收集
gathering = smart
# JSON 文件缓存
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts_cache
# 3600 秒（1 小时）内不重新收集
fact_caching_timeout = 3600
```

使用 Redis 缓存（多控制节点共享）：
```ini
[defaults]
gathering = smart
fact_caching = redis
fact_caching_connection = redis-server:6379:0
fact_caching_timeout = 3600
fact_caching_prefix = ansible_facts
```

策略四：自定义 Facts
```bash
# 受管节点上放置自定义 fact 脚本
# /etc/ansible/facts.d/app_status.fact（可执行脚本）
```

```bash
#!/bin/bash
# /etc/ansible/facts.d/deployment.fact
echo '{
  "app_version": "2.1.0",
  "deploy_time": "2024-01-15T10:00:00Z",
  "git_commit": "abc123def456",
  "environment": "production"
}'
```

这些自定义 facts 会出现在：
```json
{
  "ansible_local": {
    "deployment": {
      "app_version": "2.1.0",
      "deploy_time": "2024-01-15T10:00:00Z",
      "git_commit": "abc123def456",
      "environment": "production"
    }
  }
}
```

**Fact 收集的缓存失效策略**：

```bash
# 手动清除特定主机的缓存
rm -f /tmp/ansible_facts_cache/hostname.company.com

# 在 Playbook 中强制刷新当前主机的 facts
- name: Force fact refresh
  setup:
    gather_subset: "min"
  when: force_refresh | default(false)
```

**生产最佳实践总结**：

```
场景                         推荐方案
────────────────────────────────────────────────────
小于 50 台服务器             gather_facts: yes（默认即可）
50-200 台服务器              smart 模式 + jsonfile 缓存
200-1000 台服务器            smart 模式 + Redis 缓存
1000+ 台服务器               gather_facts: no + 手动按需 setup
所有场景                     精确的 gather_subset 设置
频繁变更的环境               缩短 cache_timeout 或选择性刷新
```

**追问**:
- Q: `gather_facts: no` 之后，`ansible_facts` 变量是否完全不可用？`ansible_all_ipv4_addresses` 还能用吗？
- Q: Fact 缓存在多控制节点（如多台 AWX 节点）场景下怎么共享？基于 Redis 缓存时 key 冲突怎么避免？
- Q: 假设一个 Playbook 中有些 task 需要 facts 有些不需要，如何混用 `gather_facts: no` 和手动 `setup`？

---

## Q6: 如何处理 Ansible 模块超时（Timeout）问题？什么场景下模块会超时以及如何应对？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、快手

**答案要点**:
- 模块超时常见的三种类型：SSH 连接超时、SSH 执行超时、模块内部操作超时
- SSH 超时通过 `timeout` 和 `ssh_args` 控制
- 长时间运行的模块通过 `async` 模式规避 SSH 超时
- API 调用模块超时需要调整模块参数或重试机制
- 区分客户端超时和服务端超时，针对性地设置超时参数

**完整回答**:

模块超时是生产环境中"间歇性失败"的常见原因——同一个 Playbook 这次成功、下次因为网络抖动或 API 延迟就失败。

**超时的三种类型**：

类型一：SSH 连接超时

错误信息：
```
FAILED! => {"msg": "Timeout (12s) waiting for privilege escalation prompt"}
```
或
```
Failed to connect to the host via ssh: connect to host 10.0.1.100 port 22: Connection timed out
```

原因：
- 网络延迟大，但 SSH 连接超时设置过短
- 受管节点负载高，SSH 进程响应慢
- 安全组或防火墙规则导致连接被丢包

解决方案：
```ini
# ansible.cfg
[ssh_connection]
# 增加 SSH 连接超时
timeout = 60

# 增加 SSH 握手的超时
ssh_args = -o ConnectTimeout=60 -o ServerAliveInterval=30 -o ServerAliveCountMax=10
```

类型二：SSH 执行超时（模块运行中）

错误信息：
```
The module failed to execute correctly, you may need to inspect the module's
output: Timeout when waiting for the module to complete
```

原因：
- 模块在受管节点上执行了很长时间（如 yum update、大型脚本）
- SSH 会话由于长时间无数据流被网络设备断开

解决方案 A：调整 SSH 保活
```ini
[ssh_connection]
ssh_args = -o ServerAliveInterval=30 -o ServerAliveCountMax=3
```
含义：每 30 秒发送一次 keepalive 包，连续 3 次无响应则断开。

解决方案 B：使用 async 模式
```yaml
- name: Run large yum update
  yum:
    name: "*"
    state: latest
  async: 600      # 允许最多 10 分钟
  poll: 10        # 每 10 秒轮询
```

类型三：API 调用超时（模块内部）

错误信息：
```
FAILED! => {"msg": "Status code was 0 and not [200]: Request failed: <urlopen error timed out>"
```

原因：
- 模块内部调用外部 API（如 AWS API、Docker API）超时
- 控制节点的网络出口带宽不足
- API 服务端响应慢

解决方案：
```yaml
- name: Register with ELB
  elb_target_group:
    name: my-tg
    instance_id: "{{ instance_id }}"
    state: present
    # 某些模块支持内部超时参数
    wait_timeout: 120
    wait: yes
  register: elb_result
  retries: 3       # 重试 3 次
  delay: 5         # 每次间隔 5 秒
  until: elb_result is success
```

**系统化的超时处理策略**：

策略一：模块级别的重试（推荐的做法）
```yaml
- name: Install packages with retry
  apt:
    name: nginx
    state: present
    update_cache: yes
  register: apt_result
  retries: 3
  delay: 10
  until: apt_result is success
  # 当 apt 操作因网络超时失败时自动重试
```

策略二：Playbook 级别的超时控制
```bash
# 限制整个 Playbook 的执行时间
timeout 600 ansible-playbook site.yml
```

策略三：批量执行时的渐退重试
```yaml
- name: Batch service restart with backoff
  service:
    name: api-server
    state: restarted
  register: restart_result
  retries: 5
  delay: "{{ 10 * (attempts | default(0)) | int }}"
  until: restart_result is success
  # 每次重试间隔递增：10s, 20s, 30s, 40s, 50s
```

策略四：Inventory 级别的超时配置
```ini
# 对特定延迟较高的主机组单独设置超时
[slow-hosts]
host1 ansible_host=10.0.1.100 ansible_ssh_timeout=60

[slow-hosts:vars]
ansible_ssh_common_args='-o ConnectTimeout=60 -o ServerAliveInterval=15'
```

**生产环境中的典型超时故障复盘**：

```
案例：每月一次的大规模安全更新

症状：yum update 在部分主机上超时失败
分析：安全更新涉及大量 RPM 包，某些老旧的 EC2 实例（t2.medium）需要
超过 10 分钟完成更新。但 Ansible 默认的 SSH 执行超时约为 10 分钟。

解决方案：
1. 对包更新任务启用 async: 1800（30 分钟超时）
2. 使用 serial: 20% 分批执行，避免同时更新影响业务
3. 对 EBS 吞吐量有限的实例类型单独设置更长的超时

改进结果：失败率从 15% 降低到 0.5%
```

**追问**:
- Q: Ansible 中 `ansible_ssh_timeout` 和 SSH 配置中的 `ConnectTimeout` 是什么关系？哪个优先级更高？
- Q: 在 AWX/Tower 中，Job 级别的超时如何配置？和 Playbook 内的超时有什么关系？
- Q: 模块超时导致 host 被标记为 unreachable，后续 task 是否还会在该 host 上执行？如何让超时后的 host 在下一个 task 中继续尝试？
