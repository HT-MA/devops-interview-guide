---
id: interview-advanced
title: Terraform 高级面试题
description: Terraform 高级面试题，涵盖自定义 Provider、Policy as Code、状态迁移、Terragrunt 等真实场景
---

# Terraform 高级面试题

## Q1: 如何开发一个自定义 Terraform Provider？Provider 的架构和工作原理是什么？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、华为

**答案要点**:
- Terraform Provider 本质上是 gRPC 服务器，与 Terraform CLI 通过 RPC 通信
- Provider 基于 Terraform Plugin Framework（0.15+）或 SDK v2 开发
- 核心接口包括：ConfigureProvider、ReadResource、CreateResource、UpdateResource、DeleteResource
- Provider 需要实现 CRUD + Read 操作，Read 是保证状态同步的关键
- 自定义 Provider 场景包括内部 API、SaaS 服务、遗留系统

**完整回答**:

理解 Terraform Provider 的本质是理解它和 Terraform CLI 之间的通信模型。从 Terraform 0.15 开始，Provider 进程独立于 Terraform CLI 运行，两者通过 gRPC 协议在本地通信。这意味着 Provider 可以用 Go 以外的语言（通过 gRPC 接口）实现，但官方和生态几乎都使用 Go。

**Provider 架构**：

```
┌──────────────┐     gRPC      ┌──────────────────┐
│  Terraform   │ ◄──────────► │  terraform-provider-xxx  │
│    CLI       │    (Unix      │  (独立进程)       │
│              │    Socket)    │                  │
└──────────────┘              └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │  目标 API/服务     │
                              │ (AWS API / 内部API)│
                              └──────────────────┘
```

**实现一个简化版 Provider 的结构**：

```go
package main

import (
    "context"
    "github.com/hashicorp/terraform-plugin-framework/provider"
    "github.com/hashicorp/terraform-plugin-framework/resource"
    "github.com/hashicorp/terraform-plugin-framework/datasource"
)

// Provider 定义
type InternalServiceProvider struct{}

func (p *InternalServiceProvider) Metadata(ctx context.Context, req provider.MetadataRequest, resp *provider.MetadataResponse) {
    resp.TypeName = "internal"
}

func (p *InternalServiceProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
    // 初始化 API 客户端：读取 provider 配置，创建 HTTP client，设置认证
}

func (p *InternalServiceProvider) Resources(ctx context.Context) []func() resource.Resource {
    return []func() resource.Resource{
        NewDeploymentResource,
        NewServiceAccountResource,
    }
}

func (p *InternalServiceProvider) DataSources(ctx context.Context) []func() datasource.DataSource {
    return []func() datasource.DataSource{
        NewEnvironmentDataSource,
    }
}
```

**Resource 的核心生命周期方法**：

```go
func (r *DeploymentResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
    // 1. 读取 plan 中的用户配置
    // 2. 调用内部 API 创建资源
    // 3. 将 API 返回的 ID 和状态写入 state
}

func (r *DeploymentResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
    // 关键方法！将实际基础设施状态同步回 Terraform state
    // Terraform refresh/plan 时调用此方法
}

func (r *DeploymentResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
    // 处理资源变更，需要与 Read 方法配合实现正确的状态同步
}

func (r *DeploymentResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
    // 清理资源，幂等性至关重要——资源已不存在时应返回成功而非错误
}
```

**开发自定义 Provider 的典型场景**：

1. **内部平台 API**——公司内部的 PaaS 平台、自建容器调度系统、内部 DNS 管理系统
2. **SaaS 服务集成**——Datadog、PagerDuty、GitHub 等虽然没有官方 Provider 的自定义封装
3. **遗留系统接口**——通过 SSH 调用旧系统的 CLI，或通过 JDBC 操作数据库（虽然不推荐）
4. **多云抽象层**——统一不同云厂商的资源模型

