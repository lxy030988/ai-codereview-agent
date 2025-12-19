import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import simpleGit from 'simple-git'

export const gitAnalysisTool = createTool({
  id: 'git-analysis',
  description: 'Analyzes Git diff between two commits to extract code changes',
  inputSchema: z.object({
    repoPath: z.string().describe('Path to the Git repository'),
    fromCommit: z.string().describe('Starting commit SHA'),
    toCommit: z.string().describe('Ending commit SHA')
  }),
  outputSchema: z.object({
    files: z.array(
      z.object({
        path: z.string(),
        status: z.enum(['added', 'modified', 'deleted']),
        additions: z.number(),
        deletions: z.number(),
        diff: z.string()
      })
    ),
    totalFiles: z.number(),
    totalAdditions: z.number(),
    totalDeletions: z.number()
  }),
  execute: async ({ context }) => {
    const { repoPath, fromCommit, toCommit } = context

    const git = simpleGit(repoPath)

    // Get list of changed files
    const diffSummary = await git.diffSummary([`${fromCommit}..${toCommit}`])

    // Get detailed diff for each file
    const files = await Promise.all(
      diffSummary.files.map(async file => {
        const diff = await git.diff([`${fromCommit}..${toCommit}`, '--', file.file])

        // Handle binary files - skip them
        if ('binary' in file && file.binary) {
          return null
        }

        // Determine file status
        let status: 'added' | 'modified' | 'deleted'
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
      totalFiles: reviewableFiles.length,
      totalAdditions: diffSummary.insertions,
      totalDeletions: diffSummary.deletions
    }
  }
})
