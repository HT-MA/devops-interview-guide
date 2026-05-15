---
id: github-actions
title: GitHub Actions
description: GitHub Actions 流水线配置
---

# GitHub Actions

## 标准答案

### 基本结构

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  IMAGE_TAG: ${{ github.sha }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ secrets.REGISTRY }}
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_TOKEN }}
      
      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ${{ secrets.REGISTRY }}/app:${{ env.IMAGE_TAG }}

  test:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm ci && npm test

  deploy:
    runs-on: ubuntu-latest
    needs: [build, test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to K8s
        uses: azure/k8s-deploy@v4
        with:
          namespace: production
          manifests: |
            k8s/deployment.yaml
            k8s/service.yaml
          images: |
            ${{ secrets.REGISTRY }}/app:${{ env.IMAGE_TAG }}
```

### 常用 Actions

| Action | 用途 |
|--------|------|
| actions/checkout | 拉取代码 |
| docker/build-push-action | Docker 构建推送 |
| azure/k8s-deploy | K8s 部署 |
| kubernetes/kubernetes | K8s 操作 |
| snyk/actions | 安全扫描 |

## 难度标签

<span className="difficulty-badge difficulty-beginner">初级</span>
<span className="difficulty-badge difficulty-intermediate">中级</span>