**面试加分项**：提到 Provider 的**状态一致性**是设计和测试的重中之重。许多自定义 Provider 的 bug 出在 `Read` 方法没有正确实现——它必须从 API 获取当前状态，而不是简单的返回之前存的值。另外，Provider 的错误处理需要区分"资源不存在"（返回 `resp.State.RemoveResource()`）和"API 调用失败"（返回诊断错误）。

**追问**:
- Q: Terraform Plugin Framework（v5+）和 SDK v2 在设计上有什么根本区别？迁移到 Framework 的收益是什么？
- Q: Provider 中的 `ValidateConfig`、`ModifyPlan`、`ValidateResourceConfig` 方法的执行顺序和作用是什么？
- Q: 如何为自定义 Provider 编写 acceptance test？测试中的 `TestStep` 的 `Check` 和 `ExpectError` 怎么用？

---

## Q2: Terraform 如何集成 Policy as Code？Sentinel 和 OPA 在 Terraform 工作流中的角色是什么？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、蚂蚁集团

**答案要点**:
- Sentinel 是 HashiCorp 商业产品（Terraform Cloud/Enterprise）内置的策略框架
- OPA（Open Policy Agent）是开源策略引擎，通过 `terraform plan` JSON 输出进行策略评估
- 策略可以限制资源类型、标签规范、安全合规、成本控制等
- 两种方案的核心流程都是：plan 输出 -> 策略评估 -> 通过/阻断

**完整回答**:

Policy as Code 是将基础设施合规策略代码化的实践。在 Terraform 工作流中，策略在 `plan` 执行后、`apply` 执行前进行拦截检查。

**Sentinel（Terraform Cloud/Enterprise）**：

Sentinel 是 HashiCorp 的专有策略语言，深度集成到 Terraform Cloud 中。策略定义在 Terraform Cloud 的工作区（workspace）中，在 `plan` 完成后自动执行。

```sentinel
# 强制所有 S3 Bucket 开启加密和版本控制
import "tfplan/v2"

# 检查所有 aws_s3_bucket 资源
s3_buckets = filter tfplan.resource_changes as _, rc {
    rc.mode is "managed" and
    rc.type is "aws_s3_bucket" and
    rc.change.actions is not ["delete"]
}

# 策略规则
mandatory_encryption = rule {
    all s3_buckets as _, bucket {
        bucket.change.after.server_side_encryption_configuration exists
    }
}

mandatory_versioning = rule {
    all s3_buckets as _, bucket {
        bucket.change.after.versioning exists and
        bucket.change.after.versioning.status is "Enabled"
    }
}

# 策略结果
main = rule {
    mandatory_encryption and mandatory_versioning
}
```

Sentinel 的三种策略执行级别：
- `advisory`：仅警告，不阻断
- `soft-mandatory`：阻断但可以被具有 override 权限的用户跳过
- `hard-mandatory`：强制阻断，不可跳过

**OPA（Open Policy Agent）**：

OPA 是一个通用的策略引擎，和 Terraform 的集成方式是在 CI/CD 流程中注入 OPA 评估步骤：

```bash
# CI 流水线中的典型流程
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary > tfplan.json

# OPA 评估
opa eval --data policy/terraform.rego --input tfplan.json "data.terraform.deny"
```

OPA 策略语言 Rego 的示例：
```rego
package terraform

# 禁止使用非加密的 EBS 卷
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_ebs_volume"
    not resource.change.after.encrypted
    
    msg = sprintf(
        "EBS volume %v must be encrypted",
        [resource.address]
    )
}

# 强制 EC2 实例使用指定 AMI 列表
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_instance"
    not startswith(resource.change.after.ami, "ami-approved-")
    
    msg = sprintf(
        "EC2 instance %v uses non-approved AMI: %v",
        [resource.address, resource.change.after.ami]
    )
}

# 禁止创建具有公共 IP 的 RDS 实例
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.publicly_accessible == true
    
    msg = sprintf(
        "RDS instance %v must not be publicly accessible",
        [resource.address]
    )
}
```

