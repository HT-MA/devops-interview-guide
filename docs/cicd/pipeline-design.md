---
id: pipeline-design
title: 流水线设计
description: CI/CD 流水线设计与最佳实践
---

# CI/CD 流水线设计

## 面试官想考什么

* 流水线架构
* 阶段划分
* 自动化流程
* 质量门禁

## 标准答案

### 流水线阶段

```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                            │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Build   │─▶│  Test    │─▶│ Security │─▶│  Deploy  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │             │             │              │           │
│   编译构建      单元测试      安全扫描      部署环境      │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Staging │─▶│  UAT     │─▶│  Prod    │─▶│  Monitor │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│   预发布      用户验收      生产发布      监控验证         │
└─────────────────────────────────────────────────────────────┘
```

### 黄金流水线

```yaml
stages:
  - build
  - test
  - security
  - deploy

variables:
  DOCKER_REGISTRY: registry.example.com
  IMAGE_TAG: ${CI_COMMIT_SHORT_SHA}

build:
  stage: build
  script:
    - docker build -t $DOCKER_REGISTRY/app:$IMAGE_TAG .
    - docker push $DOCKER_REGISTRY/app:$IMAGE_TAG
  only:
    - main
    - develop

test:
  stage: test
  script:
    - npm ci
    - npm run lint
    - npm run test:unit
    - npm run test:integration
  coverage: '/Coverage: \d+\.\d+%/'

security:
  stage: security
  script:
    - trivy image $DOCKER_REGISTRY/app:$IMAGE_TAG
    - npm audit
  allow_failure: false

deploy-staging:
  stage: deploy
  script:
    - kubectl apply -f k8s/ -n staging
  only:
    - develop
  environment:
    name: staging

deploy-production:
  stage: deploy
  script:
    - kubectl apply -f k8s/ -n production
  only:
    - main
  when: manual
  environment:
    name: production
```

## 最佳实践

### 快速反馈

* 优先运行最快、最重要的测试
* 使用并行化加速
* 失败时快速终止

```yaml
fast-tests:
  stage: test
  script: npm run test:unit
  parallel: 3

slow-tests:
  stage: test
  script: npm run test:e2e
  when: manual
```

### 缓存策略

```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .npm/
    - .cache/

build:
  stage: build
  script:
    - npm ci --cache .npm --prefer-offline
```

### 制品管理

```yaml
build:
  stage: build
  artifacts:
    paths:
      - build/
    expire_in: 1 week
    when: always
```

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 流水线太慢 | 并行执行、缓存、优化测试 |
| 部署风险高 | 蓝绿/金丝雀、分批部署 |
| 配置不一致 | GitOps、环境即代码 |
| 回滚困难 | 版本化制品、快速回滚脚本 |

## 延伸问题

* GitOps 是什么？
* 如何实现零停机部署？

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
<span className="difficulty-badge difficulty-advanced">高级</span>
