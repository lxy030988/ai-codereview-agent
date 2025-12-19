import { Mastra } from '@mastra/core/mastra'
import { PinoLogger } from '@mastra/loggers'
import { LibSQLStore } from '@mastra/libsql'
import { codeReviewWorkflow } from './workflows/code-review-workflow'
import { codeReviewAgent } from './agents/code-review-agent'

export const mastra = new Mastra({
  workflows: { codeReviewWorkflow },
  agents: { codeReviewAgent },
  storage: new LibSQLStore({
    url: ':memory:'
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info'
  }),
  telemetry: {
    enabled: false
  },
  observability: {
    default: { enabled: true }
  },
  bundler: {
    externals: ['supports-color', 'simple-git', '@octokit/rest']
  }
})