**两种方案的生产比较**：

| 维度 | Sentinel | OPA |
|------|----------|-----|
| 集成深度 | 原生，Terraform Cloud 工作流内 | 需 CI 脚本，额外步骤 |
| 策略语言 | Sentinel 专用语言 | Rego |
| 开源 | 否（Terraform Enterprise 功能） | 是（CNCF 毕业项目） |
| 适用范围 | 仅 Terraform | 全栈（K8s、Kafka、HTTP API） |
| 细粒度阻断 | 支持（hard/soft/advisory） | 需自行实现分级 |

**生产最佳实践**：

真正的生产落地经验是：不要试图用策略语言覆盖所有检查。策略应该聚焦在"安全底线"和"成本控制"两类规则上。对于编码规范类的规则（比如 naming convention），使用 `terraform fmt` 和 pre-commit hook 更合适。对于复杂依赖关系检查（比如检查 VPC 和 Subnet 的 AZ 一致性），用 `terraform plan` 的输出反倒不够精确——此时应该用 `terraform_validate` 结合自定义 Go 验证工具来完成。

**追问**:
- Q: OPA 和 Sentinel 在性能上有什么差异？当 plan JSON 文件达到 100MB+ 时，策略评估时间会怎样？
- Q: 如何将 OPA 集成到 Atlantis 的 plan/apply 工作流中？有现成的实践方案吗？
- Q: 如何处理"需要跨资源检查"的策略？比如检查 EC2 实例是否在其所属 Subnet 的 AZ 中？

---

## Q3: `terraform plan` 输出很复杂或结果出人意料时，你是如何调试和排查的？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、腾讯、美团

**答案要点**:
- Plan 输出的意外变更通常源自状态漂移、配置变更或 Provider 版本变化
- 使用 `terraform show` 和 `terraform plan -json` 获取结构化输出
- 通过 `terraform state list` 和 `state show` 对比实际状态和配置
- 灰度 `apply`，拆解复杂变更，使用 `-target` 逐步验证
- Provider Upgrade 或 State Migration 是 plan 异常的常见原因

**完整回答**:

在生产环境中，当你执行 `terraform plan` 看到"2 to add, 15 to change, 0 to destroy"时，其中的"15 to change"需要逐条确认。以下是我总结的系统化调试方法。

**第一步：定位变更来源**

Plan 中资源的"变动"有四个来源：

1. **配置代码变更**——你或团队成员修改了 `.tf` 文件（最直观，code review 可覆盖）
2. **基础设施漂移**——有人在 AWS 控制台手动修改了资源，或运维脚本改了配置
3. **Provider 版本升级**——provider 的新版本可能改变了某些默认值或属性行为
4. **Terraform 版本升级**——不同版本的 Terraform 对状态文件的解析可能有细微差异

```bash
# 查看具体的资源变更详情
terraform plan -no-color -out=tfplan.binary > plan_output.txt

# 获取 JSON 格式的 plan 输出，便于脚本分析
terraform show -json tfplan.binary | jq '.resource_changes[] | select(.change.actions | contains(["update"]))'

# 查看特定资源的属性变更
terraform show -json tfplan.binary | jq '.resource_changes[] | select(.address == "aws_instance.web") | .change'
```

**第二步：比对 State 和实际基础设施**

```bash
# 查看当前状态中该资源的全部属性
terraform state show aws_instance.web

# 刷新状态但不 apply
terraform apply -refresh-only

# 用 -json 输出状态做精确对比
terraform state pull > current_state.json
```

常见的"意外变更"类型：
- `tags` 字段中出现额外的 AWS 默认标签（比如 `aws:CreatedBy`）
- `lifecycle` 规则导致的时间戳字段每次 plan 都标记变更（如 `ignore_changes` 遗漏）
- Provider 升级后，某个字段的默认值从 `null` 变成了 `""`
- `for_each` 的 key 排序变化导致资源被重新编排

