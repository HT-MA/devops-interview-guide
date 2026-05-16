---
id: interview-core
title: Ansible 核心面试题
description: Ansible 高频核心面试题，涵盖架构、Inventory、Playbook、Role、Vault、执行模式等真实面试场景
---

# Ansible 核心面试题

## Q1: Ansible 的控制节点（Control Node）和受管节点（Managed Node）之间是如何通信的？架构上有什么特点？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- 控制节点是安装了 Ansible 的机器，受管节点是被管理的目标主机
- 默认通过 SSH 协议通信，Windows 使用 WinRM
- Ansible 是"无代理（agentless）"架构——受管节点不需要安装 Ansible
- 控制节点将模块和参数推送到受管节点执行，执行完毕后结果返回控制节点
- 受管节点只需要 Python 环境（2.6+/3.5+）和 SSH 服务

**完整回答**:

Ansible 的架构核心优势在于"agentless"——不需要在被管理的主机上安装任何代理软件。这是 Ansible 相对于 Puppet、Chef、SaltStack 等传统配置管理工具最显著的区别。

**通信流程详解**：

```
控制节点（Controller）
├── Ansible Engine
│   ├── Inventory（主机清单）
│   ├── Playbook（剧本）
│   └── Module Library（模块库）
│
├── SSH 连接（默认使用 OpenSSH，支持 paramiko 备用）
│
受管节点（Managed Nodes）
├── 不需要安装 Ansible
├── 必须有 Python（2.6+ 或 3.5+）
└── 必须有 SSH 服务运行
```

一次典型的 Ansible 任务执行过程：

1. 控制节点读取 Inventory 确定目标主机列表
2. 控制节点将 Playbook 解析为 Task 序列，找出每个 Task 对应的 Module
3. 对于每个 Task，控制节点将 Module 的 Python 代码 + 参数打包为 Payload
4. 通过 SSH 连接将 Payload 传输到受管节点的临时目录（`~/.ansible/tmp/`）
5. 受管节点执行 Payload 中的 Python 脚本
6. 执行结果（标准输出/错误/返回码/变更状态）通过 SSH 返回控制节点
7. 临时文件被清理

**架构的关键技术细节**：

**模块执行机制**：Ansible 模块是独立的 Python 脚本。控制节点将模块文件 SCP 到受管节点，然后在 SSH 会话中调用 `python <module_file>` 执行。执行完成后，模块将结果以 JSON 格式输出到 stdout，控制节点解析 JSON 判断任务状态。

**连接插件（Connection Plugins）**：虽然默认是 SSH，但 Ansible 支持多种连接方式：
- `ssh`：默认，使用 OpenSSH
- `paramiko`：Python 实现的 SSH 库，作为降级方案
- `local`：直接在控制节点本地执行（用于 localhost 操作）
- `docker`：通过 Docker socket 直接在容器内执行
- `winrm`：用于 Windows 主机的管理
- `network_cli`：用于网络设备（交换机、路由器）

**优势**：
- 低门槛——不需要在受管节点安装 Agent，只需 SSH 和 Python
- 安全——控制节点是唯一的入口，不需要维护受管节点上的 Agent 证书
- 方便测试——可以用 Vagrant 或 Docker 快速搭建测试环境

**劣势**：
- 大规模管理时 SSH 连接数成为瓶颈（可以通过 `pipelining` 优化）
- 复杂跳板机环境需要额外配置 SSH ProxyJump
- 对于 Windows 管理，WinRM 的稳定性和性能不如 Linux 的 SSH

**面试加分**：提到 SSH 的 pipelining 特性。默认情况下 Ansible 使用 SCP 传输模块文件，然后 SSH 执行。开启 `pipelining = True` 后，模块通过 SSH 管道直接传输，减少一次 SCP，显著提高大规模执行的性能。但 pipelining 需要在受管节点 `/etc/sudoers` 中配置 `requiretty` 关闭，否则 sudo 命令会失败。

**追问**:
- Q: Ansible 为什么选择 Python 作为模块语言？Python Runtime 版本兼容性问题如何解决？
- Q: 开启 SSH pipelining 后能带来多大的性能提升？什么情况下不能开启 pipelining？
- Q: Ansible 在管理超过 1000 台服务器时，SSH 连接会成为瓶颈吗？如何 Scale？

---

## Q2: Ansible 的 Inventory 管理有哪几种方式？Static Inventory 和 Dynamic Inventory 各自的优缺点是什么？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、快手

