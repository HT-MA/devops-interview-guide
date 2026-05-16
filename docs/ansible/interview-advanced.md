---
id: interview-advanced
title: Ansible 高级面试题
description: Ansible 高级面试题，涵盖自定义模块、AWX/Tower、执行策略、Jinja2 最佳实践、Inventory 插件等真实场景
---

# Ansible 高级面试题

## Q1: 如何开发一个自定义 Ansible Module？模块的生命周期和执行流程是怎样的？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、华为

**答案要点**:
- Ansible 模块是用 Python 编写的独立脚本，通过标准输出返回 JSON
- 模块核心接口：`AnsibleModule` 对象，处理参数、执行逻辑、返回结果
- 模块必须实现幂等性——多次调用产生相同结果
- 模块的 `check_mode` 支持需要在代码中显式处理
- 自定义模块适用于扩展现有模块不支持的场景或封装内部 API

**完整回答**:

Ansible 模块本质上是一个"按约定编程"的 Python 脚本。理解模块的生命周期有助于写出可靠的自定义模块。

**模块的执行流程**：

```
控制节点                             受管节点
   │                                    │
   │  1. 读取 task 配置                  │
   │     提取 module 名称和参数          │
   │                                    │
   │  2. 组装模块执行包                  │
   │     (模块 Python 源码 +              │
   │      序列化的参数字典)               │
   │                                    │
   │  3. ──── SSH ──────────────────►   │
   │                                    │
   │                                    │  4. 写入临时文件
   │                                    │     ~/.ansible/tmp/AnsiballZ_xxx/
   │                                    │
   │                                    │  5. 执行模块
   │                                    │     python module.py
   │                                    │
   │  6. ◄──── stdout JSON ─────────── │
   │     读取模块的 stdout              │
   │                                    │
   │  7. 解析 JSON 结果                 │
   │     - changed: true/false          │
   │     - failed: true/false           │
   │     - msg: "描述信息"              │
   │                                    │
   │  8. 清理受管节点临时文件            │
```

**开发一个自定义模块的骨架**：

```python
#!/usr/bin/python
# modules/internal_dns.py

from __future__ import absolute_import, division, print_function
__metaclass__ = type

DOCUMENTATION = r'''
---
module: internal_dns
short_description: Manage internal DNS records via Company API
description:
  - Create, update, and delete DNS records in the internal DNS system.
options:
  name:
    description: DNS record name (without domain suffix)
    required: true
    type: str
  record_type:
    description: DNS record type
    choices: ['A', 'AAAA', 'CNAME', 'TXT']
    required: true
    type: str
  value:
    description: Record value
    required: true
    type: str
  state:
    description: Desired state of the record
    choices: ['present', 'absent']
    default: present
    type: str
author: DevOps Team
'''

EXAMPLES = r'''
- name: Create A record
  internal_dns:
    name: "api"
    record_type: "A"
    value: "10.0.1.100"
    state: present
'''

RETURN = r'''
record_id:
  description: ID of the managed DNS record
  type: str
  returned: always
'''

from ansible.module_utils.basic import AnsibleModule
import requests  # 或自建 API 客户端


def run_module():
    # 1. 定义模块参数
    module_args = dict(
        name=dict(type='str', required=True),
        record_type=dict(type='str', required=True,
                         choices=['A', 'AAAA', 'CNAME', 'TXT']),
        value=dict(type='str', required=True),
        state=dict(type='str', default='present',
                   choices=['present', 'absent']),
    )

    # 2. 初始化 AnsibleModule 对象
    module = AnsibleModule(
        argument_spec=module_args,
        supports_check_mode=True
    )

    name = module.params['name']
    record_type = module.params['record_type']
    value = module.params['value']
    state = module.params['state']

    # 3. 查询当前状态
    # 调用内部 DNS API 检查记录是否存在
    # current_record = dns_api.get_record(name, record_type)

    result = dict(
        changed=False,
        record_id='',
    )

    # 4. 幂等性逻辑
    if state == 'present':
        if not current_record:
            # 记录不存在，需要创建
            if module.check_mode:
                module.exit_json(**result)
            # actual create
            # new_record = dns_api.create_record(name, record_type, value)
            result['changed'] = True
            result['record_id'] = new_record.id
        elif current_record.value != value:
            # 记录存在但值不同，需要更新
            if module.check_mode:
                module.exit_json(**result)
            # actual update
            # dns_api.update_record(current_record.id, value)
            result['changed'] = True
            result['record_id'] = current_record.id
        else:
            # 记录已存在且值一致——幂等，不操作
            result['record_id'] = current_record.id

    elif state == 'absent':
        if current_record:
            if module.check_mode:
                module.exit_json(**result)
            # dns_api.delete_record(current_record.id)
            result['changed'] = True

    # 5. 返回结果
    module.exit_json(**result)


def main():
    run_module()

if __name__ == '__main__':
    main()
```

