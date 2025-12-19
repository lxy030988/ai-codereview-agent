/**
 * Mastra 主配置文件
 *
 * 注册 AI Agent、Workflow、配置存储和日志
 */

import { Mastra } from '@mastra/core/mastra'
import { PinoLogger } from '@mastra/loggers'
import { LibSQLStore } from '@mastra/libsql'
import { codeReviewWorkflow } from './workflows/code-review-workflow'
import { codeReviewAgent } from './agents/code-review-agent'

// Mastra 实例配置
export const mastra = new Mastra({
  workflows: { codeReviewWorkflow }, // 注册代码审查工作流
  agents: { codeReviewAgent }, // 注册代码审查 Agent
  storage: new LibSQLStore({
    // 使用内存数据库（适合开发和 CI）
    url: ':memory:'
  }),
  logger: new PinoLogger({
    // 配置日志记录
    name: 'Mastra',
    level: 'info'
  }),
  telemetry: {
    // 禁用遥测
    enabled: false
  },
  observability: {
    // 启用可观测性
    default: { enabled: true }
  },
  bundler: {
    // 构建器外部依赖配置
    externals: ['supports-color', 'simple-git', '@octokit/rest']
  }
})