**答案要点**:
- Static Inventory 使用 INI 或 YAML 格式的文件手动定义主机和组
- Dynamic Inventory 通过脚本或插件从外部系统（AWS、VMware、K8s）动态获取主机列表
- Static 适合小规模和固定环境，Dynamic 适合云环境和大规模管理
- Dynamic Inventory 脚本必须遵循约定的 JSON 输出格式
- 混合使用两种方式可以覆盖复杂的生产场景

**完整回答**:

Inventory 是 Ansible 的基石——它告诉 Ansible 管理哪些机器以及如何连接它们。

**Static Inventory（静态清单）**：

INI 格式（传统）：
```ini
[webservers]
web01.example.com ansible_user=ubuntu
web02.example.com ansible_user=ubuntu ansible_port=2222

[databases]
db01.example.com
db02.example.com

[loadbalancers]
lb01 ansible_host=10.0.1.100 ansible_connection=ssh

# 组中组
[production:children]
webservers
databases
loadbalancers

# 组的变量
[production:vars]
ansible_user=deploy
ansible_ssh_private_key_file=/path/to/prod_key
```

YAML 格式（推荐，可读性更好）：
```yaml
all:
  children:
    webservers:
      hosts:
        web01:
          ansible_host: 10.0.1.10
          ansible_user: ubuntu
        web02:
          ansible_host: 10.0.1.11
    databases:
      hosts:
        db01:
          ansible_host: 10.0.2.10
    production:
      children:
        webservers:
        databases:
      vars:
        ansible_user: deploy
```

静态清单的适用场景：
- 管理 50 台以下的服务器
- 物理机或固定 IP 的传统数据中心
- 开发环境和测试环境（机器稳定不变）
- 网络设备管理（IP 相对固定）

**Dynamic Inventory（动态清单）**：

Dynamic Inventory 通过执行一个脚本或使用一个内置插件来获取主机列表。脚本需要输出特定格式的 JSON：

```json
{
  "webservers": {
    "hosts": ["10.0.1.10", "10.0.1.11"],
    "vars": {
      "ansible_user": "ubuntu"
    }
  },
  "_meta": {
    "hostvars": {
      "10.0.1.10": {
        "instance_id": "i-12345",
        "region": "us-east-1",
        "private_ip": "10.0.1.10"
      }
    }
  }
}
```

使用 AWS EC2 动态清单：
```bash
# 使用官方 aws_ec2 插件
ansible-inventory -i aws_ec2.yaml --graph

# 根据标签过滤
ansible -i aws_ec2.yaml webservers -m ping
```

`aws_ec2.yaml` 内容：
```yaml
plugin: aws_ec2
regions:
  - us-east-1
filters:
  tag:Environment: production
  instance-state-name: running
keyed_groups:
  - key: tags.Role
    prefix: role
  - key: placement.region
    prefix: aws_region
compose:
  ansible_host: private_ip_address
```

动态清单的优势：
- 自动同步——云环境中的实例创建/销毁后，Inventory 自动更新
- 标签驱动——根据 EC2 标签、OpenStack Metadata 等自动分组
- 变量注入——自动将实例的 meta data（IP、AZ、实例类型）注入为 Ansible 变量
- 大规模管理——不需要人工更新主机列表

**生产最佳实践**：

混合使用是最佳方案。我推荐的结构：

```
inventories/
├── production/
│   ├── aws_ec2.yaml          # 动态清单（EC2 自动发现）
│   └── group_vars/           # 组变量
│       ├── all.yml
│       └── webservers.yml
├── staging/
│   ├── aws_ec2.yaml
│   └── group_vars/
├── development/
│   ├── hosts.ini             # 静态清单（开发环境机器固定）
│   └── group_vars/
└── _shared/
    ├── aws_ec2.yaml          # 共享的动态清单配置
    └── network_devices.yml   # 单独管理网络设备
```

**追问**:
- Q: 如何编写一个自定义的 Dynamic Inventory 脚本？需要实现什么接口？
- Q: `cacheable` 选项在 Dynamic Inventory 中有什么作用？如何配置缓存过期时间？
- Q: `add_host` 和 `group_by` 模块在 Ansible 执行过程中动态修改 Inventory 是怎么工作的？

---

## Q3: Ansible 模块的幂等性是什么意思？如何确保自己编写的 Playbook 是幂等的？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、美团、腾讯

