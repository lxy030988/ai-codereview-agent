/**
 * GitHub API 服务
 *
 * 封装 GitHub API 交互，用于发布和更新 PR 评论
 */

import { Octokit } from '@octokit/rest'

// GitHub 服务类
export class GitHubService {
  private octokit: Octokit

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token })
  }

  /**
   * 发布代码审查评论到 PR
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
   * 更新已有的审查评论
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
   * 查找已存在的 AI 审查评论
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
   * 发布或更新审查评论（智能合并）
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
