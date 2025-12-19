# AI Code Review Agent - 快速测试

## 🚀 直接运行（不需要构建）

```bash
cd /Users/lxy/Desktop/lxy030988/ai-codereview-agent

# 审查 react-template 的最近一次提交
pnpm start \
  /Users/lxy/Desktop/lxy030988/react-template \
  HEAD~1 \
  HEAD
```

## 📝 命令格式

```bash
pnpm start <repo路径> <from-commit> <to-commit> [owner] [repo] [pr-number]
```

## 🧪 测试示例

### 1. 审查最近 1 次提交

```bash
pnpm start /Users/lxy/Desktop/lxy030988/react-template HEAD~1 HEAD
```

### 2. 审查最近 3 次提交

```bash
pnpm start /Users/lxy/Desktop/lxy030988/react-template HEAD~3 HEAD
```

### 3. 审查特定 commit 范围

```bash
# 先查看 commit 历史
cd /Users/lxy/Desktop/lxy030988/react-template
git log --oneline -5

# 审查指定范围
cd /Users/lxy/Desktop/lxy030988/ai-codereview-agent
pnpm start \
  /Users/lxy/Desktop/lxy030988/react-template \
  abc123 \
  def456
```

### 4. 带 GitHub PR 评论

```bash
export GITHUB_TOKEN=your_token

pnpm start \
  /Users/lxy/Desktop/lxy030988/react-template \
  main \
  feature-branch \
  lxy030988 \
  react-template \
  42
```

## ⚙️ 环境变量

确保 `.env.development` 中有：

```
DEEPSEEK_API_KEY=sk-xxxxx
GITHUB_TOKEN=ghp_xxxxx  # 可选，用于 PR 评论
```

## ✅ 验证

运行后应该看到：

```
🔍 Starting AI Code Review...

📁 Repository: /Users/lxy/Desktop/lxy030988/react-template
📊 Reviewing: HEAD~1 → HEAD

[AI 审查结果...]

✅ Review completed!
```
