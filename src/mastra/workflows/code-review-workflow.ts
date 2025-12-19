/**
 * 代码审查工作流
 *
 * 两步流程：
 * 1. 分析 Git diff
 * 2. 执行 AI 代码审查
 */

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// 步骤 1: 分析 Git Diff
const analyzeGitDiff = createStep({
  id: 'analyze-git-diff',
  description: 'Analyzes Git diff to extract code changes',
  inputSchema: z.object({
    repoPath: z.string().describe('Path to the Git repository'),
    fromCommit: z.string().describe('Starting commit SHA'),
    toCommit: z.string().describe('Ending commit SHA')
  }),
  outputSchema: z.object({
    files: z.array(
      z.object({
        path: z.string(),
        status: z.string(),
        additions: z.number(),
        deletions: z.number(),
        diff: z.string()
      })
    ),
    totalFiles: z.number()
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    // 动态导入 simple-git

    const simpleGit = (await import('simple-git')).default
    const git = simpleGit(inputData.repoPath)

    // 获取 diff 摘要
    const diffSummary = await git.diffSummary([`${inputData.fromCommit}..${inputData.toCommit}`])

    // 获取每个文件的详细 diff
    const files = await Promise.all(
      diffSummary.files.map(async file => {
        const diff = await git.diff([`${inputData.fromCommit}..${inputData.toCommit}`, '--', file.file])

        // 跳过二进制文件
        if ('binary' in file && file.binary) {
          return null
        }

        // 确定文件状态
        let status: string
        const insertions = 'insertions' in file ? file.insertions : 0
        const deletions = 'deletions' in file ? file.deletions : 0

        if (insertions > 0 && deletions === 0) {
          status = 'added'
        } else if (insertions === 0 && deletions > 0) {
          status = 'deleted'
        } else {
          status = 'modified'
        }

        return {
          path: file.file,
          status,
          additions: insertions,
          deletions: deletions,
          diff: diff
        }
      })
    )

    // 过滤二进制文件和不需要审查的文件
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

    const reviewableFiles = files.filter(
      (file): file is NonNullable<typeof file> =>
        file !== null && !skipPatterns.some(pattern => pattern.test(file.path)) && file.status !== 'deleted'
    )

    return {
      files: reviewableFiles,
      totalFiles: reviewableFiles.length
    }
  }
})

// 步骤 2: 执行代码审查
const performCodeReview = createStep({
  id: 'perform-code-review',
  description: 'Performs AI-powered code review on the changes',
  inputSchema: z.object({
    files: z.array(
      z.object({
        path: z.string(),
        status: z.string(),
        additions: z.number(),
        deletions: z.number(),
        diff: z.string()
      })
    ),
    totalFiles: z.number()
  }),
  outputSchema: z.object({
    review: z.string()
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    // 获取代码审查 Agent
    const agent = mastra?.getAgent('codeReviewAgent')
    if (!agent) {
      throw new Error('Code review agent not found')
    }

    // 构建包含所有文件变更的提示词
    const filesContext = inputData.files
      .map(
        file => `
### File: ${file.path} (${file.status})
**Changes**: +${file.additions} -${file.deletions}

\`\`\`diff
${file.diff}
\`\`\`
`
      )
      .join('\n\n')

    const prompt = `Please review the following code changes:

**Summary**: ${inputData.totalFiles} files changed

${filesContext}

Provide a comprehensive code review following the format specified in your instructions.`

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt
      }
    ])

    // 收集流式输出
    let reviewText = ''
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk)
      reviewText += chunk
    }

    return {
      review: reviewText
    }
  }
})

// 代码审查工作流定义
export const codeReviewWorkflow = createWorkflow({
  id: 'code-review-workflow',
  inputSchema: z.object({
    repoPath: z.string().describe('Path to the Git repository'),
    fromCommit: z.string().describe('Starting commit SHA'),
    toCommit: z.string().describe('Ending commit SHA')
  }),
  outputSchema: z.object({
    review: z.string()
  })
})
  .then(analyzeGitDiff) // 步骤 1: 分析 Git diff
  .then(performCodeReview) // 步骤 2: 执行审查

// 提交工作流配置
codeReviewWorkflow.commit()