**第三步：增量式 apply**

如果一个大规模的 plan 让你没有信心：

```bash
# 先 apply 部分资源验证
terraform apply -target=module.vpc -auto-approve

# 确认 VPC 变更正确后，再 apply 完整配置
terraform apply -auto-approve
```

`-target` 的用法有技巧：如果目标资源依赖其他资源，依赖链条上的资源也会被包含。你不需要手动列出所有依赖。

**第四步：使用 plan 分析工具**

- `terraform plan -out=tfplan.binary` + `terraform show tfplan.binary` 是标准做法
- `terraform-compliance` 可以用 BDD 风格验证 plan 输出是否符合预期
- `inframap` 可以将 `.tf` 配置生成可视化依赖图

**生产环境中 Plan 异常的典型案例**：

```
案例：安全组规则被标记为"重新创建"
原因：aws_security_group_rule 的 source_security_group_id 从"sg-xxx"变为
"sg-yyy"。问题是一个新部署的服务替换了旧的 EC2 实例，旧实例关联的安全组
被删除重建，导致引用该安全组的其他安全组规则被标记为变更。
排查：terraform show 发现 source_security_group_id 确实变了，旧组已被删除，
这是预期行为而非异常。
```

**追问**:
- Q: `terraform plan` 中可能出现 `forces replacement` 和 `update in-place` 两种变更类型，什么情况下一个字段的变更会导致资源被替换？
- Q: 如何处理 plan 输出中大量的属性变更都是"排序影响"而非实际变动？
- Q: `terraform plan -refresh=false` 是什么作用？在什么场景下使用？

---

## Q4: 如何将 Terraform 状态从本地存储迁移到远程 S3 后端？迁移过程中需要注意哪些问题？

**难度**: ⚫⚫⚪ 中级 | **面试公司**: 腾讯、快手、字节跳动

**答案要点**:
- 使用 `terraform init -migrate-state` 自动将本地迁移到远程后端
- 迁移过程本质上是状态文件的复制和 backend 配置切换
- 迁移前需要保证 S3 bucket 和 DynamoDB 表已创建
- 团队协作中需要协调迁移窗口，避免多人操作

**完整回答**:

很多团队在 Terraform 项目起步时使用本地状态（`local` backend），随着团队规模扩大，必须迁移到远程后端以实现状态共享和锁定。

**标准迁移流程**：

步骤一：预先创建远程状态存储基础设施

```hcl
# 独立的一个 Terraform 项目，或者手动创建
resource "aws_s3_bucket" "terraform_state" {
  bucket = "company-terraform-state-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state_encrypt" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state_block_public" {
  bucket = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-state-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
```

步骤二：修改 backend 配置

```hcl
# 原配置
# terraform {
#   backend "local" {}
# }

# 新配置
terraform {
  backend "s3" {
    bucket         = "company-terraform-state-123456789"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-locks"
    encrypt        = true
  }
}
```

步骤三：执行状态迁移

```bash
# Terraform 会提示"是否要复制现有状态到新 backend？"，回答 yes
terraform init -migrate-state
```

`-migrate-state` 的工作流程：
1. Terraform 读取当前的 `local` backend 状态文件到内存
2. 初始化新的 S3 backend 配置
3. 将状态文件写入 S3
4. 本地 `.terraform/terraform.tfstate` 文件变成指向远程后端的符号链接

**验证迁移结果**：

```bash
# 确认后端配置已切换
terraform state list

# 直接从 S3 获取状态文件确认内容一致
aws s3 cp s3://company-terraform-state-123456789/production/terraform.tfstate -

# 测试状态锁是否工作
# 另开一个终端执行 terraform plan，应该能正常读取状态
```

**迁移中的风险点**：

