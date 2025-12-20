# GitHub Actions CI 配置说明

## ✅ 配置完成

AI Code Review 的 GitHub Actions workflow 已配置完成，位于：
- `/Users/lxy/Desktop/lxy030988/react-template/.github/workflows/ai-code-review.yml`

---

## 🔧 关键配置点

### 1. 触发条件
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
```
- PR 创建时触发
- PR 更新（新 commit）时触发
- PR 重新打开时触发

### 2. 权限设置
```yaml
permissions:
  contents: read        # 读取代码
  pull-requests: write  # 写 PR 评论
```

### 3. Node.js 版本
- **Node 24** - 与本地开发环境一致
- 使用 pnpm 10 作为包管理器

### 4. Mastra 服务器启动
**关键步骤**：
```yaml
- name: Start Mastra Dev Server
  run: |
    pnpm run dev &
    # 等待服务器启动（最多 60 秒）
    for i in {1..30}; do
      if curl -s http://localhost:4111/api/agents > /dev/null; then
        echo "✅ Mastra server is ready"
        break
      fi
      sleep 2
    done
```

### 5. 环境变量
```yaml
- name: Create Environment File
  run: |
    echo "DEEPSEEK_API_KEY=${{ secrets.DEEPSEEK_API_KEY }}" > .env.development
```

### 6. CLI 执行
```yaml
node src/cli.js \
  ${{ github.workspace }} \
  ${{ github.event.pull_request.base.sha }} \
  ${{ github.event.pull_request.head.sha }} \
  ${{ github.repository_owner }} \
  ${{ github.event.repository.name }} \
  ${{ github.event.pull_request.number }}
```

---

## 📝 必需的 GitHub Secrets

在仓库设置中添加：

### Settings → Secrets and variables → Actions

1. **DEEPSEEK_API_KEY**
   - 你的 DeepSeek API 密钥
   - 格式：`sk-xxxxxxxxxxxxx`

2. **GITHUB_TOKEN**
   - ✅ 自动提供，无需手动配置
   - 用于发布 PR 评论

---

## 🚀 使用流程

### 1. 推送 Agent 代码到 GitHub
```bash
cd /Users/lxy/Desktop/lxy030988/ai-codereview-agent
git add .
git commit -m "feat: AI code review agent"
git push origin main
```

### 2. 在 react-template 中配置 Secret
1. 访问 https://github.com/lxy030988/react-template/settings/secrets/actions
2. 点击 "New repository secret"
3. 添加 `DEEPSEEK_API_KEY`

### 3. 推送 workflow 配置
```bash
cd /Users/lxy/Desktop/lxy030988/react-template
git add .github/workflows/ai-code-review.yml
git commit -m "feat: add AI code review workflow"
git push origin main
```

### 4. 创建测试 PR
```bash
git checkout -b test/ai-review
echo "// Test AI review" >> src/App.tsx
git add .
git commit -m "test: AI review"
git push origin test/ai-review
# 然后在 GitHub 上创建 PR
```

---

## ⚠️ 注意事项

### 1. Agent 仓库地址
确保 workflow 中的仓库地址正确：
```yaml
git clone https://github.com/lxy030988/ai-codereview-agent.git
```

### 2. 服务器启动时间
- Mastra 服务器需要时间启动
- 配置了 60 秒超时（30 次 × 2 秒）
- 如果启动失败，检查依赖安装

### 3. API 调用限制
- DeepSeek API 有调用限制
- 大型 PR 可能需要更长时间
- 考虑添加超时设置

### 4. 成本控制
- 每次 PR 都会调用 AI
- 建议只在重要分支启用
- 可以添加条件判断

---

## 🔍 故障排查

### 问题 1: Mastra 服务器启动失败
**检查**：
- 依赖是否正确安装
- Node.js 版本是否正确（24+）
- `.env.development` 文件是否创建

### 问题 2: API Key 无效
**检查**：
- Secret 是否正确配置
- Key 格式是否正确
- DeepSeek 账户是否有余额

### 问题 3: 无法发布评论
**检查**：
- `pull-requests: write` 权限是否设置
- `GITHUB_TOKEN` 是否可用
- PR 是否来自 fork（fork PR 权限受限）

### 问题 4: 审查超时
**解决**：
- 增加服务器启动等待时间
- 检查 diff 大小
- 考虑分批处理大型 PR

---

## 📊 预期结果

### 成功运行后：
1. ✅ Workflow 显示绿色勾
2. ✅ PR 中出现 AI 评论
3. ✅ 评论包含：
   - 🔴 高优先级问题
   - 🟡 中优先级问题
   - 💡 改进建议
   - ✅ 优秀实践

### 评论格式：
```markdown
## 🤖 AI Code Review

[审查内容]

---
*Powered by DeepSeek AI*
```

---

## 🎯 下一步优化

1. **添加条件触发** - 只在特定分支或文件变更时运行
2. **缓存优化** - 缓存 node_modules 加速构建
3. **并行处理** - 大型 PR 分批审查
4. **自定义规则** - 根据项目类型调整审查重点
5. **质量门禁** - 高优先级问题阻止合并

---

**配置状态**: ✅ 完成，可以投入使用