**模块开发的黄金规则**：

1. **幂等性是第一性原则**——每次执行相同参数应该产生相同结果。上面的例子中，`if current_record.value != value` 确保只有值不同时才更新

2. **必须支持 check_mode**——通过 `supports_check_mode=True` 声明，并在每个变更操作前检查 `module.check_mode`

3. **正确处理 `changed` 状态**——不准确地报告 `changed: true` 会导致 handler 误触发、告警误报

4. **使用 `module_utils` 复用代码**——如果多个模块需要共享 API 客户端逻辑，放在 `module_utils/internal_api.py` 中

5. **参数验证**——`AnsibleModule` 会自动处理参数类型检查和必填验证，不需要手写

**模块部署方式**：

```bash
# 方式一：直接放在 roles 的 library 目录下
roles/my_role/library/internal_dns.py

# 方式二：放在 playbook 根目录的 library 目录
project/library/internal_dns.py

# 方式三：打包到 Collection 中
collection/plugins/modules/internal_dns.py
```

**追问**:
- Q: 自定义模块中如何处理 API 认证信息？能否使用 Playbook 中定义的 `ansible_env` 或其他变量？
- Q: `AnsibleModule` 的 `diff` 参数在模块中如何使用？什么情况下需要返回 diff 信息？
- Q: 如何为自定义模块编写单元测试？`ansible-test` 工具怎么使用？

---

## Q2: Ansible Tower/AWX 在企业中如何管理 Playbook 的执行？和 CLI 相比有什么核心优势？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 腾讯、字节跳动、阿里

**答案要点**:
- AWX 是 Ansible Tower 的开源上游版本，提供 Web UI 和 REST API
- 核心功能：RBAC 权限控制、作业调度、操作审计、凭证管理
- 与 CLI 模式相比，Tower/AWX 解决了"谁在什么时间对哪些机器执行了什么操作"的审计问题
- 通过 Job Template 标准化运维操作，减少人为失误

**完整回答**:

Ansible CLI 对于个人开发者来说足够好用，但在企业中——当你有 10 个运维工程师管理 500 台服务器时——CLI 的"无管控"模式会成为灾难。Tower/AWX 填补的就是这个缺口。

**核心架构**：

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web UI     │     │  REST API    │     │  CLI (awx)   │
│  (浏览器)    │     │  (集成工具)   │     │  (命令行)     │
└──────┬───────┘     └──────┬────────┘     └──────┬───────┘
       │                    │                     │
       ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────┐
│                  AWX / Tower                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ RBAC     │  │ 作业调度  │  │  凭证管理系统     │   │
│  │ 权限控制  │  │ Cron/Web │  │  SSH Key/Vault   │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Inventory│  │ 执行日志  │  │ 通知/告警集成     │   │
│  │ 同步管理  │  │ 审计追踪  │  │ Slack/Email/Webhook│ │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  受管节点       │
              │  (Managed Nodes)│
              └────────────────┘
```

**CLI vs Tower/AWX 的关键差异**：

| 维度 | Ansible CLI | Ansible Tower/AWX |
|------|------------|-------------------|
| 权限控制 | 谁有控制节点 SSH 谁就能执行任何 Playbook | 细粒度 RBAC：按项目、Inventory、Job Template 授权 |
| 审计 | 依赖 shell history 和日志 | 每次执行自动记录：谁执行、什么时候、用什么参数、结果如何 |
| 凭证管理 | SSH 密钥存在控制节点文件系统 | 加密存储凭证，用户看不到明文密码 |
| 任务调度 | Crontab | 内置调度器，支持复杂日历规则 |
| Webhook | 不原生支持 | 支持 GitHub/GitLab Webhook 触发自动部署 |

**关键概念**：

**Job Template**：这是 Tower/AWX 的核心抽象。它把一个 Playbook 文件 + Inventory + 凭证 + 变量组合成一个"可执行的作业模板"。

```yaml
# 通过 AWX API 创建 Job Template 的等效配置
job_template:
  name: "Production Deploy"
  job_type: "run"
  inventory: "Production"
  project: "App Deploy Repo"
  playbook: "site.yml"
  credentials:
    - "Production SSH Key"
    - "Ansible Vault Password"
  extra_vars:
    app_version: "{{ APP_VERSION }}"
  limit: "webservers"