**答案要点**:
- 幂等性指多次执行同一任务产生相同的结果，不会产生副作用
- Ansible 模块通过检查当前状态决定是否需要执行变更
- 幂等是 Ansible 作为声明式配置管理工具的核心特征
- 非幂等模块（command/shell/raw）需要配合 `creates` 或 `changed_when` 实现幂等
- 幂等性检查通过模块返回值中的 `changed` 字段体现

**完整回答**:

幂等性是 Ansible 的设计基石。简单来说：一个幂等的 Playbook 运行一次"改到正确状态"，运行一百次结果不变。

**幂等模块和非幂等模块**：

```yaml
# 幂等的——无论跑多少次，结果一致
- name: 确保 Nginx 已安装
  apt:
    name: nginx
    state: present          # present 表示"确保存在"，不是"装一次"

- name: 确保配置文件内容正确
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    validate: nginx -t %s   # 验证语法，防止配置错误导致服务不可用

- name: 确保服务运行
  service:
    name: nginx
    state: started
    enabled: yes
```

```yaml
# 非幂等的——每次执行结果都可能不同
- name: 直接执行命令（非幂等）
  command: /usr/bin/some-setup-script.sh
  # 没有幂等性保证，每次运行都会执行脚本

- name: 执行 shell 命令（非幂等）
  shell: echo "date: $(date)" >> /tmp/log.txt
  # 每次追加内容，结果各不相同
```

**如何让非幂等模块实现幂等性**：

方法一：使用 `creates` 参数（如果目标文件已存在则跳过）：
```yaml
- name: 仅在首次运行时执行初始化脚本
  command: /opt/scripts/init.sh
  creates: /opt/application/.initialized
  # 如果 .initialized 文件已存在，这个 task 会被完全跳过
```

方法二：使用 `changed_when` 自定义变更状态：
```yaml
- name: 执行健康检查注册脚本
  shell: |
    /opt/scripts/register-to-cmdb.sh
  register: register_result
  changed_when: "'registered' in register_result.stdout"
  failed_when:
    - register_result.rc != 0
    - "'already registered' not in register_result.stderr"
  # 如果返回"already registered"，视为未变更且不失败
```

方法三：结合 `when` 条件检查当前状态：
```yaml
- name: 检查证书是否需要更新
  command: openssl x509 -checkend 86400 -in /etc/ssl/certs/app.crt
  register: cert_check
  failed_when: false
  changed_when: false

- name: 更新证书（仅在证书即将过期时）
  command: /opt/scripts/renew-cert.sh
  when: cert_check.rc != 0
```

**幂等性设计的核心原则**：

1. **声明期望状态而非执行步骤**："确保 Nginx 已运行"而非"启动 Nginx"
2. **使用专用的 Ansible 模块而非 shell/command**：`copy` 模块比 `cp` 命令更可靠，`yum/apt` 模块比 `yum install` 更安全
3. **利用 handler 实现变更驱动通知**：只在实际有变更时才触发重启

```yaml
tasks:
  - name: 更新 Nginx 配置
    template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
    notify: reload nginx
    # 只有配置文件内容真正变化时，才触发 reload

handlers:
  - name: reload nginx
    service:
      name: nginx
      state: reloaded
```

4. **使用 `check_mode` 验证幂等性**：
```bash
ansible-playbook site.yml --check --diff
```
`--check` 模式下，幂等的模块会告诉你"将要做什么"而不实际执行。反复执行 `--check` 应该总是产生相同的输出。

**追问**:
- Q: `state=latest` 在 `yum/apt` 模块中使用是否幂等？存在什么风险？
- Q: `lineinfile` 和 `blockinfile` 模块如何处理幂等性？多行文本替换时如何保证？
- Q: 自定义 Ansible 模块如何实现幂等性？模块返回值的 `changed` 字段如何正确设置？

---

## Q4: Ansible 中 Playbook、Role 和 Collection 有什么区别？各自的应用场景是什么？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 阿里、腾讯、字节跳动

**答案要点**:
- Playbook 是 Ansible 的顶层编排文件，包含 hosts、tasks、vars 等定义
- Role 是 Playbook 的模块化封装，有标准目录结构，强调复用
- Collection 是 Ansible 2.9+ 引入的分发单元，包含 Role、Module、Plugin、Playbook 等
- 三者是"从简单到复杂、从单文件到生态"的递进关系

**完整回答**:

这个问题面试官考察的是你对 Ansible 内容组织方式的理解深度——这是项目从"单机脚本"向"企业级自动化平台"演进的必经路径。

**Playbook（剧本）**——最基础的编排单位：