1. **绝对路径引用**：本地 backend 时期，如果配置中有使用 `path.module` 或 `abspath()` 引用本地文件，迁移后需要确认路径在 CI/CD 环境中是否仍然有效

2. **敏感数据暴露**：本地状态文件中可能包含明文密码或密钥。迁移后，状态文件存储在 S3，需要确保 S3 的访问策略正确配置

3. **迁移窗口协调**：通知所有团队成员在迁移期间不要执行 `terraform` 操作。迁移后每个人都运行 `terraform init -reconfigure`（注意：`-reconfigure` 不会复制状态，它会直接使用远程后端）

```bash
# 团队成员切换到新的后端
terraform init -reconfigure
```

4. **状态文件版本化**：在迁移前，建议备份本地状态文件：
```bash
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d)
```

5. **遗留的状态锁**：如果迁移前本地缓存了锁信息，可能会在新后端出现不一致。

**追问**:
- Q: 如果从 S3 backend 迁移回 local backend，`-migrate-state` 是否同样有效？
- Q: 如何同时使用多个 backend 来管理不同环境的状态文件？比如 dev 用 local，prod 用 S3？
- Q: 迁移过程中出现了 `terraform init` 报错"Error loading state: BucketRegionError"，排查思路是什么？

---

## Q5: 如何使用 Terraform 将已有的云资源纳入管理（import）？大规模导入时的策略是什么？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里巴巴、腾讯

**答案要点**:
- `terraform import` 将现有资源关联到 state 中，不生成配置代码
- 大规模导入推荐使用 `import` 块（Terraform 1.5+）或 `generated` 配置
- 导入后需要执行 `plan` 确认状态与配置一致
- 最佳实践是分批次导入，每次导入后验证
- 对于大量资源，编写脚本自动化导入过程

**完整回答**:

"把已经跑在云上的基础设施纳入 Terraform 管理"是很多团队开始 IaC 之旅的第一个挑战。问题的本质是：Terraform 需要"配置 + 状态"两个要素才能工作，而现有基础设施只有状态没有配置。

**基础导入方式（v1.5 之前）**：

```bash
# 1. 先在 .tf 文件中定义资源骨架
# resource "aws_s3_bucket" "data" {
#   bucket = "existing-bucket-name"
# }

# 2. 执行导入
terraform import aws_s3_bucket.data existing-bucket-name

# 3. 然后执行 plan，查看是否有属性差异
terraform plan
```

这种方式的痛点是：你必须自己写出至少包含必要参数的资源块，然后通过 `plan` 对比状态，反复调整配置代码直到无 diff。对于复杂资源（如 RDS、ECS 服务），属性多达几十个，手工编写极其耗时且易错。

**Terraform 1.5+ 的 `import` 块（推荐）**：

Terraform 1.5 引入了声明式的 `import` 块，可以批量导入并在导入的同时生成配置代码：

```hcl
# import.tf
import {
  to = aws_s3_bucket.data
  id = "existing-bucket-name"
}

import {
  to = aws_s3_bucket.app_data
  id = "app-data-bucket-2024"
}

import {
  to = module.vpc.aws_vpc.main
  id = "vpc-0a1b2c3d4e5f"
}
```

```bash
# 生成配置代码
terraform plan -generate-config-out=generated_resources.tf
```

Terraform 会自动生成完整的资源配置代码到 `generated_resources.tf` 中，包含了当前云资源的所有属性。然后你需要：
1. 把代码从生成的 `generated_resources.tf` 整理到合适的模块目录
2. 剥离不需要显式设置的属性（使用 `lifecycle.ignore_changes` 忽略自动生成的属性）
3. 执行 `terraform plan` 验证无 diff

**大规模导入的策略和自动化**：

当需要导入几百个资源时，手动写 `import` 块不可行。实战做法是编写脚本自动化：

