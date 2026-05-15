---
id: jenkins
title: Jenkins
description: Jenkins 流水线配置
---

# Jenkins 流水线

## 标准答案

### Jenkinsfile 示例

```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'registry.example.com'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build') {
            steps {
                sh 'docker build -t ${DOCKER_REGISTRY}/app:${BUILD_NUMBER} .'
            }
        }
        
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh 'kubectl apply -f k8s/'
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            echo 'Build successful!'
        }
        failure {
            echo 'Build failed!'
        }
    }
}
```

### Declarative vs Scripted

| 类型 | 特点 |
|------|------|
| Declarative | 简洁、结构化、易学 |
| Scripted | 灵活、强大、复杂 |

## 常用插件

* Blue Ocean - 可视化流水线
* Pipeline - 流水线支持
* Git - Git 集成
* Kubernetes - K8s 部署
* Docker - Docker 支持

## 难度标签

<span className="difficulty-badge difficulty-intermediate">中级</span>
