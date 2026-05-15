---
id: shell
title: Shell 脚本
description: Shell 脚本编程核心知识点
---

# Shell 脚本

## 面试官想考什么

* 基础语法
* 文本处理
* 常用命令
* 调试技巧

## 标准答案

### 基础语法

```bash
#!/bin/bash

# 变量
name="value"           # 定义
echo $name             # 使用
echo ${name}           # 推荐写法
readonly CONST="abc"   # 常量
unset name             # 删除

# 字符串
str='单引号原文输出'    # 单引号不解析变量
str="双引号解析变量 $name"
str="拼接 ${str}world"

# 数组
arr=(1 2 3 4 5)
echo ${arr[0]}         # 第一个元素
echo ${arr[@]}         # 所有元素
echo ${#arr[@]}        # 数组长度
```

### 条件判断

```bash
# 文件测试
[ -f file ]            # 文件存在
[ -d dir ]              # 目录存在
[ -r file ]             # 可读
[ -w file ]             # 可写
[ -x file ]             # 可执行
[ -z str ]              # 字符串为空
[ -n str ]              # 字符串非空

# 数值比较
[ $a -eq $b ]           # 等于
[ $a -ne $b ]           # 不等于
[ $a -gt $b ]           # 大于
[ $a -ge $b ]           # 大于等于
[ $a -lt $b ]           # 小于
[ $a -le $b ]           # 小于等于

# 逻辑
[ -f file ] && echo "存在"
[ -f file ] || echo "不存在"
```

### 循环

```bash
# for 循环
for i in {1..5}; do
    echo $i
done

for file in *.log; do
    echo $file
done

# while 循环
count=0
while [ $count -lt 5 ]; do
    echo $count
    count=$((count + 1))
done

# 读取文件
while read line; do
    echo $line
done < file.txt
```

### 函数

```bash
# 定义函数
function hello() {
    echo "Hello, $1"
}

hello "World"

# 返回值
function get_sum() {
    local a=$1
    local b=$2
    return $((a + b))
}

get_sum 3 4
echo $?  # 获取返回值
```

## 文本处理

### grep/sed/awk

```bash
# grep
grep "pattern" file
grep -r "pattern" dir/
grep -v "pattern" file        # 反选
grep -E "pattern1|pattern2"  # ERE
grep -c "pattern" file        # 计数
grep -n "pattern" file        # 显示行号

# sed
sed 's/old/new/g' file        # 替换
sed -i 's/old/new/g' file    # 直接修改
sed '/pattern/d' file         # 删除匹配行
sed -n '1,10p' file           # 打印1-10行

# awk
awk '{print $1}' file         # 打印第一列
awk -F: '{print $1}' file     # 指定分隔符
awk '$3 > 100' file           # 条件过滤
awk '{sum+=$1} END {print sum}' file  # 求和
```

### 其他工具

```bash
# sort/uniq
sort file | uniq              # 去重
sort file | uniq -c           # 计数
sort -k2 -t: file            # 按第二列排序
sort -rn file                # 逆序

# wc
wc -l file                   # 行数
wc -c file                   # 字节数
wc -w file                   # 词数

# cut
cut -d: -f1,3 file           # 选字段
cut -c1-10 file              # 选字符
```

## 常用模式

### 日志分析

```bash
# 统计错误日志
grep -i error access.log | wc -l

# 统计 IP 访问量
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10

# 统计接口响应时间
awk -F'"' '{print $NF}' access.log | awk '{sum+=$1; count++} END {print sum/count}'

# 找出慢请求 (>1s)
awk '$NF > 1' access.log
```

### 系统管理

```bash
# 批量操作
for host in host1 host2 host3; do
    ssh $host "systemctl restart nginx"
done

# 检查进程
ps aux | grep java | grep -v grep | awk '{print $2}' | xargs kill

# 清理日志
find /var/log -name "*.log" -mtime +7 -delete
```

### 脚本模板

```bash
#!/bin/bash

set -euo pipefail
IFS=$'\n\t'

LOGFILE="/var/log/script.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a $LOGFILE
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

# 检查 root
if [[ $EUID -ne 0 ]]; then
    error_exit "需要 root 权限"
fi

# 主逻辑
log "开始执行"

trap 'error_exit "脚本被中断"' INT TERM

log "执行完成"
```

## 调试技巧

```bash
# 调试模式
bash -x script.sh
set -x  # 在脚本中开启
set +x  # 关闭

# 语法检查
bash -n script.sh

# 详细模式
bash -v script.sh

# 常见问题
# 1. 变量为空导致错误
set -u

# 2. 管道错误
set -o pipefail

# 3. glob 无匹配
shopt -s nullglob
```

## 实战经验

1. **Nginx 日志统计**
   ```bash
   # 统计 5xx 错误
   awk '$9 >= 500' access.log | wc -l
   
   # 统计 QPS
   awk '{print $4}' access.log | cut -d: -f2 | sort | uniq -c | sort -k2
   ```

2. **批量日志清理**
   ```bash
   # 删除 7 天前的日志
   find /var/log -name "*.log" -mtime +7 -exec rm {} \;
   
   # 或
   find /var/log -name "*.log" -mtime +7 -delete
   ```

3. **服务健康检查**
   ```bash
   # 检查服务是否存活
   if ! curl -sf http://localhost/health > /dev/null; then
       systemctl restart service
   fi
   ```

## 延伸问题

* Bash vs sh 区别？
* here document 是什么？
* 如何捕获子进程输出？

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
