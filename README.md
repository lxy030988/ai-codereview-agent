# AI Code Review Agent

基于 Mastra 框架和 DeepSeek 模型的 AI 代码审查工具

## ✨ 特性

- 🤖 **AI 智能审查** - 使用 DeepSeek Chat 模型进行智能代码分析
- 🔍 **Git 集成** - 分析任意两个 commit 之间的代码变更
- 🎯 **智能过滤** - 自动跳过 lock 文件、构建产物和压缩代码
- 📊 **全面分析** - 检查安全性、性能、代码质量和潜在 Bug
- � **可操作反馈** - 提供具体建议和代码示例
- 🔐 **私有仓库支持** - 完美支持 GitHub 私有仓库（GitHub API 版本）
- � **CI/CD 友好** - 专为 GitHub Actions 优化

## 📦 安装

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.development` 并添加 API 密钥：

```bash
cp .env.example .env.development
```

编辑 `.env.development`：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
GITHUB_TOKEN=ghp_your-github-token  # 可选，用于 GitHub PR 集成
JWT_AUTH_SECRET=your-jwt-secret     # 必需，用于 Mastra API 的 JWT 鉴权
# 可选：如果已有签发好的 JWT，可直接填写
MASTRA_JWT_TOKEN=your-issued-jwt
```

JWT 鉴权说明：

- Mastra 服务器现在要求携带 Bearer JWT 访问 `/api/*`
- CLI 会优先使用 `MASTRA_JWT_TOKEN`；如果未提供，将使用 `JWT_AUTH_SECRET` 自动签发一个 1 小时有效的临时 token
- 如果两者都缺失，CLI 会给出错误提示

本地快速生成一个开发用 JWT（便于和其他客户端共享）：

```bash
JWT_AUTH_SECRET=change-me node -e "console.log(require('jsonwebtoken').sign({ sub: 'ai-codereview-cli', role: 'cli' }, process.env.JWT_AUTH_SECRET, { expiresIn: '1h', issuer: 'ai-codereview-agent' }))"
```

### 3. 启动 Mastra 服务器

```bash
pnpm run dev
```

服务器将在 `http://localhost:4111` 启动

## 🚀 使用方式

### 方式一：本地 Git 版本（`cli.js`）

适用于本地开发、已克隆的仓库

```bash
# 基本用法
pnpm start <repo-path> <from-commit> <to-commit>

# 示例：审查最后一次提交
pnpm start . HEAD~1 HEAD

# 示例：审查特定 commit 范围
pnpm start /path/to/repo abc123 def456

# 带 GitHub PR 评论
pnpm start . abc123 def456 owner repo 123
```

**优点：**

- ✅ 简单直接
- ✅ 不需要 GitHub API
- ✅ 适合本地开发

**缺点：**

- ❌ 需要本地克隆仓库
- ❌ 私有仓库需要配置凭证

---

### 方式二：GitHub API 版本（`cli-github.js`）⭐ 推荐

适用于 CI/CD、私有仓库、Fork PR

```bash
# 基本用法
pnpm start:github <owner> <repo> <pr-number>

# 示例
pnpm start:github lxy030988 ai-codereview-agent 123
```

**优点：**

- ✅ 直接通过 API 获取 PR diff
- ✅ 完美支持私有仓库
- ✅ 支持 Fork PR
- ✅ 不需要克隆仓库
- ✅ 更适合 CI/CD

**缺点：**

- ❌ 需要 GitHub Token
- ❌ 仅支持 GitHub

📖 详细使用说明请查看 [CLI_GITHUB_USAGE.md](./CLI_GITHUB_USAGE.md)

---

## 🏗️ Mastra 架构说明

### 核心组件

本项目基于 Mastra 框架，包含三大核心组件：

```
┌─────────────────────────────────────────┐
│           Mastra 框架                    │
│  ┌────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Agent  │  │ Workflow │  │  Tool   │ │
│  │(智能体)│  │ (流程)   │  │ (工具)  │ │
│  └────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

#### 1. Agent（智能体）

**位置：** `src/mastra/agents/code-review-agent.ts`

**作用：** AI 驱动的代码审查专家，负责理解代码变更并提供审查意见

**特点：**

- 🤖 AI 自主决策是否调用工具
- 🧠 智能理解用户意图
- 🔄 可以进行多轮对话

**调用方式：**

```bash
# HTTP API
POST http://localhost:4111/api/agents/codeReviewAgent/generate
Body: {
  "messages": [
    { "role": "user", "content": "请审查以下代码..." }
  ]
}

