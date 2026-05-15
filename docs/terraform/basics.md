---
id: basics
title: Terraform 基础
description: Terraform 基础语法与命令
---

# Terraform 基础

## 面试官想考什么

* IaC 理念
* 基础语法
* 资源管理
* 状态管理

## 标准答案

### 基础语法

```hcl
# 变量定义
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# 资源定义
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  
  tags = {
    Name = "web-server"
  }
}

# 输出
output "instance_ip" {
  value = aws_instance.web.public_ip
}
```

### 常用命令

```bash
terraform init      # 初始化
terraform plan      # 预览
terraform apply    # 执行
terraform destroy   # 销毁
terraform validate  # 验证
terraform fmt       # 格式化
terraform show      # 查看状态
```

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
