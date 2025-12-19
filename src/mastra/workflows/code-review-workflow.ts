import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

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

    const simpleGit = (await import('simple-git')).default
    const git = simpleGit(inputData.repoPath)

    // Get diff summary
    const diffSummary = await git.diffSummary([`${inputData.fromCommit}..${inputData.toCommit}`])

    // Get detailed diff for each file
    const files = await Promise.all(
      diffSummary.files.map(async file => {
        const diff = await git.diff([`${inputData.fromCommit}..${inputData.toCommit}`, '--', file.file])

        // Handle binary files - skip them
        if ('binary' in file && file.binary) {
          return null
        }

        // Determine file status
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

    // Filter out null values (binary files) and files we don't want to review
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

    const agent = mastra?.getAgent('codeReviewAgent')
    if (!agent) {
      throw new Error('Code review agent not found')
    }

    // Build prompt with all file changes
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
  .then(analyzeGitDiff)
  .then(performCodeReview)

codeReviewWorkflow.commit()