```

执行一次作业时，AWX 会在容器中启动 Ansible 进程，所有执行日志实时流式传输到 Web UI，并持久化到数据库。

**Project 和 SCM 集成**：

Tower/AWX 直接从 Git 仓库同步 Playbook：

```yaml
project:
  name: "Infrastructure Code"
  scm_type: git
  scm_url: "https://github.com/company/infra-ansible.git"
  scm_branch: "production"
  scm_update_on_launch: true  # 每次执行前自动拉取最新代码
```

**生产实践中的 Tower/AWX 配置建议**：

1. **隔离执行环境**——每个 Job Template 使用独立的隔离节点（Isolated Node）或容器执行，避免 Playbook 之间的干扰

2. **分类 Inventory**——按环境（dev/staging/prod）创建不同的 Inventory，每种 Inventory 关联不同的凭证

```bash
# AWX Inventory 结构
Inventories/
├── Production/
│   ├── Groups: webservers, databases, loadbalancers
│   └── Sources: aws_ec2 (filter: tag:Environment=production)
├── Staging/
│   ├── Groups: webservers, databases
│   └── Sources: aws_ec2 (filter: tag:Environment=staging)
└── Development/
    └── Hosts: localhost
```

3. **通知集成**——配置执行结果通知：
   - 成功：Slack 通知 #deployments 频道
   - 失败：Slack + PagerDuty 告警

4. **审批节点**——生产环境的关键部署配置"审批前置"的 Workflow Template

**Workflow Template（工作流模板）**：

```
[开发环境部署] → 自动触发 → [测试环境部署] → 等待审批 → [生产环境部署]
                                                         │
                                                    [回滚节点]
```

**追问**:
- Q: AWX 中的 Custom Virtual Environment（自定义 Python 虚拟环境）在什么场景下使用？如何配置？
- Q: AWX 的 Smart Inventory 是什么？和普通 Inventory 有何不同？
- Q: Tower/AWX 在高可用部署中，数据库和消息队列（RabbitMQ）的架构怎么设计？

---

## Q3: Ansible 的执行策略（Execution Strategy）有哪些？`linear`、`free`、`delegating` 各适用于什么场景？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- Ansible 默认执行策略是 `linear`——所有主机执行完当前 task 后才进入下一 task
- `free` 策略——每台主机独立执行，不受其他主机速度影响
- `delegating` 策略——通过 `delegate_to` 将任务委托给特定主机执行
- 策略选择影响 Playbook 的执行速度、一致性和资源竞争
- 自定义策略可以实现特殊的编排需求

**完整回答**:

执行策略决定了 Playbook 中的 tasks 如何跨主机调度。默认的 `linear` 策略虽然安全，但在大规模场景下可能成为性能瓶颈。

**linear 策略（默认）**：

```yaml
---
- name: Rolling update with linear
  hosts: webservers
  strategy: linear    # 默认，可以省略
  serial: 3           # 每次同时处理 3 台主机
  tasks:
    - name: 1. Pull new image
      command: docker pull app:{{ version }}

    - name: 2. Restart container
      command: docker-compose up -d

    - name: 3. Health check
      uri:
        url: http://localhost:8080/health
        status_code: 200
```

`linear` 的行为：
- Task 1 在所有 3 台主机上执行完成后，才开始 Task 2
- 所有主机保持同步——不会有主机"领先"于其他主机
- 适合需要保持集群一致性的操作（比如负载均衡器后端同时切换）

结合 `serial` 参数可以实现滚动更新：
```
serial: 1    → 一次 1 台，最小化影响范围
serial: 30%  → 一次 30% 的主机
serial: [1, 3, 5, *]  → 先 1 台金丝雀，再 3 台，再 5 台，最后全部
```

**free 策略（异步自主执行）**：

```yaml
- name: Batch data processing
  hosts: workers
  strategy: free
  tasks:
    - name: 1. Download dataset
      get_url:
        url: "https://data.example.com/{{ dataset_id }}.csv"
        dest: /data/raw/

    - name: 2. Process data
      command: /opt/scripts/process.sh /data/raw/{{ dataset_id }}.csv

    - name: 3. Upload results
      command: /opt/scripts/upload.sh /data/processed/{{ dataset_id }}.csv