```yaml
---
- name: Deploy Web Application
  hosts: webservers
  become: yes
  vars:
    app_port: 8080
    app_version: "1.2.0"

  tasks:
    - name: Install dependencies
      apt:
        name: "{{ item }}"
        state: present
      loop:
        - nginx
        - python3
        - git

    - name: Clone application repository
      git:
        repo: https://github.com/company/app.git
        dest: /opt/application
        version: "v{{ app_version }}"

    - name: Configure Nginx
      template:
        src: templates/nginx.conf.j2
        dest: /etc/nginx/sites-available/app
      notify: restart nginx

  handlers:
    - name: restart nginx
      service:
        name: nginx
        state: restarted
```

Playbook 适合：简单场景、一次性任务、2-3 台服务器的配置。

随着项目增长，Playbook 的主要问题暴露出来：
- 无法复用——多个 Playbook 之间共享相同的任务只能靠复制粘贴
- 没有层次结构——所有任务平铺在同一个文件中，200 行之后很难维护
- 没有默认值机制——每个 Playbook 必须定义自己的变量

**Role（角色）**——模块化复用：

Role 通过约定目录结构来组织任务、变量、模板、文件：

```
roles/
├── nginx/
│   ├── tasks/
│   │   └── main.yml          # 主要任务
│   ├── handlers/
│   │   └── main.yml          # 处理器
│   ├── templates/
│   │   └── nginx.conf.j2     # Jinja2 模板
│   ├── files/
│   │   └── default.conf      # 静态文件
│   ├── vars/
│   │   └── main.yml          # 高优先级变量
│   ├── defaults/
│   │   └── main.yml          # 默认变量（最低优先级）
│   ├── meta/
│   │   └── main.yml          # 依赖关系
│   └── README.md
└── app/
    ├── tasks/
    ├── handlers/
    └── ...
```

使用 Role 的 Playbook：
```yaml
---
- name: Configure Web Server
  hosts: webservers
  become: yes

  roles:
    - role: nginx
      nginx_port: 8080
      nginx_worker_processes: 4
    - role: app
      app_version: "1.2.0"
```

Role 适合：可复用的基础设施组件（nginx、postgresql、docker）、公司内部服务治理规范。

Role 的演进——当角色多到一定程度，你会发现需要管理"角色的角色"，这就是依赖管理：
```yaml
# roles/postgresql/meta/main.yml
dependencies:
  - role: common
  - role: epel
    when: ansible_os_family == "RedHat"
```

**Collection（集合）**——生态分发单元：

Collection 是 Ansible 2.9 引入的包格式，它将 Role + Module + Plugin + Playbook 打包成一个可分发的整体：

```
ansible-collections/
└── company/
    └── infra/
        ├── roles/
        │   ├── nginx/
        │   ├── postgresql/
        │   └── monitoring/
        ├── plugins/
        │   ├── modules/
        │   │   └── internal_dns.py    # 自定义模块
        │   └── filters/
        │       └── custom_filters.py  # 自定义 Jinja2 过滤器
        ├── playbooks/
        │   └── deploy_full_stack.yml
        ├── docs/
        ├── galaxy.yml                 # Collection 元数据
        └── requirements.yml
```

使用 Collection：
```yaml
# requirements.yml
collections:
  - name: company.infra
    version: ">=2.0.0"
  - name: ansible.posix
  - name: community.general
```

```bash
# 安装 Collection
ansible-galaxy collection install -r requirements.yml

# 直接使用 Collection 中的角色
ansible-playbook company.infra.deploy_full_stack
```

**三者的选择原则**：

- 临时任务或简单部署：一个 Playbook 文件就够了
- 基础设施组件需要复用到多个项目：提取为 Role
- 公司级自动化平台/跨团队分享：打包为 Collection，发布到自建 Galaxy 或 Automation Hub
- 需要分发自定义模块或插件：必须用 Collection

**追问**:
- Q: Ansible Galaxy 和 Automation Hub 有什么区别？私有 Galaxy 怎么搭建？
- Q: Role 中 `defaults` 和 `vars` 的变量优先级顺序是怎样的？如果使用 `include_role` 和 `import_role` 会有什么影响？
- Q: 如何将已有的 Role 迁移到 Collection 格式？迁移过程中 namespace 和版本策略怎么处理？

---

## Q5: Ansible Vault 如何保护敏感信息？在多团队协作中的最佳实践是什么？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、腾讯、美团

