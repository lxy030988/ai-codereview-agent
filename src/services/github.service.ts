import { Octokit } from '@octokit/rest'

export class GitHubService {
  private octokit: Octokit

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token })
  }

  /**
   * Post code review as a comment on PR
   */
  async postReviewComment(params: { owner: string; repo: string; prNumber: number; review: string }): Promise<void> {
    const { owner, repo, prNumber, review } = params

    const commentBody = `## 🤖 AI Code Review

${review}

---
*Powered by DeepSeek AI*`

    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody
    })
  }

  /**
   * Update existing review comment
   */
  async updateReviewComment(params: { owner: string; repo: string; commentId: number; review: string }): Promise<void> {
    const { owner, repo, commentId, review } = params

    const commentBody = `## 🤖 AI Code Review (Updated)

${review}

---
*Powered by DeepSeek AI*`

    await this.octokit.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body: commentBody
    })
  }

  /**
   * Find existing AI review comment
   */
  async findExistingComment(params: { owner: string; repo: string; prNumber: number }): Promise<number | null> {
    const { owner, repo, prNumber } = params

    const comments = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber
    })

    const aiComment = comments.data.find(comment => comment.body?.includes('🤖 AI Code Review'))

    return aiComment?.id || null
  }

  /**
   * Post or update review comment
   */
  async postOrUpdateReview(params: { owner: string; repo: string; prNumber: number; review: string }): Promise<void> {
    const { owner, repo, prNumber, review } = params

    const existingCommentId = await this.findExistingComment({
      owner,
      repo,
      prNumber
    })

    if (existingCommentId) {
      await this.updateReviewComment({
        owner,
        repo,
        commentId: existingCommentId,
        review
      })
    } else {
      await this.postReviewComment({
        owner,
        repo,
        prNumber,
        review
      })
    }
  }
}
