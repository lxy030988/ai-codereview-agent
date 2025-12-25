#!/usr/bin/env node

/**
 * AI 代码审查 CLI 工具 - GitHub API 版本
 *
 * 功能：
 * 1. 通过 GitHub API 获取 PR 的 diff
 * 2. 通过 Mastra API 调用 AI 进行代码审查
 * 3. 支持私有仓库（使用 GitHub Token）
 * 4. 自动发布或更新 PR 评论
 *
 * 使用方式：
 * node src/cli-github.js <owner> <repo> <pr-number>
 */

import { Octokit } from '@octokit/rest'

// Mastra API 服务地址
const MASTRA_API_URL = 'http://localhost:4111/api'

/**
 * GitHub 服务类
 * 负责与 GitHub API 交互，获取 PR 信息和发布评论
 */
class GitHubService {
  constructor(token) {
    this.octokit = new Octokit({ auth: token })
  }

  /**
   * 获取 PR 的 diff 内容
   *
   * @param {Object} params - 参数对象
   * @param {string} params.owner - 仓库所有者
   * @param {string} params.repo - 仓库名称
   * @param {number} params.prNumber - PR 编号
   * @returns {Promise<string>} PR 的 diff 内容
   */
  async getPRDiff(params) {
    const { owner, repo, prNumber } = params

    const { data: diff } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: 'diff' // 获取 diff 格式
      }
    })

    return diff
  }

  /**
   * 获取 PR 的基本信息
   *
   * @param {Object} params - 参数对象
   * @param {string} params.owner - 仓库所有者
   * @param {string} params.repo - 仓库名称
   * @param {number} params.prNumber - PR 编号
   * @returns {Promise<Object>} PR 信息
   */
  async getPRInfo(params) {
    const { owner, repo, prNumber } = params

    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    })

    return {
      title: pr.title,
      author: pr.user.login,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files
    }
  }

  /**
   * 获取 PR 变更的文件列表
   *
   * @param {Object} params - 参数对象
   * @param {string} params.owner - 仓库所有者
   * @param {string} params.repo - 仓库名称
   * @param {number} params.prNumber - PR 编号
   * @returns {Promise<Array>} 文件列表
   */
  async getPRFiles(params) {
    const { owner, repo, prNumber } = params

    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    })

    return files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes
    }))
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
      console.log('✅ 已更新现有评论')
    } else {
      // 如果没有找到，则创建新评论
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody
      })
      console.log('✅ 已创建新评论')
    }
  }
}

/**
 * 执行代码审查
 *
 * 流程：
 * 1. 使用 GitHub API 获取 PR 信息和 diff
 * 2. 构建审查提示词
 * 3. 调用 Mastra Agent API 进行 AI 审查
 *
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @param {number} prNumber - PR 编号
 * @returns {Promise<string>} AI 审查结果
 */
async function executeReview(owner, repo, prNumber) {
  const github = new GitHubService(process.env.GITHUB_TOKEN)

  console.log('📥 获取 PR 信息...')

  // 获取 PR 基本信息
  const prInfo = await github.getPRInfo({ owner, repo, prNumber })

  // 获取 PR diff
  const diff = await github.getPRDiff({ owner, repo, prNumber })

  // 获取变更文件列表
  const files = await github.getPRFiles({ owner, repo, prNumber })

  console.log(`📊 PR 信息:`)
  console.log(`   标题: ${prInfo.title}`)
  console.log(`   作者: ${prInfo.author}`)
  console.log(`   分支: ${prInfo.baseBranch} ← ${prInfo.headBranch}`)
  console.log(`   变更: ${prInfo.changedFiles} 个文件, +${prInfo.additions} -${prInfo.deletions}`)
  console.log()

  // 构建发送给 AI 的提示词
  const prompt = `请审查以下 Pull Request：

**仓库**: ${owner}/${repo}
**PR**: #${prNumber} - ${prInfo.title}
**作者**: ${prInfo.author}
**分支**: ${prInfo.baseBranch} ← ${prInfo.headBranch}
**变更文件数**: ${prInfo.changedFiles}
**新增行数**: +${prInfo.additions}
**删除行数**: -${prInfo.deletions}

**变更文件列表**:
${files.map(f => `- ${f.filename} (${f.status}): +${f.additions} -${f.deletions}`).join('\n')}

**代码 Diff**:
\`\`\`diff
${diff}
\`\`\`

请按照你的指示提供全面的代码审查。`

  // 调用 Mastra Agent API
  console.log('🤖 调用 AI 进行代码审查...\n')

  const response = await fetch(`${MASTRA_API_URL}/agents/codeReviewAgent/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
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
async function checkMastraServer() {
  try {
    // 尝试访问 agents 端点来验证服务器状态
    const response = await fetch(`${MASTRA_API_URL}/agents`, {
      method: 'GET'
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

  const owner = args[0] // GitHub 仓库所有者
  const repo = args[1] // GitHub 仓库名称
  const prNumber = args[2] ? parseInt(args[2]) : undefined // PR 编号

  // 参数验证
  if (!owner || !repo || !prNumber) {
    console.log(`
🤖 AI Code Review Agent - GitHub API 版本

使用方式:
  pnpm start:github <owner> <repo> <prNumber>

示例:
  pnpm start:github lxy030988 ai-codereview-agent 123

参数说明:
  owner    - GitHub 仓库所有者
  repo     - GitHub 仓库名称
  prNumber - Pull Request 编号

环境变量:
  DEEPSEEK_API_KEY - DeepSeek API 密钥（必需）
  GITHUB_TOKEN     - GitHub token（必需，用于访问 PR 和发布评论）

前置条件:
  Mastra dev 服务器必须运行在 4111 端口
  运行: pnpm run dev (在 ai-codereview-agent 目录)
`)
    process.exit(1)
  }

  // 检查环境变量
  if (!process.env.GITHUB_TOKEN) {
    console.error('\n❌ 缺少 GITHUB_TOKEN 环境变量！')
    console.error('请设置: export GITHUB_TOKEN=ghp_xxxxxxxxxxxx')
    console.error('\n如何获取 GitHub Token:')
    console.error('  1. 访问 https://github.com/settings/tokens')
    console.error('  2. 创建 Personal Access Token')
    console.error('  3. 权限: repo (私有仓库) 或 public_repo (公开仓库)')
    process.exit(1)
  }

  // 检查 Mastra 服务器是否运行
  console.log('🔍 检查 Mastra 服务器...')
  const serverRunning = await checkMastraServer()

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
  console.log(`📁 仓库: ${owner}/${repo}`)
  console.log(`💬 PR: #${prNumber}`)
  console.log()

  try {
    // 执行 AI 审查
    console.log('⏳ 运行 AI 审查中...\n')
    const review = await executeReview(owner, repo, prNumber)

    console.log('\n✅ 审查完成!\n')
    console.log(review)

    // 发布 PR 评论
    console.log('\n📤 发布审查到 GitHub PR...')

    const github = new GitHubService(process.env.GITHUB_TOKEN)

    await github.postOrUpdateReview({
      owner,
      repo,
      prNumber,
      review: review
    })

    console.log(`✅ 已发布到 https://github.com/${owner}/${repo}/pull/${prNumber}`)
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
