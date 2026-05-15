---
id: permissions
title: 权限管理
description: Linux 文件权限与用户管理
---

# Linux 权限管理

## 面试官想考什么

* 文件权限概念
* 用户和组管理
* 特殊权限
* ACL 权限

## 标准答案

### 权限表示

```
rwx rwx rwx
├───┴──┴──┬
│   │    └── 其他用户 (others)
│   └─────── 组用户 (group)
└─────────── 所有者 (owner)
```

### 权限数值

| 权限 | 数值 | 二进制 |
|------|------|--------|
| rwx | 7 | 111 |
| rw- | 6 | 110 |
| r-x | 5 | 101 |
| r-- | 4 | 100 |
| -wx | 3 | 011 |
| -w- | 2 | 010 |
| --x | 1 | 001 |
| --- | 0 | 000 |

### 示例

```bash
-rwxr-xr-x 1 root root 4096 Jan 15 10:00 script.sh
├───┬──┼──┼──┬
│   │  │  │  └ 文件类型
│   │  │  └───── others: r-x (5)
│   │  └──────── group: r-x (5)
│   └──────────── owner: rwx (7)
└─────────────── 文件类型 (- = 普通文件, d = 目录)
```

## 常见命令

### chmod

```bash
# 数字方式
chmod 755 script.sh      # rwxr-xr-x
chmod 644 file.txt       # rw-r--r--
chmod 600 id_rsa         # rw-------

# 符号方式
chmod u+x script.sh      # owner 增加执行
chmod g-w file.txt       # group 移除写
chmod o+r file.txt       # others 增加读
chmod a+x script.sh       # 所有用户增加执行
chmod +x script.sh        # 同上

# 递归
chmod -R 755 /var/www
```

### chown/chgrp

```bash
# 更改所有者
chown user file
chown -R user:group /var/www

# 更改组
chgrp group file
```

### 用户/组管理

```bash
# 用户
useradd username
userdel username
usermod -aG group user  # 追加组
passwd username

# 组
groupadd groupname
groupdel groupname
groups username         # 查看用户组

# 查看
id username
cat /etc/passwd
cat /etc/group
```

## 特殊权限

### SUID (4)

```bash
# 当执行设置了 SUID 的文件时，以文件所有者身份执行
-rwsr-xr-x 1 root root /usr/bin/passwd
#                      ^ s = SUID

# 设置
chmod u+s file
chmod 4755 file
```

**常见 SUID 文件**：
- `/usr/bin/passwd`
- `/usr/bin/sudo`
- `/usr/bin/su`

### SGID (2)

```bash
# 在目录中创建的文件，组继承目录的组
drwxr-sr-x 2 root shared /home/shared
#          ^ s = SGID

# 设置
chmod g+s dir
chmod 2755 dir
```

### Sticky Bit (1)

```bash
# 目录中用户只能删除自己的文件
drwxrwxrwt 10 root root /tmp
#           ^ t = Sticky Bit

# 设置
chmod +t /tmp
chmod 1777 /tmp
```

## ACL 权限

### 基本命令

```bash
# 查看 ACL
getfacl file

# 设置 ACL
setfacl -m u:john:rw file
setfacl -m g:developers:rx /home/shared
setfacl -m o::r-- file

# 删除 ACL
setfacl -x u:john file
setfacl -b file  # 删除所有 ACL

# 目录默认 ACL (新建文件自动继承)
setfacl -m d:u:john:rw /home/shared
```

### 示例

```bash
# 查看
$ getfacl /shared
file: /shared
owner: root
group: developers
user::rwx
user:alice:rw-
group::r-x
mask::rwx
other::---

# 添加用户权限
$ setfacl -m u:bob:rx /shared
$ getfacl /shared
user:bob:r-x
```

## sudo 配置

### visudo

```bash
# 语法
username ALL=(ALL:ALL) ALL           # 完全权限
username ALL=(ALL) NOPASSWD: /usr/bin/apt  # 无密码
%groupname ALL=(ALL) ALL              # 组权限

# 示例
devops ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
```

## 常见问题

### 权限不足

```bash
# 常见错误
# Permission denied
# - 文件权限不够
# - 目录权限不够 (需要 x 权限才能进入)
# - SELinux/AppArmor 限制

# 排查
ls -la file
namei -l /path/to/file
getenforce  # SELinux 状态
```

### 生产环境建议

```bash
# 最小权限原则
# 1. 不要使用 chmod 777
# 2. 敏感文件权限要小
# 3. 定期检查 SUID 文件
find / -perm -4000 -type f 2>/dev/null

# 日志目录权限
chmod 755 /var/log
chown root:adm /var/log
```

## 实战经验

1. **Web 服务权限**
   ```bash
   # nginx 用户运行
   chown -R nginx:nginx /var/www/html
   chmod -R 755 /var/www/html
   ```

2. **Docker 权限**
   ```bash
   # 添加用户到 docker 组
   usermod -aG docker username
   # 注意：docker 组权限等同于 root
   ```

3. **临时文件**
   ```bash
   # 使用 sticky bit
   chmod 1777 /tmp/app-temp
   # 确保用户只能删除自己的文件
   ```

## 延伸问题

* SELinux 是什么？如何临时关闭？
* umask 是什么？
* 文件系统权限和 SELinux 关系？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
