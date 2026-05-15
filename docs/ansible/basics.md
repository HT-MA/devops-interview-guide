---
id: basics
title: Ansible 基础
description: Ansible 基础概念
---

# Ansible 基础

## 标准答案

### Inventory

```ini
# 主机清单
[webservers]
web1.example.com
web2.example.com

[databases]
db1.example.com ansible_user=admin ansible_password=secret
```

### Ad-hoc 命令

```bash
# 测试连通性
ansible all -m ping

# 执行命令
ansible all -m shell -a "uptime"

# 复制文件
ansible all -m copy -a "src=./file dest=/tmp/"
```

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