# CLI 调用（内部使用 Agent API）
pnpm start . HEAD~1 HEAD
```

**何时使用 Tool？**

Agent 会根据消息内容**自主决定**是否调用 `gitAnalysisTool`：

```javascript
// 场景 A：AI 会调用 Tool
messages: [
  {
    role: 'user',
    content: '请审查仓库 /path/to/repo 从 abc123 到 def456 的变更'
  }
]
// → AI 识别到需要 Git 数据，调用 gitAnalysisTool

// 场景 B：AI 不会调用 Tool
messages: [
  {
    role: 'user',
    content: `请审查以下代码：\n\`\`\`diff\n+ function foo() {}\n\`\`\``
  }
]
// → diff 已提供，AI 直接分析
```

**当前 CLI 实现：**

目前的 `cli.js` 和 `cli-github.js` 都是**先获取 diff，再调用 Agent**，所以 Agent 通常不会调用 Tool。

---

#### 2. Tool（工具）

**位置：** `src/mastra/tools/git-analysis-tool.ts`

**作用：** 提供 Git 分析能力，提取两个 commit 之间的代码变更

**特点：**

- 🔧 被动调用（由 Agent 或 Workflow 调用）
- 📦 封装具体功能
- ♻️ 可复用

**功能：**

- 提取 Git diff
- 过滤不需要审查的文件（lock 文件、构建产物等）
- 返回结构化的文件变更数据

**何时被调用？**

1. **Agent 自主调用**（如果 AI 判断需要）
2. **Workflow 显式调用**（在 workflow 步骤中）

**当前状态：**

- ✅ 已定义
- ⚠️ 当前 CLI 未使用（CLI 自己处理 Git 操作）

---

#### 3. Workflow（工作流）

**位置：** `src/mastra/workflows/code-review-workflow.ts`

**作用：** 预定义的两步审查流程

**流程：**

```
Step 1: analyzeGitDiff
  ↓ 获取 Git diff
  ↓ 过滤文件
  ↓ 返回文件列表

Step 2: performCodeReview
  ↓ 接收文件列表
  ↓ 调用 Agent
  ↓ 生成审查报告
```

**特点：**

- 📋 固定步骤，确定性执行
- 🔄 自动数据传递
- 🎯 适合标准化流程

**调用方式：**

```bash
# HTTP API
POST http://localhost:4111/api/workflows/codeReviewWorkflow/run
Body: {
  "repoPath": "/path/to/repo",
  "fromCommit": "abc123",
  "toCommit": "def456"
}
```

**当前状态：**

- ✅ 已定义
- ⚠️ 当前 CLI 未使用（直接调用 Agent）

---

### 调用方式对比

| 方式         | 调用对象   | 灵活性 | 可预测性 | 适用场景               |
| ------------ | ---------- | ------ | -------- | ---------------------- |
| **Agent**    | AI 智能体  | 高     | 低       | 需要智能推理           |
| **Workflow** | 预定义流程 | 低     | 高       | 固定多步骤任务         |
| **Tool**     | 具体功能   | N/A    | 高       | 被 Agent/Workflow 调用 |

### 当前项目使用方式

```javascript
// 当前 CLI 的调用链路
CLI (cli.js / cli-github.js)
  │
  ├─→ 1. 自己获取 diff（simple-git 或 GitHub API）
  │
  └─→ 2. 调用 Agent API
        │
        └─→ Agent 直接分析（不调用 Tool）
```

**为什么不使用 Tool 和 Workflow？**

- CLI 已经处理了 Git 操作，不需要 Tool
- 单步审查，不需要 Workflow 的多步骤流程
- 更简单直接

**如果想使用 Workflow：**

```javascript
// 修改 CLI 调用 Workflow API
const response = await fetch('http://localhost:4111/api/workflows/codeReviewWorkflow/run', {
  method: 'POST',
  body: JSON.stringify({
    repoPath: '.',
    fromCommit: 'HEAD~1',
    toCommit: 'HEAD'
  })
})
```

---

## 🔧 GitHub Actions 集成

### 使用 GitHub API 版本（推荐）

创建 `.github/workflows/ai-code-review.yml`：

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout Agent Code
        uses: actions/checkout@v4
        with:
          repository: lxy030988/ai-codereview-agent
          path: agent

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Install Dependencies
        working-directory: agent
        run: pnpm install

      - name: Create Environment File
        working-directory: agent
        run: |
          echo "DEEPSEEK_API_KEY=${{ secrets.DEEPSEEK_API_KEY }}" > .env.development

      - name: Start Mastra Dev Server
        working-directory: agent
        run: |
          pnpm run dev &
          for i in {1..30}; do
            if curl -s http://localhost:4111/api/agents > /dev/null; then
              echo "✅ Mastra server is ready"
              break
            fi
            echo "⏳ Waiting for Mastra server... ($i/30)"
            sleep 2
          done

      - name: Run AI Code Review
        working-directory: agent
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          pnpm start:github \
            ${{ github.repository_owner }} \
            ${{ github.event.repository.name }} \
            ${{ github.event.pull_request.number }}
```

