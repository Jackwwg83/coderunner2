# 端口使用规则 / Port Usage Rules

## ⚠️ 重要：端口冲突避免规则

### 禁用端口范围
**3000-3009** - 这些端口已被服务器上其他服务占用，严禁使用

### CodeRunner v2.0 端口分配

#### 主服务端口
- **API Server**: `8080` (主API服务)
- **WebSocket**: `8081` (实时通信)
- **Metrics**: `9090` (Prometheus指标)
- **Health Check**: `8082` (健康检查端点)

#### 开发和测试端口
- **Development API**: `8080`
- **Test API**: `8088` 
- **Frontend Dev**: `8090`
- **Documentation**: `8095`

#### 监控服务端口
- **Prometheus**: `9090`
- **Grafana**: `9091`
- **InfluxDB**: `8086`

### 环境变量配置
```bash
# .env 文件
PORT=8080                    # 主服务端口
WEBSOCKET_PORT=8081         # WebSocket端口
METRICS_PORT=9090           # 指标端口
HEALTH_PORT=8082            # 健康检查端口

# 测试环境
TEST_PORT=8088              # 测试服务端口
TEST_BASE_URL=http://localhost:8088
```

### Agent开发规范

所有agents在开发和测试时必须遵循以下规则：

1. **禁止使用3000-3009端口**
2. **优先使用8080-8099范围**
3. **测试使用8088端口**
4. **前端开发使用8090端口**
5. **始终通过环境变量配置端口**

### 端口检查命令
```bash
# 检查端口占用
lsof -i :8080
netstat -tulpn | grep 8080
ss -tulpn | grep 8080

# 查找可用端口
for port in {8080..8099}; do
  if ! lsof -i :$port > /dev/null 2>&1; then
    echo "Port $port is available"
    break
  fi
done
```

### 更新记录
- 2024-01-XX: 初始规则制定，禁用3000-3009端口范围
- CodeRunner v2.0 默认端口从3000改为8080

---
**注意**: 此规则适用于所有开发、测试和生产环境。违反端口规则可能导致服务冲突。