```

`free` 的行为：
- 每台主机独立完成所有 tasks，不管其他主机进度如何
- 快的机器不受慢的机器影响，整体完成时间更快
- 某些主机可能已经执行到 Task 3，而其他主机还在执行 Task 1
- 不适合需要集群一致性的场景

**free 策略的典型场景**：
- 数据处理任务（每个 worker 独立处理自己的数据集）
- 客户端 Agent 升级（每台机器独立完成升级）
- 大规模配置采集（采集操作彼此不依赖）

**delegating 策略（委托模式）**：

严格来说 `delegating` 不是一个独立的 `strategy` 值，而是一种通过 `delegate_to` 实现的任务执行模式：

```yaml
- name: Update load balancer
  hosts: webservers
  serial: 1

  tasks:
    - name: 从负载均衡器移除当前节点
      haproxy:
        state: disabled
        host: "{{ inventory_hostname }}"
        backend: myapp-backend
      delegate_to: "{{ haproxy_host }}"  # 在 haproxy 服务器上执行

    - name: 拉取最新代码
      git:
        repo: https://github.com/company/app.git
        dest: /var/www/app

    - name: 重启应用
      service:
        name: app
        state: restarted

    - name: 健康检查
      uri:
        url: "http://{{ inventory_hostname }}:8080/health"
        status_code: 200
      delegate_to: localhost  # 在 Ansible 控制节点上执行检查

    - name: 加回负载均衡器
      haproxy:
        state: enabled
        host: "{{ inventory_hostname }}"
        backend: myapp-backend
      delegate_to: "{{ haproxy_host }}"
```

和 `delegate_to` 配套的常用选项：
- `delegate_facts: true`——被委托主机上执行的事实会委托给目标主机（而不是控制节点）
- `run_once: true`——只执行一次（即使有多台主机）

**三种策略的性能对比数据**：

对于 50 台主机的配置管理任务：
```
linear:    总耗时约 300s（每台都需要等待最慢的主机完成当前 task）
free:      总耗时约 120s（快的机器快完成，整体完成时间取决于最慢的机器）
linear + serial:10: 总耗时约 180s（10 台一批，批次内同步
```

**生产推荐**：
- 服务部署/滚动更新：`linear` + `serial`
- 批量配置修复：`free`
- 负载均衡感知的操作：`delegate_to` + `serial: 1`
- 大规模系统初始化：`free` + `async`

**追问**:
- Q: `serial` 和 `max_fail_percentage` 如何配合使用？如果 30% 的机器失败，Ansible 会怎么处理？
- Q: `throttle` 参数和 `serial` 有什么区别？在什么场景下使用 throttle？
- Q: 自定义执行策略如何实现？实现一个"金丝雀发布"策略的伪代码思路是什么？

---

## Q4: Ansible 中 async 异步任务和 polling 轮询机制是如何工作的？什么场景必须使用异步模式？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、腾讯、美团

**答案要点**:
- `async` 参数设置任务的最大执行时间
- `poll` 参数设置轮询间隔，0 表示"fire and forget"
- 异步模式用于长时间运行的任务（>SSH 超时时间）
- 长时间任务可以通过 `async_status` 模块手动检查状态
- 异步任务的结果需要单独注册和检查

**完整回答**:

默认情况下 Ansible 通过 SSH 执行模块时，SSH 会话会保持打开直到任务完成。如果一个任务需要运行 10 分钟，但 SSH 超时设置为 5 分钟——连接断开，任务失败。异步模式解决的就是这个问题。

**异步任务的基本用法**：

```yaml
- name: 长时间运行的数据库迁移
  command: /opt/scripts/migrate-database.sh
  async: 3600          # 最多等待 3600 秒（1 小时）
  poll: 10             # 每 10 秒检查一次状态
  register: migration_result
```

`async` 和 `poll` 的组合含义：
- `async: 3600`——任务可以运行最多 3600 秒，超过则超时失败
- `poll: 10`——Ansible 每 10 秒检查一次任务状态，直到完成或超时
- `poll: 0`——启动任务后不等待，立即继续执行下一个 task（fire and forget）

**fire and forget 模式**：

```yaml
- name: 启动超大数据同步任务（不等待完成）
  shell: /opt/scripts/sync-huge-data.sh &
  async: 7200
  poll: 0
  register: sync_job

- name: 继续执行其他配置任务
  # 这些 task 在数据同步的同时执行
  ...

- name: 稍后检查数据同步状态
  async_status:
    jid: "{{ sync_job.ansible_job_id }}"
  register: sync_result
  until: sync_result.finished
  retries: 30
  delay: 30
```

**异步任务的典型场景**：

场景一：系统包更新（yum/apt 可能耗时较长）
```yaml
- name: 安装大量软件包（异步执行）
  yum:
    name: "{{ packages }}"
    state: latest
  async: 600
  poll: 5
  register: yum_result
