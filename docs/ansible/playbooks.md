---
id: playbooks
title: Playbooks
description: Ansible Playbook 编写
---

# Ansible Playbooks

## 标准答案

### 基本结构

```yaml
---
- name: Deploy Web Application
  hosts: webservers
  become: yes
  vars:
    app_port: 8080
    
  tasks:
    - name: Install Nginx
      apt:
        name: nginx
        state: present
        
    - name: Copy configuration
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify: Restart Nginx
      
    - name: Start Nginx
      service:
        name: nginx
        state: started
        enabled: yes
        
  handlers:
    - name: Restart Nginx
      service:
        name: nginx
        state: restarted
```

### Role 结构

```
roles/
├── common/
│   ├── tasks/
│   │   └── main.yml
│   ├── handlers/
│   │   └── main.yml
│   └── templates/
```

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
