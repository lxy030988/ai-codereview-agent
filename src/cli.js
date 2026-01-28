#!/usr/bin/env node

/**
 * AI 代码审查 CLI 工具
 *
 * 功能：
 * 1. 通过 Mastra API 调用 AI 进行代码审查
 * 2. 支持本地审查（输出到控制台）
 * 3. 支持 GitHub PR 评论集成
 *
 * 使用方式：
 * node src/cli.js <repo路径> <from-commit> <to-commit> [owner] [repo] [pr-number]
 */

import { Octokit } from '@octokit/rest'
import { requireAuthHeaders } from './auth.js'

// Mastra API 服务地址
const MASTRA_API_URL = 'http://localhost:4111/api'

/**
 * GitHub 服务类
 * 负责与 GitHub API 交互，发布和更新 PR 评论
 */
class GitHubService {
  constructor(token) {
    this.octokit = new Octokit({ auth: token })
  }

  /**
   * 发布或更新 PR 审查评论
   *
   * @param {Object} params - 参数对象
   * @param {string} params.owner - 仓库所有者
   * @param {string} params.repo - 仓库名称
   * @param {number} params.prNumber - PR 编号
   * @param {string} params.review - 审查内容（Markdown 格式）
   */
  async postOrUpdateReview(params) {
    const { owner, repo, prNumber, review } = params

    // 构建评论内容，添加标识头部
    const commentBody = `## 🤖 AI Code Review

${review}

---
*Powered by DeepSeek AI*`

    // 获取 PR 的所有评论
    const comments = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber
    })

    // 查找已存在的 AI 评论（通过标识头部识别）
    const aiComment = comments.data.find(comment => comment.body?.includes('🤖 AI Code Review'))

    if (aiComment) {
      // 如果找到已有评论，则更新它（避免重复评论）
      await this.octokit.issues.updateComment({
        owner,
        repo,
        comment_id: aiComment.id,
        body: commentBody
      })
    } else {
      // 如果没有找到，则创建新评论
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody
      })
    }
  }
}

/**
 * 执行代码审查
 *
 * 流程：
 * 1. 使用 simple-git 提取代码变更
 * 2. 构建审查提示词
 * 3. 调用 Mastra Agent API 进行 AI 审查
 *
 * @param {string} repoPath - Git 仓库路径
 * @param {string} fromCommit - 起始 commit SHA
 * @param {string} toCommit - 结束 commit SHA
 * @returns {Promise<string>} AI 审查结果
 */
async function executeReview(repoPath, fromCommit, toCommit, authHeaders) {
  // 动态导入 simple-git（ESM 模块）
  const simpleGit = (await import('simple-git')).default
  const git = simpleGit(repoPath)

  // 获取 diff 摘要（文件数量、增删行数等）
  const diffSummary = await git.diffSummary([`${fromCommit}..${toCommit}`])
  // 获取完整的 diff 内容
  const diff = await git.diff([`${fromCommit}..${toCommit}`])

  // 构建发送给 AI 的提示词
  const prompt = `请审查以下代码变更：

**仓库**: ${repoPath}
**提交范围**: ${fromCommit} → ${toCommit}
**变更文件数**: ${diffSummary.files.length}
**新增行数**: +${diffSummary.insertions}
**删除行数**: -${diffSummary.deletions}

**代码 Diff**:
\`\`\`diff
${diff}
\`\`\`

请按照你的指示提供全面的代码审查。`

  // 调用 Mastra Agent API
  const response = await fetch(`${MASTRA_API_URL}/agents/codeReviewAgent/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Agent API 调用失败: ${error}`)
  }

  const result = await response.json()
  // 返回 AI 生成的文本内容
  return result.text || result.content || result
}

/**
 * 检查 Mastra 服务器是否运行
 *
 * @returns {Promise<boolean>} 服务器是否可用
 */
