# AI Code Review Agent

AI-powered code review tool using Mastra framework and DeepSeek model.

## Features

- 🤖 **AI-Powered Reviews**: Uses DeepSeek Chat model for intelligent code analysis
- 🔍 **Git Integration**: Analyzes code changes between any two commits
- 🎯 **Smart Filtering**: Automatically skips lock files, build artifacts, and minified code
- 📊 **Comprehensive Analysis**: Checks for security, performance, quality, and bugs
- 💬 **Actionable Feedback**: Provides specific suggestions with code examples

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Edit `.env`:

```
DEEPSEEK_API_KEY=your-deepseek-api-key-here
GITHUB_TOKEN=your-github-token-here  # Optional, for GitHub PR integration
```

### 3. Build

```bash
pnpm build
```

## Usage

### Local Development

```bash
# Review changes between two commits (console output only)
pnpm start /path/to/repo <from-commit> <to-commit>

# Example: Review last commit
pnpm start . HEAD~1 HEAD

# Example: Review specific commits
pnpm start /path/to/repo abc123 def456
```

### With GitHub PR Comments

```bash
# Review and post to GitHub PR
pnpm start <repo-path> <from-commit> <to-commit> <owner> <repo> <pr-number>

# Example
export GITHUB_TOKEN=your_github_token
pnpm start . abc123 def456 your-org your-repo 123
```

### In GitHub Actions

Create `.github/workflows/code-review.yml` in your target repository:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Clone AI Review Agent
        run: git clone https://github.com/YOUR_ORG/ai-codereview-agent.git /tmp/ai-review

      - name: Install and Build
        working-directory: /tmp/ai-review
        run: |
          pnpm install
          pnpm build

      - name: Run Review
        working-directory: /tmp/ai-review
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          pnpm start \
            ${{ github.workspace }} \
            ${{ github.event.pull_request.base.sha }} \
            ${{ github.event.pull_request.head.sha }} \
            ${{ github.repository_owner }} \
            ${{ github.event.repository.name }} \
            ${{ github.event.pull_request.number }}
```

**Required Secrets:**

- `DEEPSEEK_API_KEY` - Your DeepSeek API key
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

## How It Works

1. **Git Analysis**: Extracts code changes between two commits using `simple-git`
2. **Smart Filtering**: Removes files that shouldn't be reviewed (lock files, build artifacts, etc.)
3. **AI Review**: Sends changes to DeepSeek model with structured prompts
4. **Report Generation**: Formats feedback in markdown with severity levels and suggestions

## Review Output Format

```markdown
## 🔴 High Priority Issues

### `filename.ts` (Line 45)

**Type**: Security **Issue**: Potential SQL injection vulnerability **Suggestion**: Use parameterized queries

## 🟡 Medium Priority Issues

...

## 💡 Suggestions

...

## ✅ Good Practices

...
```

## Configuration

The agent uses DeepSeek Chat model by default. You can modify the model in `src/mastra/agents/code-review-agent.ts`:

```typescript
model: 'deepseek/deepseek-chat',  // Change to other models as needed
```

## Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run built version
pnpm start
```

## Project Structure

```
ai-codereview-agent/
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   └── code-review-agent.ts    # AI agent configuration
│   │   ├── tools/
│   │   │   └── git-analysis-tool.ts    # Git diff analysis
│   │   ├── workflows/
│   │   │   └── code-review-workflow.ts # Review workflow
│   │   └── index.ts                    # Mastra configuration
│   └── cli.ts                          # CLI entry point
├── package.json
└── README.md
```

## License

MIT