```python
#!/usr/bin/env python3
# import_generator.py - 批量生成 Terraform import 配置
import boto3
import yaml

ec2 = boto3.client('ec2')
instances = ec2.describe_instances()

imports = []
for reservation in instances['Reservations']:
    for instance in reservation['Instances']:
        name = "unknown"
        for tag in instance.get('Tags', []):
            if tag['Key'] == 'Name':
                name = tag['Value']
        safe_name = name.lower().replace('-', '_').replace(' ', '_')
        imports.append({
            "to": f"aws_instance.{safe_name}",
            "id": instance['InstanceId']
        })

with open('imports.tf', 'w') as f:
    for imp in imports:
        f.write(f'import {{\n  to = {imp["to"]}\n  id = "{imp["id"]}"\n}}\n\n')
```

**分批次导入策略**：

```
批次 1：网络层（VPC、Subnet、RTB、IGW、NAT）
  → 验证：所有网络资源 plan 无 diff
批次 2：安全层（SG、NACL、IAM Role、IAM Policy）
  → 验证：安全资源 plan 无 diff
批次 3：数据层（RDS、ElastiCache、S3 Bucket）
  → 验证：数据资源 plan 无 diff
批次 4：计算层（EC2、ECS、ALB、Auto Scaling）
  → 验证：全量 plan 无 diff
```

每批次导入后，提交代码并让至少一个人 review，确保配置准确性。

**导入后的注意事项**：

1. **不要直接修改已导入的资源**：刚导入的资源状态是脆弱的。确认 plan 无 diff 后，再逐步对配置进行重构（提取变量、拆分模块等）
2. **`lifecycle` 规则可能被误设**：生成的配置中可能包含只读属性，需要明确哪些是 `computed` 属性，哪些可以修改
3. **终态一致性**：导入完成后运行 `terraform plan -refresh-only`，确保状态文件和实际基础设施完全一致

**追问**:
- Q: 使用 `import` 块导入资源后，生成的 `generated_resources.tf` 中的 `id` 字段应该保留还是删除？
- Q: Terraform `import` 不支持的资源类型有哪些？（比如 AWS 管理的资源？）
- Q: 如何处理跨账号的批量导入？AWS Organizations 多个账号下的资源如何批量纳入管理？

---

## Q6: Terragrunt 如何实现 DRY（Don't Repeat Yourself）Terraform 配置？实际落地中需要注意什么？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、腾讯、阿里巴巴

**答案要点**:
- Terragrunt 通过依赖关系管理、远程状态自动配置、变量注入实现 DRY
- `include` 块复用根配置，避免每层重复写 backend/provider 配置
- `dependency` 块自动管理模块间数据传递，替代 `terraform_remote_state`
- `inputs` 将变量从 module 声明中抽离，实现配置与逻辑分离
- `generate` 块可以自动生成 provider 配置

**完整回答**:

Terragrunt 解决的核心痛点是：在纯 Terraform 中，每个目录都需要重复声明 backend 配置、provider 配置和数据源读取。在管理几十个模块的大规模基础设施中，这种重复会导致维护噩梦。

**DRY 的核心机制一：根配置复用（include）**

```hcl
# _env/terragrunt.hcl（根配置模板）
remote_state {
  backend = "s3"
  config = {
    bucket         = "company-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Environment = "${local.environment}"
      ManagedBy   = "terraform"
    }
  }
}
EOF
}
```

子目录中的配置：
```hcl
# prod/vpc/terragrunt.hcl
include "root" {
  path = find_in_parent_folders("_env/terragrunt.hcl")
}

terraform {
  source = "../../modules//vpc"
}

inputs = {
  vpc_cidr             = "10.0.0.0/16"
  environment          = "production"
  enable_nat_gateway   = true
}
```

`find_in_parent_folders` 自动向上查找根配置。这意味着每个子模块只需要 5-10 行配置就能声明完整的模块引用和输入变量。

**DRY 的核心机制二：依赖管理（dependency）**

Terragrunt 的 `dependency` 块解决了跨模块数据读取的 DRY 问题：

