# 📋 CodeRunner v2.0 每日操作文档

**创建日期**: 2025-08-07  
**项目阶段**: Phase 1 MVP 开发

## 🌅 每日开始流程

### 1. 状态检查 (5分钟)
```bash
# 检查测试状态
npm test

# 检查代码覆盖率
npm run test:coverage

# 检查Git状态
git status
```

### 2. 读取核心文档 (10分钟)
- [ ] 查看 `PROJECT_IMPLEMENTATION_STATUS.md` 了解当前进度
- [ ] 查看 `03-subagent-tasks.md` 确认待办任务
- [ ] 查看 `QUESTIONS.md` 检查待解决问题

### 3. 任务规划 (5分钟)
- [ ] 使用 TodoWrite 工具更新任务列表
- [ ] 确定今日优先级任务
- [ ] 分配 SubAgent

## 💼 开发工作流程

### 任务执行模板
对于每个任务：

1. **任务准备**
   ```
   - 阅读任务描述 (03-subagent-tasks.md)
   - 确认前置依赖已完成
   - 准备任务上下文
   ```

2. **SubAgent 调用**
   ```
   使用 Task 工具调用合适的 SubAgent:
   - backend-architect: 后端服务、API设计
   - rapid-prototyper: 快速原型、工具开发  
   - test-writer-fixer: 测试编写和修复
   - test-results-analyzer: 测试结果分析
   ```

3. **质量检查**
   ```bash
   # 运行相关测试
   npm test -- [相关测试文件]
   
   # 检查类型
   npm run type-check
   
   # 代码格式化
   npm run format
   ```

4. **文档更新** ⭐ **重要**
   ```
   更新 PROJECT_IMPLEMENTATION_STATUS.md:
   - 任务状态 (pending → in_progress → completed)
   - 完成百分比
   - 新增文件列表
   - 测试覆盖率变化
   - 技术决策记录
   ```

## 📊 状态报告模板

### 每日开始报告
```markdown
## Day [N] 状态报告

**日期**: 2025-08-XX
**当前阶段**: Phase [X]

### 昨日完成
- ✅ [任务名称]: [简要描述]

### 今日计划  
- 🎯 [任务ID]: [任务描述]
  - SubAgent: [指定的agent]
  - 预计时间: [X小时]

### 阻塞问题
- ⚠️ [问题描述] - 需要决策/澄清
```

### 任务完成报告
```markdown
## 任务完成: [任务ID]

**执行者**: [SubAgent名称]
**用时**: [实际时间]

### 实现内容
- [功能点1]
- [功能点2]

### 文件变更
- 新增: [文件列表]
- 修改: [文件列表]

### 测试结果
- 测试用例: X个
- 通过率: X%
- 覆盖率变化: X% → Y%

### 技术决策
- [决策1]: [原因]
```

## 🔄 文档更新检查清单

每次完成任务后，更新 `PROJECT_IMPLEMENTATION_STATUS.md`:

### 必须更新的部分
- [ ] **任务状态**: pending → completed
- [ ] **总体进度**: 更新百分比
- [ ] **最后更新时间**: 更新为当前时间
- [ ] **功能列表**: 添加新实现的功能
- [ ] **文件清单**: 添加新创建的文件
- [ ] **测试覆盖率**: 更新最新数值
- [ ] **更新日志**: 添加今日完成项

### 可选更新
- [ ] API端点清单 (如有新增)
- [ ] 技术债务 (如发现新问题)
- [ ] 性能指标 (如有测量)
- [ ] 依赖更新 (如有变化)

## 🚀 常用命令速查

### 开发命令
```bash
# 启动开发服务器
npm run dev

# 运行测试
npm test
npm test -- --watch  # 监视模式
npm test -- [文件路径]  # 测试特定文件

# 测试覆盖率
npm run test:coverage

# 类型检查
npm run type-check

# 代码格式化
npm run format

# 构建项目
npm run build
```

### Git 操作
```bash
# 查看状态
git status

# 添加和提交
git add .
git commit -m "[类型]: [描述]"

# 推送到远程
git push origin main

# 查看日志
git log --oneline -10
```

### 数据库操作
```bash
# 运行迁移
npm run migrate

# 重置数据库
npm run db:reset

# 查看数据库
psql -U postgres -d coderunner
```

## 🎯 Phase 1 剩余任务追踪

### 高优先级 (今日)
- [ ] P1-T03: 重构 OrchestrationService
  - 集成 ProjectAnalyzer ✅
  - 集成 ManifestEngine ✅
  - 实现部署流程

### 中优先级 (明日)
- [ ] P1-T04: 创建 /deploy API 端点
  - 路由实现
  - 文件上传处理
  - 错误处理

### 低优先级 (后天)
- [ ] P1-T05: 编写集成测试
  - Manifest 端到端测试
  - Node.js 端到端测试
  - 部署验证

## 📝 注意事项

### 关键原则
1. **所有代码必须通过 SubAgent 编写** - 不要直接编码
2. **严格遵循设计文档** - 不做假设
3. **有疑问必须提出** - 写入 QUESTIONS.md
4. **保持文档同步** - 每次完成都更新状态文档

### 质量标准
- 测试覆盖率 > 60%
- 所有测试必须通过
- TypeScript 无类型错误
- 遵循项目代码规范

### 时间管理
- 每个任务预估时间 2-4 小时
- 复杂任务可分解为子任务
- 及时报告阻塞问题
- 保持进度透明

## 🔔 每日结束流程

### 1. 代码提交 (10分钟)
```bash
# 运行测试确保无错误
npm test

# 提交代码
git add .
git commit -m "Day [N]: [今日主要成果]"
git push origin main
```

### 2. 文档更新 (10分钟)
- [ ] 更新 `PROJECT_IMPLEMENTATION_STATUS.md`
- [ ] 更新任务状态 (TodoWrite)
- [ ] 记录技术决策
- [ ] 更新测试覆盖率

### 3. 明日准备 (5分钟)
- [ ] 列出明日任务
- [ ] 标记阻塞问题
- [ ] 准备需要的资源

## 📌 快速参考

### SubAgent 职责
- **backend-architect**: 系统设计、服务实现、API开发
- **rapid-prototyper**: 工具开发、快速验证、原型实现
- **test-writer-fixer**: 测试编写、测试修复、覆盖率提升
- **test-results-analyzer**: 测试分析、问题诊断、优化建议

### 文件路径
- 源代码: `src/`
- 测试代码: `tests/`
- 设计文档: `./`根目录
- 配置文件: `./`根目录

### 环境变量
- 数据库: `DATABASE_URL`, `DB_*`
- AgentSphere: `AGENTSPHERE_API_KEY`
- JWT: `JWT_SECRET`, `JWT_EXPIRY`
- 服务器: `PORT`, `NODE_ENV`

---

**记住**: 保持文档实时更新是项目成功的关键！每完成一个任务，立即更新 `PROJECT_IMPLEMENTATION_STATUS.md`。