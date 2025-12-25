# GitHub API 版本 CLI 使用指南

## 📋 概述

`cli-github.js` 是使用 GitHub API 的新版本 CLI，相比原版 `cli.js` 有以下优势：

- ✅ 直接通过 GitHub API 获取 PR diff，无需本地仓库
- ✅ 完美支持私有仓库（使用 GitHub Token）
- ✅ 更适合 CI/CD 环境
- ✅ 支持 fork PR
- ✅ 获取更完整的 PR 信息

## 🚀 快速开始

### 1. 获取 GitHub Token

访问 https://github.com/settings/tokens 创建 Personal Access Token

**权限要求：**

- `repo` - 访问私有仓库
- 或 `public_repo` - 仅访问公开仓库

### 2. 设置环境变量

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
```

### 3. 启动 Mastra 服务器

```bash
pnpm run dev
```

### 4. 运行审查

```bash
# 使用新的 GitHub API 版本
pnpm start:github <owner> <repo> <pr-number>

# 示例
pnpm start:github lxy030988 ai-codereview-agent 123
```

## 📝 使用方式对比

### 原版 CLI (`cli.js`)

```bash
# 需要本地仓库路径和 commit SHA
pnpm start <repo-path> <from-commit> <to-commit> [owner] [repo] [pr-number]

# 示例
pnpm start . HEAD~1 HEAD lxy030988 ai-codereview-agent 123
```

**适用场景：**

- 本地开发
- 已克隆的仓库
- 不需要 GitHub API

### GitHub API 版本 (`cli-github.js`)

```bash
# 只需要仓库信息和 PR 号
pnpm start:github <owner> <repo> <pr-number>

# 示例
pnpm start:github lxy030988 ai-codereview-agent 123
```

**适用场景：**

- CI/CD 环境
- 私有仓库
- Fork PR
- 无需克隆仓库

## 🔧 GitHub Actions 集成

### 更新 workflow 配置

```yaml
# .github/workflows/ai-code-review.yml
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
          # 等待服务器启动
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

### 关键改进

1. **不需要 checkout PR 代码** - 直接通过 API 获取
2. **更简洁的参数** - 只需要 owner、repo、pr-number
3. **更可靠** - 不依赖本地 Git 操作

## 🔒 安全最佳实践

### 1. 使用 Secrets 管理 Token

```yaml
# ✅ 正确
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# ❌ 错误 - 不要硬编码
env:
  GITHUB_TOKEN: ghp_xxxxxxxxxxxx
```

### 2. 最小权限原则

只授予必要的权限：

```yaml
permissions:
  contents: read # 只读代码
  pull-requests: write # 只写 PR 评论
```

### 3. 保护 Token

```bash
# 添加到 .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

## 📊 功能对比

| 功能         | cli.js (原版) | cli-github.js (新版) |
| ------------ | ------------- | -------------------- |
| 本地仓库支持 | ✅            | ❌                   |
| 私有仓库支持 | ⚠️ 需配置凭证 | ✅ 完美支持          |
| Fork PR 支持 | ⚠️ 可能有问题 | ✅ 完美支持          |
| CI/CD 适用性 | ⭐⭐⭐        | ⭐⭐⭐⭐⭐           |
| 需要克隆仓库 | ✅ 是         | ❌ 否                |
| 获取 PR 信息 | ❌ 有限       | ✅ 完整              |
| 性能         | ⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐           |

## 🎯 推荐使用场景

### 使用 `cli.js` (原版)

- 本地开发和测试
- 已经克隆的仓库
- 不想使用 GitHub API

### 使用 `cli-github.js` (新版)

- **GitHub Actions CI/CD** ✅ 推荐
- 私有仓库审查
- Fork PR 审查
- 不想克隆大型仓库

## 🐛 故障排查

### 问题 1: GITHUB_TOKEN 未设置

```
❌ 缺少 GITHUB_TOKEN 环境变量！
```

**解决**：

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### 问题 2: Token 权限不足

```
Error: Resource not accessible by integration
```

**解决**：检查 Token 权限，确保有 `repo` 或 `public_repo` 权限

### 问题 3: PR 不存在

```
Error: Not Found
```

**解决**：检查 owner、repo、pr-number 是否正确

### 问题 4: Mastra 服务器未运行

```
❌ Mastra 服务器未运行！
```

**解决**：

```bash
pnpm run dev
```

## 📝 示例

### 本地测试

```bash
# 1. 启动 Mastra
pnpm run dev

# 2. 在另一个终端运行审查
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
pnpm start:github lxy030988 ai-codereview-agent 123
```

### GitHub Actions

参考上面的 workflow 配置，推送到 `.github/workflows/ai-code-review.yml`

## 🎉 总结

新版 `cli-github.js` 专为 GitHub CI/CD 环境设计，提供更可靠、更简洁的 PR 审查体验。推荐在 GitHub Actions 中使用！