```hcl
# prod/ecs/terragrunt.hcl
dependency "vpc" {
  config_path = "../vpc"
  
  # 可选的 mock 配置，使 plan 时即使依赖模块未 apply 也能继续
  mock_outputs = {
    vpc_id            = "vpc-mock"
    private_subnets   = ["subnet-mock1", "subnet-mock2"]
    public_subnets    = []
  }
}

dependency "rds" {
  config_path = "../rds"
}

inputs = {
  vpc_id           = dependency.vpc.outputs.vpc_id
  private_subnets  = dependency.vpc.outputs.private_subnets
  database_url     = dependency.rds.outputs.endpoint
}
```

`mock_outputs` 是 Terragrunt 的杀手锏功能。在开发新模块时，被依赖的模块可能还未创建，`mock_outputs` 允许你在 mock 值基础上做 `plan`，等到实际 `apply` 时才读取真实输出。

**DRY 的核心机制三：变量管理（inputs + locals）**

```hcl
# prod/terragrunt.hcl（环境级公共变量）
locals {
  environment = "production"
  aws_region  = "us-east-1"
  common_tags = {
    Environment = local.environment
    CostCenter  = "Platform"
  }
}

inputs = merge(
  local.common_tags,
  {
    environment = local.environment
    aws_region  = local.aws_region
  }
)
```

**落地注意点**：

1. **Terragrunt 版本和 Terraform 版本必须兼容**。Terragrunt 不总是最新版兼容所有 Terraform 版本，查看兼容矩阵是升级前的必要步骤

2. **目录结构深度的性能影响**：Terragrunt 通过 `find_in_parent_folders` 逐级向上搜索，目录层级过深（超过 5-6 层）时，`plan` 初始化时间会明显增加。建议扁平化层级

3. **CI/CD 集成中的路径问题**：Terragrunt 的 `run-all` 命令会并行执行多个模块的 `plan`/`apply`，这在 CI/CD 中需要做好输出日志的分组管理

4. **状态文件的 key 管理**：`path_relative_to_include()` 生成的 key 路径必须确保唯一性，重命名目录会导致状态文件路径变化

5. **学习曲线**：团队成员需要同时理解 Terraform 和 Terragrunt 两层语义，排错时需要分清问题是 Terraform 层还是 Terragrunt 层

**追问**:
- Q: Terragrunt 的 `skip` 参数是什么作用？在什么场景下使用？
- Q: Terragrunt `run-all` 命令的执行顺序是如何确定的？它如何处理模块间的依赖顺序？
- Q: 如果团队决定从 Terragrunt 迁移回纯 Terraform，你会如何设计迁移方案？移除了 Terragrunt 后哪些能力需要手动替代？

---

## Q7: 如何用 Terraform 管理多个环境（开发、测试、预发布、生产）？不同环境管理策略的优缺点是什么？

**难度**: ⚫⚫⚫ 高级 | **面试公司**: 字节跳动、阿里、腾讯、美团

**答案要点**:
- 多环境管理的核心选择：目录结构 vs 分支策略 vs workspaces
- 目录结构（directory layout）是生产环境最推荐的方案
- GitFlow 式的分支策略在 Terraform 中不是好方案
- 每个环境应该有其独立的 backend 状态文件和访问控制
- 环境一致性通过模块版本控制和 CI/CD 管道保证

**完整回答**:

多环境管理是 Terraform 在生产环境中落地最复杂的进阶问题之一。面试官关注的是：你是否经历过多个团队在多个环境上并行工作、如何保证生产环境安全、以及如何处理环境间的差异。

**方案一：目录结构（推荐用于生产）**

```
terraform/
├── modules/                    # 共享模块
│   ├── networking/
│   ├── compute/
│   └── database/
├── environments/
│   ├── _global/                # 跨环境资源（如 Route53 Zone、IAM）
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── terraform.tfvars    # dev 专属变量值
│   │   └── backend.hcl
│   ├── staging/
│   │   ├── main.tf             # staging 可引用不同版本的模块
│   │   └── ...
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── terraform.tfvars
│       └── backend.hcl          # prod 的 bucket/key 与 dev 完全隔离
```

