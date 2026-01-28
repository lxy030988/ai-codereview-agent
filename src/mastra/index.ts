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
import { MastraJwtAuth } from '@mastra/auth'

// const jwtSecret = process.env.JWT_AUTH_SECRET

// if (!jwtSecret) {
//   throw new Error('JWT_AUTH_SECRET 未配置，无法启动 Mastra 服务器的 JWT 鉴权')
// }

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
  // server: {
  //   // 启用 JWT 鉴权，保护 /api/* 路由
  //   experimental_auth: new MastraJwtAuth({
  //     secret: jwtSecret,
  //     protected: [/^\/api\//],
  //     public: [/^\/api\/health/]
  //   })
  // },
  bundler: {
    // 构建器外部依赖配置
    externals: ['simple-git', 'supports-color']
  }
})