**答案要点**:
- Ansible Vault 是 Ansible 内置的加密工具，使用 AES-256 加密敏感数据
- 可以加密整个变量文件、单个变量、或文件中的特定字符串
- 多环境使用不同的 Vault 密码
- 生产环境结合密码管理工具（HashiCorp Vault、AWS Secrets Manager）使用
- Vault ID 支持使用多个不同的密码

**完整回答**:

Ansible Vault 解决的核心问题是：Ansible 配置文件（Inventory、Playbook、变量文件）通常都会提交到 Git 仓库，但密码、API Key、SSH 私钥等敏感信息不能明文存在代码仓库中。

**加密粒度选择**：

方案一：加密整个变量文件（最常用）
```bash
# 创建一个加密的变量文件
ansible-vault create inventories/production/group_vars/all/vault.yml

# 编辑加密文件
ansible-vault edit inventories/production/group_vars/all/vault.yml

# 加密已有文件
ansible-vault encrypt inventories/production/group_vars/all/secrets.yml
```

加密后的文件内容：
```yaml
$ANSIBLE_VAULT;1.1;AES256
3965303561653036346132633837366138343037636265313635333937303436
6132613830376136303234383138616535646635326231383035363937396239
...
```

方案二：加密单个变量值（更精细，但 CLI 操作稍复杂）
```yaml
# vars.yml
db_password: !vault |
  $ANSIBLE_VAULT;1.1;AES256
  343330666265343939613763626662363461346662...
api_key: !vault |
  $ANSIBLE_VAULT;1.1;AES256
  313932613936643539353362623139376432306563...
```

方案三：加密二进制文件（如私钥、证书）
```bash
ansible-vault encrypt --vault-id prod@prompt deploy_key.pem
```

**多环境多密码管理**：

使用 Vault ID 区分不同环境的密码：
```bash
# 创建不同环境的 vault 文件
ansible-vault create --vault-id dev@prompt dev_vault.yml
ansible-vault create --vault-id prod@prompt prod_vault.yml

# 执行时指定多个密码
ansible-playbook site.yml \
  --vault-id dev@prompt \
  --vault-id prod@~/.vault_pass_prod
```

密码文件的组织结构：
```
group_vars/
├── all/
│   └── vault.yml                # 通用的 vault 变量
├── dev/
│   └── vault.yml                # Dev 环境专有
├── staging/
│   └── vault.yml
└── prod/
    └── vault.yml                # 生产环境（权限控制最严格）
```

**生产最佳实践**：

1. **密码文件本身不进 Git**：`.gitignore` 中加入 `*_vault_pass*`，密码通过外部安全渠道分发

2. **CI/CD 集成**：
```yaml
# Jenkins/GitLab CI 中使用
# 密码从 CI 的 Secret 变量中读取，不写入任何配置文件
ansible-playbook deploy.yml \
  --vault-password-file <(echo "$VAULT_PASSWORD")
```

3. **结合 HashiCorp Vault 使用**：
```bash
# 从 Vault 动态获取 Ansible Vault 密码
ansible-playbook site.yml \
  --vault-password-file /opt/scripts/vault_helper.sh
```

`vault_helper.sh` 脚本内容：
```bash
#!/bin/bash
# 从 HashiCorp Vault 获取 Ansible Vault 密码
vault read -field=password secret/ansible/vault-pass
```

4. **变量命名规范**：
```yaml
# 明文变量和 vault 变量明确区分
db_host: "prod-db.cluster-xxx.us-east-1.rds.amazonaws.com"  # 明文非敏感
db_port: 5432
db_name: "myapp_production"

# 敏感信息统一使用 vault_ 前缀
vault_db_username: "admin"
vault_db_password: "SuperSecret123!"
vault_api_key: "sk-proj-xxxxx"
```

**追问**:
- Q: Ansible Vault 密码泄露后如何轮转？需要重新加密所有加密文件吗？
- Q: `--vault-id` 和旧的 `--vault-password-file` 有什么不同？Vault ID 解决了什么问题？
- Q: Git 中如何审计 vault 加密文件的变更历史？能不能 diff 两个加密版本的内容？

---

## Q6: `ansible-pull` 和 `ansible-push` 模式的区别是什么？各自适用什么场景？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、快手、字节跳动

**答案要点**:
- `ansible-push` 是默认模式：控制节点主动推送配置到受管节点
- `ansible-pull` 是拉取模式：受管节点主动从 Git 仓库拉取配置并本地执行
- `ansible-push` 适合集中管理和实时控制，`ansible-pull` 适合大规模节点和离线环境
- `ansible-pull` 使用 `ansible-pull` 命令，受管节点需要安装 Ansible
- 选择依据：节点数量、网络拓扑、管理频率、自愈需求