**必需的 Secrets：**

1. `DEEPSEEK_API_KEY` - DeepSeek API 密钥
2. `GITHUB_TOKEN` - GitHub 自动提供

---

## 📊 审查输出格式

```markdown
## 🤖 AI Code Review

## 🔴 高优先级问题

### `src/utils.ts` (第 45-50 行)

**类型**: 安全 **问题**: 潜在的 SQL 注入漏洞

**原代码**: \`\`\`typescript const query = `SELECT * FROM users WHERE id = ${userId}` \`\`\`

**建议修改**: \`\`\`typescript const query = `SELECT * FROM users WHERE id = ?` db.execute(query, [userId]) \`\`\`

**说明**: 使用参数化查询防止 SQL 注入

---

## 🟡 中优先级问题

...

## 💡 改进建议

...

## ✅ 优秀实践

...

---

_Powered by DeepSeek AI_
```

---

## 📁 项目结构

```
ai-codereview-agent/
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   └── code-review-agent.ts    # Agent 定义
│   │   ├── tools/
│   │   │   └── git-analysis-tool.ts    # Tool 定义
│   │   ├── workflows/
│   │   │   └── code-review-workflow.ts # Workflow 定义
│   │   └── index.ts                    # Mastra 主配置
│   ├── services/
│   │   └── github.service.ts           # GitHub API 服务（未使用）
│   ├── cli.js                          # CLI - 本地 Git 版本
│   └── cli-github.js                   # CLI - GitHub API 版本
├── .github/
│   └── workflows/
│       └── ai-code-review.yml          # GitHub Actions 配置
├── package.json
├── README.md
├── CLI_GITHUB_USAGE.md                 # GitHub API 版本使用文档
└── CI_SETUP_GUIDE.md                   # CI 配置指南
```

---

## 🎯 使用场景推荐

### 本地开发

```bash
# 使用本地 Git 版本
pnpm start . HEAD~1 HEAD
```

### GitHub Actions CI/CD

```bash
# 使用 GitHub API 版本
pnpm start:github owner repo pr-number
```

### 私有仓库

```bash
# 必须使用 GitHub API 版本
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
pnpm start:github owner repo pr-number
```

### Fork PR

```bash
# 推荐使用 GitHub API 版本
pnpm start:github owner repo pr-number
```

---

## ⚙️ 配置

### 修改 AI 模型

编辑 `src/mastra/agents/code-review-agent.ts`：

```typescript
export const codeReviewAgent = new Agent({
  name: 'Code Review Agent',
  model: 'deepseek/deepseek-chat' // 修改为其他模型
  // ...
})
```

### 自定义审查规则

修改 Agent 的 `instructions` 字段来调整审查重点和输出格式。

### 过滤文件类型

编辑 `src/mastra/tools/git-analysis-tool.ts` 中的 `skipPatterns`：

```typescript
const skipPatterns = [
  /\.lock$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /dist\//,
  /build\//,
  /\.min\.js$/,
  /\.map$/
]
```

---

## 🔍 开发

```bash
# 启动开发服务器
pnpm run dev

# 运行本地 Git 版本 CLI
pnpm start <repo-path> <from-commit> <to-commit>

# 运行 GitHub API 版本 CLI
pnpm start:github <owner> <repo> <pr-number>

# 构建
pnpm run build
```

---

## 📚 相关文档

- [CLI GitHub API 版本使用指南](./CLI_GITHUB_USAGE.md)
- [CI 配置指南](./CI_SETUP_GUIDE.md)
- [快速开始](./QUICKSTART.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT

---

## 🙏 致谢

- [Mastra](https://mastra.ai/) - AI Agent 框架
- [DeepSeek](https://www.deepseek.com/) - AI 模型
- [Octokit](https://github.com/octokit/rest.js) - GitHub API 客户端
