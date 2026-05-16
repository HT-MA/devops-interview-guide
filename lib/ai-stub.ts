export async function askAI(question: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 800))
  return `这是关于 **"${question}"** 的 AI 回答。\n\nAI 接口已预留，接入 OpenAI / DeepSeek / Claude / Gemini API Key 后即可获得真实回答。当前为 stub 模式。`
}

export async function explainLikeBeginner(topic: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 800))
  return `💡 **用简单的方式理解 ${topic}**\n\n想象一下，你有一个智能的调度系统，它会自动帮你管理容器的运行位置、健康状态和网络通信...`
}

export async function generateInterviewAnswer(topic: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1000))
  return `🎯 **面试官问 "${topic}" 时，建议从以下三个层面回答：**\n\n1. **核心概念** — 先讲清楚原理和设计意图\n2. **实际应用** — 结合你做过项目给出具体例子\n3. **生产经验** — 分享你踩过的坑和优化思路`
}

export async function troubleshoot(
  issue: string
): Promise<{ path: string[]; commands: string[]; causes: string[] }> {
  await new Promise((r) => setTimeout(r, 1000))
  return {
    path: [
      "1. 检查 Pod 状态 — kubectl describe pod",
      "2. 查看事件日志 — kubectl get events",
      "3. 确认资源限制 — CPU / Memory requests & limits",
      "4. 检查镜像拉取 — ImagePullBackOff 排查",
    ],
    commands: [
      "kubectl describe pod <pod-name>",
      "kubectl get events --sort-by=.metadata.creationTimestamp",
      "kubectl logs <pod-name> --previous",
      "kubectl get pod -o yaml <pod-name>",
    ],
    causes: [
      "镜像不存在或 tag 错误",
      "资源不足 (CPU/Memory)",
      "配置错误 (ConfigMap/Secret)",
      "网络问题 (CNI 插件)",
    ],
  }
}

export function getRelatedCommands(topic: string): { cmd: string; desc: string }[] {
  const commands: Record<string, { cmd: string; desc: string }[]> = {
    kubernetes: [
      { cmd: "kubectl get nodes", desc: "列出所有节点" },
      { cmd: "kubectl describe pod <name>", desc: "查看 Pod 详细信息" },
      { cmd: "kubectl logs <pod> -f", desc: "实时查看日志" },
      { cmd: "kubectl get events --watch", desc: "监听集群事件" },
    ],
    docker: [
      { cmd: "docker ps -a", desc: "列出所有容器" },
      { cmd: "docker build -t app .", desc: "构建镜像" },
      { cmd: "docker logs <container>", desc: "查看容器日志" },
      { cmd: "docker exec -it <id> sh", desc: "进入容器" },
    ],
    linux: [
      { cmd: "top -o %CPU", desc: "按 CPU 排序进程" },
      { cmd: "lsof -i :8080", desc: "查看端口占用" },
      { cmd: "journalctl -u service", desc: "查看服务日志" },
      { cmd: "strace -p <pid>", desc: "跟踪系统调用" },
    ],
  }

  const key = Object.keys(commands).find((k) => topic.includes(k))
  return key ? commands[key] : commands.kubernetes
}
