---
id: state-management
title: 状态管理
description: Terraform 状态管理
---

# Terraform 状态管理

## 标准答案

### Backend 配置

```hcl
terraform {
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt = true
  }
}
```

### State 锁定

```bash
# 启用状态锁定
dynamodb_table = "terraform-locks"
```

### 常用命令

```bash
terraform state list      # 列出资源
terraform state show     # 查看详情
terraform state mv       # 移动资源
terraform state rm       # 移除资源
terraform import         # 导入资源
```

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
