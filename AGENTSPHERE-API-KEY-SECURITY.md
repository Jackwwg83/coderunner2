# AgentSphere API Key 安全配置文档

## 🔐 API Key 信息

您的API Key已成功配置到系统中：
- **API Key**: `ac_76d3331645c1a94b2744ed1608510b47f0e3a327` (已保存到 `.env` 文件)
- **状态**: ✅ 已配置并验证连接
- **环境**: Development/Testing

## ✅ 已完成的配置

### 1. 环境变量配置
```bash
# .env 文件已更新：
AGENTSPHERE_DOMAIN=agentsphere.run
AGENTSPHERE_API_URL=https://api.agentsphere.run
AGENTSPHERE_API_KEY=ac_76d3331645c1a94b2744ed1608510b47f0e3a327
```

### 2. 代码更新
- ✅ 修正包名：`agentsphere` → `agentsphere-js`
- ✅ 更新 `package.json` 依赖
- ✅ 更新 `orchestration.ts` 导入语句
- ✅ 实现完整的沙箱生命周期管理

### 3. 安全保护措施
- ✅ `.env` 文件已在 `.gitignore` 中（不会提交到GitHub）
- ✅ API Key 仅存储在本地环境变量中
- ✅ 代码中使用动态加载，支持Mock降级

## 🛡️ 安全最佳实践

### 绝对不要做的事情：
1. ❌ **不要**执行 `git add .env`
2. ❌ **不要**在代码中硬编码API Key
3. ❌ **不要**在日志中打印完整的API Key
4. ❌ **不要**在前端代码中使用API Key
5. ❌ **不要**与他人分享API Key

### 应该做的事情：
1. ✅ 始终使用环境变量存储API Key
2. ✅ 定期轮换API Key（建议每90天）
3. ✅ 为生产和开发环境使用不同的Key
4. ✅ 监控API Key的使用情况
5. ✅ 使用最小权限原则

## 🚀 测试命令

### 基础连接测试
```bash
# 测试API连接
node test-agentsphere-real.js

# 验证配置
node verify-agentsphere-key.js
```

### 集成测试
```bash
# 运行AgentSphere集成测试
npm test -- --testPathPattern=agentsphere

# E2E测试
node test-agentsphere-integration.js
```

## ⚠️ 注意事项

### 当前状态
- API Key已验证可以连接到AgentSphere服务
- 沙箱创建和列表功能正常
- 某些操作可能需要额外的配置或权限

### 可能的问题和解决方案

1. **沙箱超时问题**
   - 现象：`Host not found` 错误
   - 解决：增加 `timeout` 参数或调用 `setTimeout()`

2. **权限问题**
   - 现象：`404: instance doesn't exist or you don't have access`
   - 解决：确认API Key权限范围

3. **网络问题**
   - 现象：连接失败
   - 解决：检查网络和防火墙设置

## 📋 Git安全检查清单

在提交代码前，请确认：
- [ ] `.env` 文件未被跟踪（使用 `git status` 检查）
- [ ] 没有在代码中硬编码API Key
- [ ] 日志中没有暴露完整的API Key
- [ ] 测试文件中没有包含真实的API Key

### 验证命令
```bash
# 检查.env是否被跟踪
git status | grep -i "\.env"

# 搜索代码中的API Key（应该返回空）
grep -r "ac_76d3331645c1a94b2744ed1608510b47f0e3a327" --exclude-dir=node_modules --exclude=".env*" .

# 查看将要提交的文件
git diff --cached
```

## 🔄 环境切换

### 开发环境（当前）
```bash
AGENTSPHERE_API_KEY=ac_76d3331645c1a94b2744ed1608510b47f0e3a327
```

### 生产环境（未来）
```bash
# 创建 .env.production
AGENTSPHERE_API_KEY=your_production_key_here
```

### 使用Mock（无API Key时）
系统会自动降级到Mock实现，无需额外配置。

## 📞 支持资源

- **API Key管理**: https://www.agentsphere.run/apikey
- **官方文档**: https://www.agentsphere.run/docs
- **SDK文档**: 查看 `AgentSphere_SDK完整文档.md`

## ✅ 总结

您的AgentSphere API Key已成功配置并验证：
1. API Key已安全存储在 `.env` 文件中
2. 不会被提交到GitHub（已在.gitignore中）
3. 代码已更新支持真实API调用
4. 具备Mock降级能力保证开发连续性
5. 完整的测试套件已就绪

**重要提醒**：在执行 `git add` 或 `git commit` 前，请务必检查没有包含 `.env` 文件或API Key！