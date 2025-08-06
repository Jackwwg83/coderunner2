# 📚 CodeRunner 项目文档中心

> **精简至10个核心文档**，清晰的角色分工，高效的协作流程

## 🎉 项目状态: 100% Ready for Development!
✅ 设计验证完成 | ✅ AgentSphere SDK集成 | ✅ Manifest框架支持  

### 📚 关键文档
- **[设计验证报告](DESIGN_VALIDATION_REPORT.md)** - 100%可行性确认
- **[Day 1准备清单](DAY1_READINESS_CHECK.md)** - 开发前检查
- **[Day 1执行清单](DAY1_EXECUTION_CHECKLIST.md)** - 详细执行步骤

## 🚀 快速开始

### 人类产品经理
👉 **直接看 [HUMAN_DAILY_GUIDE.md](HUMAN_DAILY_GUIDE.md)**
- 第一页可打印作为每日速查卡
- 包含所有你需要知道的内容

### Claude Code（AI协调者）  
👉 **直接看 [AI_ORCHESTRATOR_GUIDE.md](AI_ORCHESTRATOR_GUIDE.md)**
- 明确你的协调者角色
- Task tool使用方法
- 标准工作流程

---

## 📂 文档体系（10个文档）

### 🧑 人类专用文档（2个）

| 文档 | 说明 | 使用频率 |
|------|------|----------|
| **[HUMAN_DAILY_GUIDE.md](HUMAN_DAILY_GUIDE.md)** | 每日操作完整指南 | 每天 |
| **[DAILY_COMMANDS.md](DAILY_COMMANDS.md)** | 20天开发命令列表 | 每天 |

### 🤖 AI专用文档（4个）

| 文档 | 说明 | 何时读取 |
|------|------|----------|
| **[AI_ORCHESTRATOR_GUIDE.md](AI_ORCHESTRATOR_GUIDE.md)** | Claude Code协调指南 | 每次会话开始 |
| **[01-system-design.md](01-system-design.md)** | 系统架构+模块设计 | 实现模块时 |
| **[02-database-api.md](02-database-api.md)** | 数据库+API规范 | 实现接口时 |
| **[03-subagent-tasks.md](03-subagent-tasks.md)** | Subagent任务分配 | 分配任务时 |

### 🤝 协作桥梁文档（4个）

| 文档 | 维护者 | 更新时机 | 作用 |
|------|--------|----------|------|
| **[CONTEXT.md](CONTEXT.md)** | 👤人类 | 每天早上 | 项目状态和核心决策 |
| **[DECISIONS.md](DECISIONS.md)** | 👤人类 | 有决策时 | 重要决策记录 |
| **[QUESTIONS.md](QUESTIONS.md)** | 🤖AI问/👤人类答 | 随时 | 疑问和解答 |
| **[PROGRESS.md](PROGRESS.md)** | 🤖AI | 任务完成时 | 详细进度跟踪 |

> 注：HANDOVER.md会在上下文快满时自动生成，不计入常规文档

---

## 🎯 角色职责一览

### 👤 人类产品经理
```yaml
决策: 业务逻辑、技术选型、优先级
提供: API密钥、业务规则、缺失信息
控制: 模型使用（Opus/Sonnet）、预算
每天: 10分钟准备 + 5分钟收尾
```

### 🤖 Claude Code（协调者）
```yaml
理解: 解析人类需求
分解: 拆分为可执行任务
调用: Task tool召唤Subagent
跟踪: 更新PROGRESS.md
提问: 不确定写QUESTIONS.md
```

### 🔧 Subagents（5个专家）
```yaml
rapid-prototyper: 快速MVP、原型
backend-architect: 架构设计、核心服务
frontend-developer: React UI开发
devops-automator: Docker、CI/CD
test-writer-fixer: 测试编写
```

---

## 📋 每日工作流程

### 早上（人类10分钟）
1. 查看 `PROGRESS.md` - 昨日进度
2. 回答 `QUESTIONS.md` - AI的疑问
3. 更新 `CONTEXT.md` - 项目状态
4. 复制 `DAILY_COMMANDS.md` - 今日命令
5. 启动Claude Code

### 工作中（协作）
- **人类**：做决策、答疑、控制成本
- **Claude Code**：理解→分解→调用→跟踪
- **Subagents**：执行具体编码任务

### 晚上（人类5分钟）
1. Review `PROGRESS.md`
2. Git提交
3. 记录决策到 `DECISIONS.md`

---

## 💰 成本控制

| 模型 | 成本 | 使用场景 | 标记 |
|------|------|----------|------|
| **Sonnet** | $3/小时 | 90%日常任务 | 默认 |
| **Opus** | $15/小时 | 10%关键任务 | ⚠️ |

**总预算**: $672（20天）
- Opus: $240 (16小时)
- Sonnet: $432 (144小时)

---

## 🎯 项目信息

### 产品定位
**CodeRunner** - AI代码即时部署平台，解决"代码写好了往哪跑"的问题

### 技术栈
- 后端：Node.js + TypeScript + Express
- 前端：React 18 + TypeScript + TailwindCSS  
- 数据库：PostgreSQL + Redis
- 部署：Docker + Kubernetes
- 沙箱：AgentSphere

### 开发计划
- **Week 1**: MVP基础（API、认证、部署）
- **Week 2**: 核心功能（完整服务）
- **Week 3**: 增强功能（Manifest、监控）
- **Week 4**: 生产就绪（优化、部署）

---

## ❓ 常见问题

### Q: 文档太多看不过来？
**A**: 人类只需看2个文档（HUMAN_DAILY_GUIDE + DAILY_COMMANDS）

### Q: Claude Code不知道怎么工作？
**A**: 读AI_ORCHESTRATOR_GUIDE.md，记住用Task tool

### Q: 不知道今天做什么？
**A**: 看DAILY_COMMANDS.md对应Day X

### Q: AI开始"脑补"了？
**A**: 立即纠正，让它查看QUESTIONS.md

### Q: 上下文丢失了？
**A**: 读CONTEXT.md + PROGRESS.md恢复

---

## ✅ 准备清单

开发前确认：
- [ ] 已读HUMAN_DAILY_GUIDE.md
- [ ] 已更新CONTEXT.md日期
- [ ] 已准备今日命令
- [ ] 了解Opus使用时机
- [ ] AgentSphere API密钥准备好

---

## 📞 支持

- **文档问题**：更新相应文档
- **决策问题**：记录到DECISIONS.md
- **技术问题**：写入QUESTIONS.md
- **进度问题**：查看PROGRESS.md

---

**记住核心原则**：
- 人类决策，AI执行
- Claude Code协调，Subagent实现
- 文档桥接，保持同步
- MVP优先，快速迭代

祝开发顺利！🚀