**完整回答**:

Ansible 默认的 `ansible-push` 模式是"中心化"的——控制节点发起 SSH 连接并推送配置。`ansible-pull` 模式是"去中心化"的——每台受管节点主动拉取配置并在本地执行。

**ansible-push（推送模式）**：

```
控制节点（Controller）
     │
     │ SSH 连接（推送配置）
     ▼
┌─────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐
│  Node 1    │  │  Node 2    │  │  Node 3    │
└────────────┘  └────────────┘  └────────────┘
```

```bash
# 典型的推送执行
ansible-playbook -i inventories/production site.yml
```

**特点**：
- 实时性——执行命令立即触发，适合主动运维
- 集中控制——所有 Playbook 和配置在控制节点上管理
- 责任明确——谁触发了变更、什么时候触发的，可以审计
- 适合 100-500 台管理规模

**限制**：
- 节点增多时，SSH 连接风暴会压垮控制节点
- 节点需要能被控制节点直接 SSH 访问（复杂网络环境受限）
- 节点随机重启后，除非外部触发 push，否则不会自动恢复到期望状态

**ansible-pull（拉取模式）**：

```
Git Repository（配置仓库）
     ▲
     │ git pull（拉取配置）
     │
┌─────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐
│  Node 1    │  │  Node 2    │  │  Node 3    │
│(带 Ansible)│  │(带 Ansible)│  │(带 Ansible)│
└────────────┘  └────────────┘  └────────────┘
```

```bash
# 在受管节点上运行的 crontab 配置
# 每 30 分钟从 Git 拉取最新配置并本地执行
*/30 * * * * /usr/bin/ansible-pull -o -U https://github.com/company/ansible-pull.git -C production
```

`ansible-pull` 命令的工作流程：
1. 从指定的 Git 仓库 clone/pull 最新的 Playbook 代码
2. 在本地执行 `ansible-playbook`（target 默认为 localhost）
3. 将执行结果记录到本地日志

```yaml
# ansible-pull 使用的 playbook（通常是一个 local 的 playbook）
---
- name: Self-management playbook
  hosts: localhost
  connection: local
  become: yes

  tasks:
    - name: Install security updates
      apt:
        upgrade: dist
        update_cache: yes
      tags: security

    - name: Ensure monitoring agent is running
      service:
        name: datadog-agent
        state: started
        enabled: yes

    - name: Deploy application config
      template:
        src: app_config.yml.j2
        dest: /etc/app/config.yml
```

**ansible-pull 的适用场景**：

1. **大规模节点（1000+）**——不需要集中 SSH，避免控制节点成为瓶颈
2. **自动扩缩容环境**——新启动的实例自动 `git pull` 并自配置，无需控制节点"发现"新节点
3. **离线/受限网络**——节点在 NAT 后方或无公网 IP，无法被 SSH 访问但可以出站访问 Git
4. **边缘设备/IoT**——设备位于不同网络，由 crontab 驱动自我修复
5. **自愈架构**——crontab 定期执行，确保节点始终处于期望状态

**ansible-push 的适用场景**：

1. **需要实时操作的场景**——紧急安全补丁、服务重启、滚动更新
2. **节点数量较少（200 以下）**
3. **有跳板机/堡垒机管理的网络**
4. **复杂编排需求**——需要控制执行顺序和依赖关系的多步骤部署

**生产环境中常见的混合模式**：

推荐做法是同时使用两种模式：
- `ansible-push` 用于主动运维（部署新版本、紧急修复、配置变更触发）
- `ansible-pull` 用于自愈（crontab 定期执行，确保节点始终合规）

同时还需要注意一个关键区别：ansible-pull 模式下节点上必须安装 Ansible（agentless 变成了 agentful），这在大规模场景下增加了额外的管理成本。

**追问**:
- Q: ansible-pull 模式中如何处理节点级别的差异？每个节点可能有不同的角色，但在 Git 仓库中只有一份 Playbook
- Q: ansible-pull 和 Ansible Tower/AWX 的配置管理有什么区别？AWX 能替代 ansible-pull 吗？
- Q: ansible-pull 模式下如何做"金丝雀发布"？如何在部分节点上先测试再全量？

---

## Q7: Ansible 的 Check Mode（--check）和 Diff Mode（--diff）在调试中怎么用？生产中的最佳实践是什么？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、字节跳动、美团

