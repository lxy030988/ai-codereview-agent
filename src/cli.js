#!/usr/bin/env node
import { Octokit } from '@octokit/rest'

const MASTRA_API_URL = 'http://localhost:4111/api'

class GitHubService {
  constructor(token) {
    this.octokit = new Octokit({ auth: token })
  }

  async postOrUpdateReview(params) {
    const { owner, repo, prNumber, review } = params

    const commentBody = `## 🤖 AI Code Review

${review}

---
*Powered by DeepSeek AI*`

    const comments = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber
    })

    const aiComment = comments.data.find(comment => comment.body?.includes('🤖 AI Code Review'))

    if (aiComment) {
      await this.octokit.issues.updateComment({
        owner,
        repo,
        comment_id: aiComment.id,
        body: commentBody
      })
    } else {
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody
      })
    }
  }
}

async function executeReview(repoPath, fromCommit, toCommit) {
  // First, get the git diff
  const simpleGit = (await import('simple-git')).default
  const git = simpleGit(repoPath)

  const diffSummary = await git.diffSummary([`${fromCommit}..${toCommit}`])
  const diff = await git.diff([`${fromCommit}..${toCommit}`])

  // Build prompt for AI
  const prompt = `Please review the following code changes:

**Repository**: ${repoPath}
**Commits**: ${fromCommit} → ${toCommit}
**Files changed**: ${diffSummary.files.length}
**Insertions**: +${diffSummary.insertions}
**Deletions**: -${diffSummary.deletions}

**Code Diff**:
\`\`\`diff
${diff}
\`\`\`

Please provide a comprehensive code review following your instructions.`

  // Call Mastra Agent API
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
    throw new Error(`Agent API failed: ${error}`)
  }

  const result = await response.json()
  return result.text || result.content || result
}

async function checkMastraServer() {
  try {
    // Try to fetch agents list to verify server is running
    const response = await fetch(`${MASTRA_API_URL}/agents`, {
      method: 'GET'
    })
    return response.ok
  } catch (error) {
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)

  const repoPath = args[0]
  const fromCommit = args[1]
  const toCommit = args[2]
  const owner = args[3]
  const repo = args[4]
  const prNumber = args[5] ? parseInt(args[5]) : undefined

  if (!repoPath || !fromCommit || !toCommit) {
    console.log(`
🤖 AI Code Review Agent

Usage:
  pnpm start <repoPath> <fromCommit> <toCommit> [owner] [repo] [prNumber]

Examples:
  # Local review only
  pnpm start . HEAD~1 HEAD

  # Review with PR comment
  pnpm start . abc123 def456 your-org your-repo 123

Arguments:
  repoPath   - Path to the Git repository
  fromCommit - Starting commit SHA
  toCommit   - Ending commit SHA
  owner      - GitHub repository owner (optional, for PR comments)
  repo       - GitHub repository name (optional, for PR comments)
  prNumber   - Pull request number (optional, for PR comments)

Environment Variables:
  DEEPSEEK_API_KEY - Your DeepSeek API key (required)
  GITHUB_TOKEN     - GitHub token for PR comments (optional)

Prerequisites:
  Mastra dev server must be running on port 4111
  Run: pnpm run dev (in ai-codereview-agent directory)
`)
    process.exit(1)
  }

  // Check if Mastra server is running
  console.log('🔍 Checking Mastra server...')
  const serverRunning = await checkMastraServer()

  if (!serverRunning) {
    console.error('\n❌ Mastra server is not running!')
    console.error('Please start it first:')
    console.error('  cd /Users/lxy/Desktop/lxy030988/ai-codereview-agent')
    console.error('  pnpm run dev')
    console.error('\nThen run this command again.')
    process.exit(1)
  }

  console.log('✅ Mastra server is running\n')
  console.log('🔍 Starting AI Code Review...\n')
  console.log(`📁 Repository: ${repoPath}`)
  console.log(`📊 Reviewing: ${fromCommit} → ${toCommit}`)

  if (owner && repo && prNumber) {
    console.log(`💬 Will post to PR: ${owner}/${repo}#${prNumber}`)
  }
  console.log()

  try {
    // Execute review via Agent API
    console.log('⏳ Running AI review...\n')
    const review = await executeReview(repoPath, fromCommit, toCommit)

    console.log('\n✅ Review completed!\n')
    console.log(review)

    // Post to GitHub PR if parameters provided
    if (owner && repo && prNumber && process.env.GITHUB_TOKEN) {
      console.log('\n📤 Posting review to GitHub PR...')

      const github = new GitHubService(process.env.GITHUB_TOKEN)

      await github.postOrUpdateReview({
        owner,
        repo,
        prNumber,
        review: review
      })

      console.log(`✅ Posted to https://github.com/${owner}/${repo}/pull/${prNumber}`)
    } else if (owner || repo || prNumber) {
      console.log('\n⚠️  Missing GitHub parameters or token. Skipping PR comment.')
      console.log('Required: owner, repo, prNumber, and GITHUB_TOKEN env variable')
    }
  } catch (error) {
    console.error('\n❌ Review failed:')
    console.error(error.message)
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