```

场景二：数据库操作
```yaml
- name: 重建大型数据库索引（可能需要 30+ 分钟）
  shell: |
    psql -c "REINDEX DATABASE myapp;"
  async: 2700    # 45 分钟超时
  poll: 0
  register: reindex_job

- name: 执行其他不依赖索引的任务
  ...

- name: 等待索引重建完成
  async_status:
    jid: "{{ reindex_job.ansible_job_id }}"
  register: job_result
  until: job_result.finished
  retries: 90
  delay: 30
```

场景三：并行执行多个独立任务
```yaml
- name: 节点 A 执行磁盘检查
  command: /sbin/badblocks -sv /dev/sdb
  async: 7200
  poll: 0
  register: badblocks_a
  when: inventory_hostname == 'node-a'

- name: 节点 B 执行内存测试
  command: /usr/bin/memtest
  async: 7200
  poll: 0
  register: memtest_b
  when: inventory_hostname == 'node-b'

- name: 等待所有节点检查完成
  async_status:
    jid: "{{ item.ansible_job_id }}"
  loop:
    - "{{ badblocks_a }}"
    - "{{ memtest_b }}"
  register: async_results
  until: async_results.finished
  retries: 120
  delay: 60
```

**生产中的关键注意事项**：

1. **任务超时设计**：`async` 值应该大于任务预期最大耗时。设置过小会导致任务被过早终止。

2. **SSH 超时和 async 的关系**：即使 `poll > 0`，async 模式会在后台保持一个 SSH 会话用于轮询。如果 SSH 会话本身断开，后台任务仍然会继续执行，但轮询无法获取状态。最终任务由 async 的 timeout 机制终止。

3. **开机启动脚本避免使用 async**：如果任务在系统初始化阶段执行（如 `cloud-init`），不要使用 `poll: 0`，因为控制节点可能无法在后续阶段重新连接查询状态。

4. **后台任务清理**：Ansible 在受管节点上启动的后台进程在任务完成后会自动退出，但如果控制节点异常断开，后台进程变成孤儿进程。`async: 0` 可以立即清理后台任务。

```yaml
# 后台任务安全执行模式
- name: 后台启动长任务并且确保清理
  shell: |
    nohup /opt/scripts/long-task.sh > /var/log/long-task.log 2>&1 &
    echo $! > /var/run/long-task.pid
  async: 1
  poll: 0