**答案要点**:
- `--check` 模拟执行，不实际变更系统，只报告"将要做什么"
- `--diff` 显示文件级别的变更内容（类似 git diff）
- 两者可以组合使用（`--check --diff`）预览变更
- Check Mode 依赖模块对 `check_mode` 的支持
- 生产 CI/CD 中使用 check mode 做预检

**完整回答**:

这两个标志是 Ansible 最实用的"防护网"工具——让你在真正修改系统之前，看清楚会改什么。

**Check Mode（模拟执行）**：

```bash
# 模拟执行整个 Playbook
ansible-playbook deploy.yml --check

# 结合 extra-vars 测试特定场景
ansible-playbook deploy.yml --check -e "app_version=2.0.0"
```

Check Mode 的工作原理：
- Ansible 调用模块时传入 `ANSIBLE_CHECK_MODE=1` 环境变量
- 支持 check_mode 的模块不会真正修改系统，而是报告"我将会这样做"
- 不支持 check_mode 的模块（command/shell/raw）在 check 模式下**直接跳过**，不执行也不报错

```yaml
# 让不支持 check_mode 的 task 在 check 模式下有输出
- name: 运行初始化脚本
  shell: /opt/scripts/init.sh
  check_mode:
    - block: debug
      msg: "Would run init.sh"
  # 或者使用 always_run（deprecated）
```

**Diff Mode（差异显示）**：

```bash
# 显示所有模板和文件的变更差异
ansible-playbook deploy.yml --diff

# check + diff 组合——最安全的预览方式
ansible-playbook deploy.yml --check --diff
```

Diff 显示的格式类似 `git diff`：
```
TASK [Copy Nginx configuration] ********************************************
--- before: /etc/nginx/sites-enabled/app.conf
+++ after: /tmp/ansible-.../app.conf.j2
@@ -5,7 +5,7 @@
 server {
     listen 80;
-    server_name old-app.company.com;
+    server_name new-app.company.com;
     root /var/www/app/public;
 }
```

**生产中的组合使用技巧**：

场景一：CI/CD 流水线中的预检
```yaml
# GitLab CI 中的 Ansible Check Job
ansible-playbook-check:
  stage: check
  script:
    - ansible-playbook site.yml --check --diff --vault-password-file <(echo "$VAULT_PASS")
  only:
    - merge_requests
  except:
    - main
```

场景二：有限的生产环境 Cheeck
```bash
# 只 check 特定角色
ansible-playbook site.yml --check --diff --tags databases

# 只 check 特定主机
ansible-playbook site.yml --check --diff --limit db-01

# 同时使用
ansible-playbook site.yml --check --diff --tags databases --limit db-01
```

场景三：处理 check mode 下的变量注册问题
```yaml
- name: 注册检查结果（注意处理 check mode）
  shell: /usr/bin/check-status.sh
  register: status
  check_mode: no  # 即使在 check mode 下也实际执行

- name: 根据状态执行操作
  shell: /usr/bin/apply-change.sh
  when:
    - status.rc != 0
  # 这个 task 在 check mode 下会被跳过
  # 但还是会报告 skipped：0
```

**Check Mode 的局限性和应对**：

1. **模块不支持**——command/shell/raw 在 check mode 下直接跳过。如果需要测试这些模块，考虑用 `creates` 参数或 `changed_when: false` 尝试

2. **副作用不可见**——一个有 side effect 的 module（比如调用外部 API）在 check mode 下可能不会调用，但你无法验证 side effect 是否正确

3. **结果是"快照"**——check mode 只反应你执行那一时刻的状态，实际 apply 前环境可能已经变化

**最佳实践总结**：

```
本地开发: ansible-playbook site.yml --check --diff
CI/MR 预检: ansible-playbook site.yml --check --diff --tags security,base
灰度测试: ansible-playbook site.yml --check --diff --limit canary-01
生产变更: 先 check → 人工审阅 diff → 再 apply
```

**追问**:
- Q: 如何在 `--check` 模式下让一个 task 仍然实际执行某些操作？`check_mode: no` 在什么场景下使用？
- Q: `--diff` 对于二进制文件或者加密文件（如 vault 加密文件）能显示 diff 吗？
- Q: `ansible-playbook --syntax-check` 和 `--check` 有什么不同？什么场景各自使用？

---