async function checkMastraServer(authHeaders) {
  try {
    // 尝试访问 agents 端点来验证服务器状态
    const response = await fetch(`${MASTRA_API_URL}/agents`, {
      method: 'GET',
      headers: authHeaders
    })
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * 主函数
 * 处理命令行参数，执行审查流程
 */
async function main() {
  // 解析命令行参数（跳过前两个：node 和脚本路径）
  const args = process.argv.slice(2)

  const repoPath = args[0] // Git 仓库路径
  const fromCommit = args[1] // 起始 commit
  const toCommit = args[2] // 结束 commit
  const owner = args[3] // GitHub 仓库所有者（可选）
  const repo = args[4] // GitHub 仓库名称（可选）
  const prNumber = args[5] ? parseInt(args[5]) : undefined // PR 编号（可选）

  // 参数验证
  if (!repoPath || !fromCommit || !toCommit) {
    console.log(`
🤖 AI Code Review Agent

使用方式:
  pnpm start <repoPath> <fromCommit> <toCommit> [owner] [repo] [prNumber]

示例:
  # 仅本地审查
  pnpm start . HEAD~1 HEAD

  # 带 PR 评论
  pnpm start . abc123 def456 your-org your-repo 123

参数说明:
  repoPath   - Git 仓库路径
  fromCommit - 起始 commit SHA
  toCommit   - 结束 commit SHA
  owner      - GitHub 仓库所有者（可选，用于 PR 评论）
  repo       - GitHub 仓库名称（可选，用于 PR 评论）
  prNumber   - Pull Request 编号（可选，用于 PR 评论）

环境变量:
  DEEPSEEK_API_KEY - DeepSeek API 密钥（必需）
  GITHUB_TOKEN     - GitHub token（可选，用于 PR 评论）
  JWT_AUTH_SECRET  - JWT 签名密钥（必需，或提供 MASTRA_JWT_TOKEN）
  MASTRA_JWT_TOKEN - 可选，已有 JWT 时直接使用

前置条件:
  Mastra dev 服务器必须运行在 4111 端口
  运行: pnpm run dev (在 ai-codereview-agent 目录)
`)
    process.exit(1)
  }

  // 检查 Mastra 服务器是否运行
  console.log('🔍 检查 Mastra 服务器...')
  let authHeaders

  try {
    authHeaders = requireAuthHeaders()
  } catch (error) {
    console.error('\n❌ JWT 鉴权未配置：')
    console.error(error.message)
    console.error('\n请设置以下任一环境变量：')
    console.error('  - MASTRA_JWT_TOKEN: 已签发的 JWT，直接用于请求')
    console.error('  - JWT_AUTH_SECRET: 供 CLI 本地签发临时 JWT')
    process.exit(1)
  }

  const serverRunning = await checkMastraServer(authHeaders)

  if (!serverRunning) {
    console.error('\n❌ Mastra 服务器未运行！')
    console.error('请先启动服务器:')
    console.error('  cd /Users/lxy/Desktop/lxy030988/ai-codereview-agent')
    console.error('  pnpm run dev')
    console.error('\n然后重新运行此命令。')
    process.exit(1)
  }

  console.log('✅ Mastra 服务器运行中\n')
  console.log('🔍 开始 AI 代码审查...\n')
  console.log(`📁 仓库: ${repoPath}`)
  console.log(`📊 审查范围: ${fromCommit} → ${toCommit}`)

  if (owner && repo && prNumber) {
    console.log(`💬 将发布到 PR: ${owner}/${repo}#${prNumber}`)
  }
  console.log()

  try {
    // 执行 AI 审查
    console.log('⏳ 运行 AI 审查中...\n')
    const review = await executeReview(repoPath, fromCommit, toCommit, authHeaders)

    console.log('\n✅ 审查完成!\n')
    console.log(review)

    // 如果提供了 GitHub 参数，则发布 PR 评论
    if (owner && repo && prNumber && process.env.GITHUB_TOKEN) {
      console.log('\n📤 发布审查到 GitHub PR...')

      const github = new GitHubService(process.env.GITHUB_TOKEN)

      await github.postOrUpdateReview({
        owner,
        repo,
        prNumber,
        review: review
      })

      console.log(`✅ 已发布到 https://github.com/${owner}/${repo}/pull/${prNumber}`)
    } else if (owner || repo || prNumber) {
      console.log('\n⚠️  缺少 GitHub 参数或 token，跳过 PR 评论。')
      console.log('需要: owner, repo, prNumber 和 GITHUB_TOKEN 环境变量')
    }
  } catch (error) {
    console.error('\n❌ 审查失败:')
    console.error(error.message)
    if (error.stack) {
      console.error('\n堆栈跟踪:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 执行主函数
main()
// Test AI code review functionality