**优点**：
- 每个环境完全隔离——`dev` 目录下的配置和 `prod` 有物理上的文件隔离
- 每个环境可以使用不同的模块版本（dev 用 main 分支，prod 用稳定版本）
- IAM 权限可以精确控制谁可以操作哪个目录
- `rm -rf environments/dev` 可以直接销毁一个环境而不会影响其他

**缺点**：
- 环境间代码冗余——需要维护多份 `main.tf`
- 环境之间如果不一致，可能 dev 测试了但 prod 部署时仍出问题

**方案二：分支策略（常见于 GitOps 场景）**

```bash
# ❌ 不推荐的做法
# main 分支 → 开发环境
# staging 分支 → 测试环境
# production 分支 → 生产环境
```

这个方案在 Terraform 中问题很多。Terraform 的模块源码引用是基于 Git ref 的，如果你给 dev 和 prod 使用不同的 Git 分支，两个分支上的 Terraform 代码可能越走越远，最终 dev 和 prod 变成完全不同的基础设施。另外，从 dev 合并到 staging 再合并到 prod 的过程中，冲突处理和代码 review 变得非常复杂。

**唯一适合分支策略的场景**：Feature 环境 —— 从特定 feature 分支创建临时环境做测试，feature 合入后销毁。

**方案三：Terraform Workspace + 同一套代码**

```hcl
terraform {
  backend "s3" {
    bucket = "company-terraform-state"
    # 注意：没有指定 key
    # Terraform 自动在 env:/ 下创建 workspace 对应的状态文件
  }
}
```

前面已经在核心面试题中分析过 Workspace 的局限。补充一点：Workspace 不能做环境间的权限隔离——同一个 backend 下的所有 workspace 对能访问该 backend 的用户都是可见的。

**生产环境的最佳实践组合**：

```
基础设施代码仓库结构：
infra/
├── modules/                  # 通用模块
│   └── service/
├── environments/
│   ├── dev/
│   ├── staging/
│   ├── prod/
│   └── _global/
├── pipelines/
│   ├── dev-apply.yml          # dev 自动 apply
│   ├── staging-apply.yml      # staging 自动 apply（有 gate）
│   └── prod-apply.yml         # prod 手动触发 + 多层审批
└── versions.tf               # 全局 terraform/provider 版本
```

核心原则：
1. **模块作为唯一入口**——环境的配置只声明变量值，不写资源逻辑。所有资源逻辑在模块中
2. **变量文件反映环境差异**——dev 和 prod 的 `terraform.tfvars` 中定义不同值
3. **环境升级路径**——`dev → staging → prod` 的变量值升级需要有流程保证，自动化工具如 Terragrunt 或自定义脚本
4. **生产环境特殊保护**——prod 的 `apply` 必须经过 code review + plan review + 手动审批

针对环境差异，用变量和条件逻辑处理：
```hcl
# modules/service/main.tf
resource "aws_instance" "app" {
  instance_type = var.instance_type
  # 生产环境开启详细监控，其他环境关闭
  monitoring = var.environment == "production" ? true : false
}

# dev/terraform.tfvars
environment  = "development"
instance_type = "t3.micro"
min_size     = 1
max_size     = 2

# prod/terraform.tfvars
environment  = "production"
instance_type = "t3.large"
min_size     = 3
max_size     = 20
```

**追问**:
- Q: Feature 环境（短生命周期，基于分支动态创建）的 Terraform 架构如何设计？环境清理如何保证？
- Q: Terraform 状态文件中的敏感信息（如数据库密码）在不同环境间如何隔离？
- Q: 如何确保 staging 环境和 production 环境的模块版本一致性？你在实践中用哪些工具保证？