## Q8: `ansible-galaxy` 和 Ansible Collections 在实际生产中是如何管理和使用的？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- `ansible-galaxy` 是 Ansible 的内容管理工具，类似 Python 的 pip
- 可以管理 Roles 和 Collections 两种类型的内容
- `requirements.yml` 锁定依赖版本，配合 `ansible-galaxy install -r` 使用
- 生产环境中使用私有 Galaxy 或自建镜像仓库
- Collection 是 Ansible 2.9+ 的内容分发单元，替代了传统 Role 分发

**完整回答**:

`ansible-galaxy` 是团队协作和内容复用中不可或缺的工具。

**管理 Roles**：

```bash
# 安装 Role
ansible-galaxy role install geerlingguy.nginx

# 安装指定版本
ansible-galaxy role install geerlingguy.nginx,v3.1.4

# 从 Git 仓库安装私有 Role
ansible-galaxy role install git+https://github.com/company/ansible-role-app.git,v1.2.0

# 列出已安装的 Role
ansible-galaxy role list

# 移除 Role
ansible-galaxy role remove geerlingguy.nginx
```

**管理 Collections**：

```bash
# 从 Galaxy 安装 Collection
ansible-galaxy collection install community.docker

# 安装指定版本
ansible-galaxy collection install 'community.docker:>=3.0.0,&lt;4.0.0'

# 从自建仓库安装
ansible-galaxy collection install 'company.infra:>=1.0.0' \
  --server https://galaxy.internal.company.com/api/

# 从本地 tar 包安装（离线环境）
ansible-galaxy collection install ./collections/company-infra-1.2.0.tar.gz
```

**使用 requirements.yml 锁定依赖**：

```yaml
# requirements.yml
---
collections:
  - name: community.general
    version: ">=5.0.0,&lt;8.0.0"
  - name: community.docker
    version: ">=3.0.0"
  - name: ansible.posix
    version: "1.5.4"          # 精确锁定版本
  - name: company.infra
    source: https://galaxy.internal.company.com/api/
    version: ">=2.0.0"

roles:
  - name: geerlingguy.nginx
    version: 3.1.4
  - name: app-role
    src: https://github.com/company/ansible-role-app.git
    version: v1.2.0
```

```bash
# 一键安装所有依赖
ansible-galaxy install -r requirements.yml

# 安装到特定路径（在 Ansible 配置中指定 roles_path）
ansible-galaxy install -r requirements.yml -p /opt/ansible/roles
```

**生产环境中的依赖管理实践**：

项目根目录下版本锁定的完整方案：
```
project/
├── ansible.cfg                    # 配置 roles_path 等
├── requirements.yml               # 依赖声明
├── collections/
│   └── requirements.yml           # 仅 collections 依赖
├── roles/
│   └── .gitkeep                   # 安装的角色存放目录（gitignore）
├── collections/
│   └── ansible_collections/       # 安装的 collection 存放（gitignore）
├── playbooks/
│   └── site.yml
├── inventories/
└── ansible.cfg
```

**ansible.cfg** 中的路径配置：
```ini
[defaults]
roles_path = ./roles
collections_paths = ./collections
```

**离线环境的解决方案**：

在不能访问公网的机房或安全要求严格的网络中：

```bash
# 方式一：在有网络的机器上预下载
ansible-galaxy collection download community.docker -p ./offline_packages/

# 方式二：搭建私有 Galaxy 服务器
# 使用 ansible/ansible-galaxy-server 项目或 Artifactory
```

```yaml
# 离线环境 ansible.cfg 配置
[galaxy]
server_list = internal_galaxy

[galaxy_server.internal_galaxy]
url=https://galaxy.internal.company.com/api/
auth_url=https://galaxy.internal.company.com/auth/token
```

**面试常见陷阱——版本兼容性**：

Collection 发布的模块和某个特定 Ansible 版本绑定。比如 `community.general 6.0.0` 可能要求 Ansible Core >= 2.14。如果团队使用较旧的 Ansible 版本，安装新版本 Collection 可能导致运行时错误。

```bash
# 检查 Collection 对 Ansible 版本的要求
ansible-galaxy collection list

# 查看已安装 collection 的元数据
cat collections/ansible_collections/community/general/META.json | jq '.requires_ansible'
```

**追问**:
- Q: `ansible-galaxy` 的 `--ignore-certs` 参数在什么场景下使用？有什么安全风险？
- Q: 如何将内部开发的 Collection 发布到私有 Galaxy 服务器？发布流水线如何设计？
- Q: 如何解决掉 Collection 间的依赖冲突？（比如 A 要求 community.general >=5.0，B 要求 &lt;6.0）