```

**追问**:
- Q: async 任务中如何设置回调或通知机制？任务完成时能否自动触发 handler？
- Q: `poll: 0` 的任务结果（register）在后续 tasks 中怎么做条件判断？`ansible_job_id` 的格式是什么？
- Q: Ansible 默认的 SSH 超时时间是多少？在 async 模式下 SSH 超时对异步任务有什么影响？

---

## Q5: Jinja2 模板在 Ansible 中的最佳实践是什么？常见的性能陷阱和规避方法有哪些？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 字节跳动、腾讯、阿里

**答案要点**:
- Jinja2 是 Ansible 默认的模板引擎，在 `template` 模块和变量插值中广泛使用
- 最佳实践包括：模板继承、宏抽离、过滤器链、数据类型转换
- 性能陷阱：过度使用复杂循环、深层嵌套变量、大量条件判断
- 常见问题：未定义的变量处理、空白控制、特殊字符转义

**完整回答**:

Jinja2 的掌握程度是区分"能用 Ansible"和"用好 Ansible"的重要标志。很多 Playbook 的性能问题和维护困难都源于 Jinja2 的使用不当。

**模板文件最佳实践**：

```jinja2
{# templates/nginx.conf.j2 #}
{# 使用注释说明模板用途和变量 #}

upstream {{ app_name }} {
    {% for server in app_servers %}
    server {{ server.host }}:{{ server.port | default(8080) }} weight={{ server.weight | default(1) }};
    {% endfor %}
}

server {
    listen {{ nginx_port | default(80) }};
    server_name {{ server_name }};

    location / {
        proxy_pass http://{{ app_name }};

        {# 使用宏抽离重复代码块 #}
        {% include 'partials/proxy_headers.j2' %}
    }

    location /health {
        return 200 "healthy\n";
    }

    {# 条件包含——不同环境不同的配置 #}
    {% if enable_ssl %}
    include /etc/nginx/ssl.conf;
    {% endif %}
}
```

**变量插值的最佳实践**：

```yaml
# 推荐：显式的变量命名和类型转换
# good
- name: Set max connections
  template:
    src: app.conf.j2
    dest: /etc/app/config.yml
  vars:
    max_connections: "{{ (db_max_connections | int) * 2 }}"
    enable_feature_x: "{{ feature_flags | selectattr('name', 'equalto', 'feature_x') | map(attribute='enabled') | first | default(false) }}"
```

**十大 Jinja2 最佳实践**：

1. **默认值无处不在**：
```jinja2
{# 所有变量都提供默认值，避免 undefined 错误 #}
{{ app_port | default(8080) }}
{{ app_name | default('unknown') }}
```

2. **使用 `| mandatory` 强制要求必填变量**：
```jinja2
{# 如果变量未定义，模板渲染时报错而非静默使用空值 #}
{{ database_url | mandatory }}
```

3. **用 `ternary` 过滤器替代 if-else**：
```jinja2
{# 不推荐 #}
{% if environment == 'production' %}true{% else %}false{% endif %}

{# 推荐 #}
{{ (environment == 'production') | ternary('true', 'false') }}
```

4. **避免模板中的复杂业务逻辑**：复杂逻辑应该在 Playbook 的 vars 中预处理，而不是在模板中计算。

5. **`combine` 过滤器合并字典**：
```jinja2
{% set default_config = {
  'port': 8080,
  'host': '0.0.0.0',
  'debug': false
} %}
{% set final_config = default_config | combine(override_config) %}
```

6. **`from_json`/`from_yaml` 解析字符串**：
```jinja2
{% set config_data = config_string | from_yaml %}
{{ config_data.server.port }}
```

7. **空白控制避免多余空行**：
```jinja2
{% for item in items -%}
{{ item }}
{%- endfor %}
{# 使用 -% 和 {%- 控制空白 #}
```

8. **使用 `select`/`reject` 过滤器链**：
```jinja2
{# 筛选出符合条件的元素 #}
{% set active_users = users | selectattr('active', 'equalto', true) | list %}
```

9. **避免 `no_log` 泄露敏感信息**：
```yaml
- name: Template with secrets
  template:
    src: database.yml.j2
    dest: /etc/app/database.yml
  no_log: true  # 防止模板渲染结果被日志记录
```

10. **性能优化——减少模板渲染次数**：
```jinja2
{# 不好的做法：每次循环都计算一次 #}
{% for user in user_list %}
{{ user.name }}:{{ user_list | length }}
{% endfor %}

{# 好的做法：先计算结果再循环 #}
{% set total = user_list | length %}
{% for user in user_list %}
{{ user.name }}:{{ total }}
{% endfor %}
```

**常见的 Jinja2 性能陷阱**：

**陷阱一：模板中的正则匹配**：
```jinja2
{# 避免在模板中使用复杂的正则替换 #}
{# 不好的做法 #}
{% set cleaned = dirty_string | regex_replace('^.*?\\[', '') %}

{# 好的做法：在 Playbook 中预处理 #}
```

**陷阱二：递归模板继承导致的渲染缓慢**：
`{% include %}` 链如果深度超过 5-6 层，渲染时间会显著增加。建议保持模板继承树扁平。

**陷阱三：大数据集的循环渲染**：
如果有 10000 条记录需要生成配置文件，`template` 模块会成为瓶颈。考虑用 `copy` 模块直接分发生成好的文件，或者通过 `lineinfile`/`blockinfile` 增量更新。

**追问**:
- Q: Jinja2 的 `undefined` 行为可以配置吗？`StrictUndefined` 模式在 Ansible 中如何启用？
- Q: `template` 模块的 `trim_blocks` 和 `lstrip_blocks` 选项有什么作用？
- Q: 如何在 Ansible 中使用自定义 Jinja2 filter？通过什么方式注册？

---

## Q6: Ansible 的 Inventory 插件是如何工作的？如何在 AWS/VMware 等动态环境中使用？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯

**答案要点**:
- Inventory 插件是 Ansible 2.4+ 推荐的动态清单方案，替代旧的脚本方式
- 通过 YAML 配置文件声明源信息，插件自动查询 API 并生成主机列表
- 官方内置插件覆盖 AWS EC2、VMware vSphere、OpenStack、GCP、Azure 等
- 通过 `keyed_groups` 和 `compose` 实现灵活的变量注入和分组
- 缓存机制避免每次执行都调用云 API

**完整回答**:

Inventory 插件是 Ansible 动态发现基础设施的标准方式。相比于传统 shell 脚本，插件更易配置、性能更好、与 Ansible 集成更紧密。

**插件工作原理**：

```
ansible-playbook -i aws_ec2.yml site.yml
                       │
                       ▼
              Inventory Plugin
              (aws_ec2.py)
                       │
                       ├── 读取配置文件（YAML）
                       ├── 查询 AWS API（EC2 DescribeInstances）
                       ├── 应用过滤器和分组逻辑
                       ├── 构建主机变量
                       ├── （可选的）缓存结果
                       └── 返回 JSON 格式主机清单
```

**AWS EC2 插件配置**：

```yaml
# inventories/production/aws_ec2.yml
plugin: amazon.aws.aws_ec2
regions:
  - us-east-1
  - us-west-2

# 过滤条件
filters:
  tag:Environment: production
  instance-state-name: running

# 分组规则：根据标签自动分组
keyed_groups:
  - key: tags.Role
    prefix: role
    separator: ""
  - key: placement.region
    prefix: aws_region
  - key: tags.Project
    prefix: project
  - key: instance_type
    prefix: type

# 主机变量映射
compose:
  ansible_host: private_ip_address  # 使用私有 IP 连接
  ansible_user: "'ec2-user'"       # 固定连接用户
  instance_id: instance_id
  availability_zone: placement.availability_zone

# 设置主机变量
vars:
  ansible_ssh_private_key_file: /path/to/prod-key.pem
  ansible_python_interpreter: /usr/bin/python3
```

**VMware vSphere 插件配置**：

```yaml
# inventories/vcenter.yml
plugin: vmware.vmware_rest.vmware
hostname: vcenter.company.com
username: "{{ vault_vcenter_user }}"
password: "{{ vault_vcenter_password }}"
validate_certs: false

filters:
  - power_state: poweredOn
  - guest_id: rhel8_64Guest

keyed_groups:
  - key: guest_id
    prefix: os
  - key: cluster
  - key: "custom_annotations['Department']"
    prefix: dept

compose:
  ansible_host: ip_address
  ansible_user: "'cloud-user'"
```

**OpenStack 插件配置**：

```yaml
# inventories/openstack.yml
plugin: openstack.cloud.openstack
cloud: mycloud
fail_on_errors: true

validate_certs: false
expand_hostvars: true

keyed_groups:
  - key: metadata.group
    prefix: group
  - key: flavor.name
    prefix: flavor
  - key: "properties['project']"
    prefix: project

compose:
  ansible_host: interface_ip
```

**缓存的配置和使用**：

```yaml
# ansible.cfg
[inventory]
cache = true
cache_plugin = jsonfile
cache_timeout = 3600   # 1 小时缓存过期
cache_connection = /tmp/ansible_inventory_cache
```

缓存的影响：
- 开启缓存后首次调用需要访问云 API 构建缓存（可能会慢）
- 后续调用从本地缓存读取（毫秒级）
- `--flush-cache` 参数强制刷新缓存，获取最新数据

**多源 Inventory 混合**：

一个 Inventory 目录可以包含多个源：

```
inventories/production/
├── aws_ec2.yml           # AWS EC2 动态清单
├── on_premise.yml        # 传统服务器清单
├── monitoring.yml        # Datadog/Nagios 发现的机器
└── group_vars/
    ├── all.yml
    ├── role_webserver.yml
    └── aws_region_us-east-1.yml
```

```bash
# 使用目录作为 inventory 源，自动加载所有配置
ansible-playbook -i inventories/production/ site.yml
```

**生产中的高级用法——自定义分组逻辑**：

```yaml
plugin: amazon.aws.aws_ec2
# ...

# 自定义分组——基于可用区和实例类型的组合
keyed_groups:
  - key: "'az_' + placement.availability_zone"
    prefix: ""
  - key: "'type_' + instance_type | replace('.', '_')"
    prefix: ""
  - key: tags.Role
  - key: tags.Environment

# 条件添加主机到特定组
groups:
  database_servers: "'db' in (tags.Role | default(''))"
  slow_instances: "'t2' in instance_type"
  prod_instances: "'production' in (tags.Environment | default(''))"
```

**追问**:
- Q: 如何为 Inventory 插件创建自定义的 cache plugin？cache 使用 Redis 是否可行？
- Q: `constructed.yml` 是什么？它如何与 Inventory 插件配合使用？
- Q: Inventory 插件在 `--limit` 参数下的过滤行为是怎样的？插件层面的过滤和 playbook 层面的过滤有什么性能差异？

---

## Q7: Ansible 和 SaltStack、Puppet 等其他配置管理工具相比，各自的优缺点是什么？你如何选择？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯、美团

**答案要点**:
- Ansible：无代理、SSH 驱动、学习曲线低、适合中小规模
- SaltStack：混合架构（master/minion 和 SSH 无代理模式），高性能，适合大规模
- Puppet：声明式 DSL、成熟生态、适合长期一致性管理
- 选择依据：团队技能、基础设施规模、网络环境、变更频率

**完整回答**:

这个问题面试官考察的是你的技术视野——你是否了解不同工具的适用场景，而不是只熟悉 Ansible 就觉得其他工具都是垃圾。

**架构对比**：

```
Ansible（无代理）
控制节点 ───SSH───► 受管节点
                    （只需 Python）
                    
SaltStack（混合）
Salt Master ◄──ZeroMQ──► Salt Minion（代理模式）
或
Salt Master ───SSH───► 受管节点（无代理模式，功能受限）

Puppet（代理模式）
Puppet Master ◄──HTTPS──► Puppet Agent
                    （证书认证，定时拉取）
```

**核心维度对比**：

**一、部署和运维复杂度**

Ansible 最简单：只需要一台控制节点安装 Ansible，受管节点有 SSH 和 Python 即可。

SaltStack 中等：Master 需要配置 PKI 证书管理、Minion 需要安装 agent、ZeroMQ 端口需要开放。但如果使用 Salt SSH 模式，复杂度降到接近 Ansible 水平。

Puppet 最复杂：需要部署 Puppet Server（JVM 应用，资源消耗大）、管理证书签发、配置环境隔离。Puppet Bolt（无代理模式）简化了部分场景，但核心功能仍依赖代理。

**二、性能和扩展性**

```bash
# 假设管理 5000 台服务器
Ansible:      SSH 连接成为瓶颈，需要分层管理（ansible-pull 或 AWX 扩容）
SaltStack:    ZeroMQ 消息队列架构可以管理 10000+ 节点，性能最佳
Puppet:       成熟的分布式架构，支持多 Master + Compiler 水平扩展
```

SaltStack 的性能优势来自于它的通信方式——使用 ZeroMQ 消息队列而不是 SSH。Salt Master 可以同时向数千台 Minion 发送命令，延迟在毫秒级别。而 Ansible 的 SSH 连接建立成本较高，每台主机都需要独立的 SSH 会话。

**三、语言和技能**

Ansible 使用 YAML + Jinja2，学习曲线最低。运维团队中即使不太懂编程的成员也能在 1-2 周内产出可用的 Playbook。

SaltStack 使用 YAML + Jinja2 + Python（state 文件本质上是数据结构 + Python 表达式）。学习曲线中等。Salt 的 pillar、grains、renderer 等概念比 Ansible 的变量系统更复杂。

Puppet 使用专有的 Puppet DSL（声明式语言），有自己的语法语义。学习曲线最高。虽然 Puppet 4+ 引入了更多 Ruby 语法，但其独特的资源抽象（resource type、provider、autorequire）需要较长时间掌握。

**四、处理漂移和合规**

Puppet 的设计目标就是"持续合规"——agent 默认每 30 分钟运行一次，确保系统始终处于期望状态。这在 SOC2、PCI-DSS 等合规场景中是核心需求。

Ansible 本质上是"按需变更"——只在手动触发或 CI/CD 触发时才执行。虽然有 ansible-pull 做定期检查，但那不是设计核心功能。

SaltStack 通过 reactor 和 beacon 可以实现事件驱动的实时合规——当检测到漂移时立即触发修正。

**五、事件驱动和实时性**

SaltStack 的 event system（事件系统）是它最独特的能力。Minion 可以将事件实时推送到 Master，Master 通过 reactor 实时响应。比如：

- 当某台服务器的磁盘使用率超过 90%（beacon 检测到）→ 自动触发清理任务
- 当新 EC2 实例启动并注册到 Salt（event 触发）→ 自动配置该实例

Ansible 和 Puppet 在这方面的能力相对较弱。

**我的选择框架**：

```yaml
选择 Ansible 当：
  团队规模 < 20 人
  受管节点 < 500 台
  临时变更频繁
  环境为云原生（不固定 IP）
  团队成员 DevOps 背景

选择 SaltStack 当：
  受管节点 > 1000 台
  需要实时/事件驱动的自动化
  大规模配置管理和编排
  网络团队熟练掌握 Python

选择 Puppet 当：
  严格合规要求（ITIL、SOC2）
  需要持续漂移修正
  长期一致性管理
  预算充足可以采购商业支持
```

**追问**:
- Q: 你在实际工作中是否有从 Puppet 迁移到 Ansible 的经验？迁移中的痛点是什么？
- Q: SaltStack 的 pillar 和 Ansible 的 group_vars 在概念和实现上有什么区别？
- Q: 如果基础设施是 200 台服务器 + Kubernetes 集群，你会选择混合使用多个工具还是一个工具覆盖全部？
