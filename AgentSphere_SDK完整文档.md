# AgentSphere SDK 完整文档

## 📖 目录

1. [简介](#简介)
2. [快速开始](#快速开始)
3. [沙箱生命周期管理](#沙箱生命周期管理)
4. [元数据管理](#元数据管理)
5. [环境变量](#环境变量)
6. [沙箱列表与过滤](#沙箱列表与过滤)
7. [连接到已有沙箱](#连接到已有沙箱)
8. [网络访问](#网络访问)
9. [命令执行](#命令执行)
10. [文件系统操作](#文件系统操作)

---

## 简介

**AgentSphere** 是一个安全的运行时基础设施，专为在隔离的云沙箱中执行 AI 生成的代码而设计。内置对 Python 和 JavaScript/TypeScript SDK 的支持，开发者可以轻松地以编程方式启动和管理沙箱环境。

### 核心特性

- **隔离沙箱**: 每个 AgentSphere 沙箱都作为一个轻量级的隔离虚拟机运行
- **快速启动**: 启动时间低至 150 毫秒
- **并行运行**: 可以同时启动多个沙箱，每个 AI 代理、LLM 会话或用户交互分配一个
- **多语言支持**: 内置 Python 和 JavaScript/TypeScript 支持

### 典型用例

- AI 驱动的数据分析和可视化
- 执行多种语言的 AI 生成代码
- 代码生成模型的测试和评估
- 作为基于代理的应用程序或完整 AI 生成应用的运行时

---

## 快速开始

### 1. 环境配置

首先需要获取 API 密钥并设置环境变量：

1. [注册](https://www.agentsphere.run/) 并访问 [AgentSphere API Key](https://www.agentsphere.run/apikey) 页面
2. 点击 **CREATE KEY** 按钮创建新的 API 密钥
3. 将 API 密钥添加到 `.env` 文件中

```bash
export AGENTSPHERE_DOMAIN='agentsphere.run'
export AGENTSPHERE_API_KEY='your-api-key'
```

### 2. 安装 SDK

**Python 安装**:
```bash
pip install agentsphere python-dotenv
```

**JavaScript/TypeScript 安装**:
```bash
npm install agentsphere
```

### 3. 第一个示例

**Python 示例**:
```python
from dotenv import load_dotenv
load_dotenv()
from agentsphere import Sandbox

# 创建沙箱（默认存活 5 分钟）
sbx = Sandbox()

# 在沙箱中执行 Python 代码
execution = sbx.run_code("print('hello world')")
print(execution.logs)

# 列出根目录下的所有文件
files = sbx.files.list("/")
print(files)
```

**JavaScript/TypeScript 示例**:
```javascript
import { Sandbox } from 'agentsphere';

const sandbox = new Sandbox();

// 执行代码
const execution = await sandbox.runCode("console.log('hello world')");
console.log(execution.logs);

// 列出文件
const files = await sandbox.files.list("/");
console.log(files);
```

---

## 沙箱生命周期管理

### 设置沙箱超时时间

默认情况下，沙箱启动后会存活 5 分钟，然后自动关闭。

**Python**:
```python
from agentsphere import Sandbox

# 创建一个存活 60 秒的沙箱
sandbox = Sandbox(timeout=60)
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

// 创建一个存活 60 秒的沙箱
const sandbox = new Sandbox({ timeout: 60 });
```

### 运行时修改超时时间

可以在沙箱运行过程中修改超时时间：

**Python**:
```python
from agentsphere import Sandbox

# 创建沙箱，存活 60 秒
sandbox = Sandbox(timeout=60)

# 将超时时间改为 30 秒（从现在开始计算）
sandbox.set_timeout(30)
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

const sandbox = new Sandbox({ timeout: 60 });

// 修改超时时间为 30 秒
await sandbox.setTimeout(30);
```

### 获取沙箱信息

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox(timeout=60)

# 获取沙箱信息
info = sandbox.get_info()
print(info)

# 输出示例:
# SandboxInfo(sandbox_id='ig6f1yt6idvxkxl562scj-419ff533',
#   template_id='u7nqkmpn3jjf1tvftlsu',
#   name='base',
#   metadata={},
#   started_at=datetime.datetime(2025, 3, 24, 15, 42, 59, 255612, tzinfo=tzutc()),
#   end_at=datetime.datetime(2025, 3, 24, 15, 47, 59, 255612, tzinfo=tzutc())
# )
```

### 关闭沙箱

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox(timeout=60)

# 立即关闭沙箱
sandbox.kill()
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

const sandbox = new Sandbox({ timeout: 60 });

// 立即关闭沙箱
await sandbox.kill();
```

---

## 元数据管理

元数据是附加到沙箱的任意键值对，可用于：
- 将沙箱与用户会话关联
- 存储沙箱的自定义用户数据（如 API 密钥）
- 将沙箱与用户 ID 关联，以便稍后连接

### 指定元数据

**Python**:
```python
from agentsphere import Sandbox

# 创建带有元数据的沙箱
sandbox = Sandbox(
    metadata={
        'userId': '123',
        'sessionId': 'abc-def-ghi',
        'environment': 'development'
    },
)

# 列出运行中的沙箱并访问元数据
running_sandboxes = Sandbox.list()
print(running_sandboxes[0].metadata)
# 输出: {'userId': '123', 'sessionId': 'abc-def-ghi', 'environment': 'development'}
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

// 创建带有元数据的沙箱
const sandbox = new Sandbox({
    metadata: {
        userId: '123',
        sessionId: 'abc-def-ghi',
        environment: 'development'
    }
});

// 列出运行中的沙箱并访问元数据
const runningSandboxes = await Sandbox.list();
console.log(runningSandboxes[0].metadata);
```

---

## 环境变量

### 默认环境变量

创建沙箱时，会自动设置环境变量 `AGENTSPHERE_SANDBOX=true`。

**Python**:
```python
from dotenv import load_dotenv
load_dotenv()
from agentsphere import Sandbox
import time

sbx = Sandbox(envs={
    "AGENTSPHERE_SANDBOX": "true",
    "CUSTOM_VAR": "custom_value"
})
time.sleep(1)

result = sbx.commands.run("echo $AGENTSPHERE_SANDBOX")
print(result)
# 输出: CommandResult(stderr='', stdout='true\n', exit_code=0, error='')
```

### 自定义环境变量

**Python**:
```python
from agentsphere import Sandbox

# 创建带有自定义环境变量的沙箱
sandbox = Sandbox(
    envs={
        "API_KEY": "your-api-key",
        "ENVIRONMENT": "production",
        "DEBUG": "false"
    }
)

# 验证环境变量
result = sandbox.commands.run("echo $API_KEY")
print(result.stdout)  # 输出: your-api-key
```

---

## 沙箱列表与过滤

### 列出所有沙箱

**Python**:
```python
from agentsphere import Sandbox

# 创建沙箱
sandbox = Sandbox(
    metadata={
        'name': 'My Sandbox',
    },
)

# 列出所有运行中的沙箱
running_sandboxes = Sandbox.list()
running_sandbox = running_sandboxes[0]

print('Running sandbox metadata:', running_sandbox.metadata)
print('Running sandbox id:', running_sandbox.sandbox_id)
print('Running sandbox started at:', running_sandbox.started_at)
print('Running sandbox template id:', running_sandbox.template_id)
```

### 按元数据过滤沙箱

**Python**:
```python
from agentsphere import Sandbox
from agentsphere_base.sandbox.sandbox_api import SandboxQuery

# 创建带有元数据的沙箱
sandbox = Sandbox(
    metadata={
        "env": "dev",
        "app": "my-app",
        "userId": "123",
    },
)

# 筛选同时满足多个条件的沙箱
running_sandboxes = Sandbox.list(
    query=SandboxQuery(
        metadata={
            "userId": "123",
            "env": "dev",
        }
    ),
)
```

### 按状态过滤沙箱

**Python**:
```python
from agentsphere import Sandbox, SandboxListQuery

# 列出运行中或暂停的沙箱
paginator = Sandbox.list(
    query=SandboxListQuery(
        state=['running', 'paused'],
    ),
)

# 获取第一页沙箱
sandboxes = paginator.next_items()
```

### 分页查询

**Python**:
```python
from agentsphere import Sandbox, SandboxListQuery

# 设置分页参数
paginator = Sandbox.list(
    limit=1000,  # 每页最多 1000 个（默认值和最大值）
    next_token='<base64-encoded-token>',  # 分页令牌
)

# 检查是否有下一页
print(paginator.has_next)

# 获取下一页令牌
print(paginator.next_token)

# 获取下一页数据
next_page = paginator.next_items()
```

**遍历所有页面**:
```python
from agentsphere import Sandbox

paginator = Sandbox.list()

# 循环遍历所有页面
sandboxes = []
while paginator.has_next:
    items = paginator.next_items()
    sandboxes.extend(items)

print(f"Total sandboxes: {len(sandboxes)}")
```

---

## 连接到已有沙箱

如果有一个正在运行的沙箱实例，并且想要在短暂的非活动期后为同一用户重用它，可以连接到该沙箱。

### 获取沙箱 ID

**Python**:
```python
from agentsphere import Sandbox

# 获取所有运行中的沙箱
running_sandboxes = Sandbox.list()

if len(running_sandboxes) == 0:
    raise Exception("No running sandboxes found")

# 获取要连接的沙箱 ID
sandbox_id = running_sandboxes[0].sandbox_id
```

### 连接到沙箱

**Python**:
```python
from agentsphere import Sandbox

# 获取所有运行中的沙箱
running_sandboxes = Sandbox.list()

if len(running_sandboxes) == 0:
    raise Exception("No running sandboxes found")

sandbox_id = running_sandboxes[0].sandbox_id

# 连接到沙箱
sandbox = Sandbox.connect(sandbox_id)

# 现在可以像往常一样使用沙箱
execution = sandbox.run_code("print('Connected to existing sandbox!')")
print(execution.logs)
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

// 获取运行中的沙箱
const runningSandboxes = await Sandbox.list();

if (runningSandboxes.length === 0) {
    throw new Error("No running sandboxes found");
}

const sandboxId = runningSandboxes[0].sandboxId;

// 连接到沙箱
const sandbox = await Sandbox.connect(sandboxId);

// 使用连接的沙箱
const execution = await sandbox.runCode("console.log('Connected!')");
console.log(execution.logs);
```

---

## 网络访问

每个沙箱都可以访问互联网，并且可以通过公共 URL 访问。

### 获取沙箱公共 URL

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 获取端口 3000 的公共访问地址
host = sandbox.get_host(3000)
url = f'https://{host}'
print(url)
# 输出: https://3000-UID.agentsphere.run
```

### 在沙箱内运行服务器

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 在沙箱内启动简单的 HTTP 服务器
process = sandbox.commands.run("python -m http.server 3000", background=True)

# 获取服务器的公共 URL
host = sandbox.get_host(3000)
url = f"https://{host}"
print('Server started at:', url)

# 从沙箱内的服务器获取数据
response = sandbox.commands.run(f"curl {url}")
data = response.stdout
print("Response from server inside sandbox:", data)

# 停止服务器进程
process.kill()
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

const sandbox = new Sandbox();

// 启动 HTTP 服务器
const process = await sandbox.commands.run("python -m http.server 3000", { background: true });

// 获取公共 URL
const host = sandbox.getHost(3000);
const url = `https://${host}`;
console.log('Server started at:', url);

// 测试服务器
const response = await sandbox.commands.run(`curl ${url}`);
console.log("Response:", response.stdout);

// 停止服务器
await process.kill();
```

---

## 命令执行

### 运行基本命令

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 执行命令
result = sandbox.commands.run('ls -l')
print(result)
print("Exit code:", result.exit_code)
print("Stdout:", result.stdout)
print("Stderr:", result.stderr)
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

const sandbox = new Sandbox();

// 执行命令
const result = await sandbox.commands.run('ls -l');
console.log(result);
console.log("Exit code:", result.exitCode);
console.log("Stdout:", result.stdout);
console.log("Stderr:", result.stderr);
```

### 流式输出

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 流式输出命令结果
result = sandbox.commands.run(
    'echo hello; sleep 1; echo world',
    on_stdout=lambda data: print(f"STDOUT: {data}"),
    on_stderr=lambda data: print(f"STDERR: {data}")
)
print("Final result:", result)
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

const sandbox = new Sandbox();

// 流式输出
const result = await sandbox.commands.run(
    'echo hello; sleep 1; echo world',
    {
        onStdout: (data) => console.log(`STDOUT: ${data}`),
        onStderr: (data) => console.log(`STDERR: ${data}`)
    }
);
console.log("Final result:", result);
```

### 后台运行命令

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 在后台启动命令
command = sandbox.commands.run('echo hello; sleep 10; echo world', background=True)

# 从后台运行的命令获取输出
for stdout, stderr, _ in command:
    if stdout:
        print("STDOUT:", stdout)
    if stderr:
        print("STDERR:", stderr)

# 终止命令
command.kill()
```

**JavaScript/TypeScript**:
```javascript
import { Sandbox } from 'agentsphere';

const sandbox = new Sandbox();

// 后台运行命令
const command = await sandbox.commands.run('echo hello; sleep 10; echo world', { background: true });

// 监听输出
command.on('stdout', (data) => console.log('STDOUT:', data));
command.on('stderr', (data) => console.log('STDERR:', data));

// 终止命令
await command.kill();
```

---

## 文件系统操作

每个 AgentSphere 沙箱都有自己的隔离文件系统，支持以下操作：

### 读写文件

**读取文件**:

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 读取文件内容
file_content = sandbox.files.read('/path/to/file')
print(file_content)
```

**写入单个文件**:

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 写入文件
sandbox.files.write('/path/to/file.txt', 'file content')
```

**写入多个文件**:

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 批量写入文件
files_to_write = [
    {"path": "/path/to/a.txt", "data": "content A"},
    {"path": "/another/path/to/b.txt", "data": "content B"}
]

sandbox.files.write(files_to_write)
```

### 监控目录变化

**Python**:
```python
from agentsphere import Sandbox
from agentsphere import FilesystemEventType

sandbox = Sandbox()
dirname = '/home/user'

# 监控目录变化
handle = sandbox.files.watch_dir(dirname)

# 触发文件写入事件
sandbox.files.write(f"{dirname}/my-file", "hello")

# 获取自上次调用以来的新事件
events = handle.get_new_events()
for event in events:
    print(event)
    if event.type == FilesystemEventType.WRITE:
        print(f"写入文件 {event.name}")
```

**递归监控**:

**Python**:
```python
from agentsphere import Sandbox
from agentsphere import FilesystemEventType

sandbox = Sandbox()
dirname = '/home/user'

# 递归监控目录（包括子目录）
handle = sandbox.files.watch_dir(dirname, recursive=True)

# 在子目录中创建文件
sandbox.files.write(f"{dirname}/my-folder/my-file", "hello")

# 获取事件
events = handle.get_new_events()
for event in events:
    print(event)
    if event.type == FilesystemEventType.WRITE:
        print(f"在子目录中写入文件 {event.name}")
```

### 文件上传

**上传单个文件**:

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 从本地文件系统读取文件
with open("path/to/local/file", "rb") as file:
    # 上传文件到沙箱
    sandbox.files.write("/path/in/sandbox", file)
```

**上传多个文件**:

**Python**:
```python
import os
from agentsphere import Sandbox

sandbox = Sandbox()

def read_directory_files(directory_path):
    files = []
    
    # 遍历目录中的所有文件
    for filename in os.listdir(directory_path):
        file_path = os.path.join(directory_path, filename)
        
        # 跳过目录
        if os.path.isfile(file_path):
            # 以二进制模式读取文件内容
            with open(file_path, "rb") as file:
                files.append({
                    'path': file_path,
                    'data': file.read()
                })
    
    return files

# 读取本地目录文件
files = read_directory_files("/local/dir")
print(files)

# 批量上传到沙箱
sandbox.files.write(files)
```

**使用预签名 URL 授权上传**:

**Python**:
```python
from agentsphere import Sandbox
import requests

# 启动安全沙箱（默认所有操作必须授权）
sandbox = Sandbox(timeout=3600, secure=True)

# 创建 10 秒过期的文件上传预签名 URL
signed_url = sandbox.upload_url(
    path="demo.txt", 
    user="user", 
    use_signature_expiration=10000
)

# 使用预签名 URL 上传文件
files = {'file': ('demo.txt', 'Hello, Sandbox!')}
response = requests.post(signed_url, files=files)
print("Upload response:", response.status_code)
```

### 文件下载

**基本下载**:

**Python**:
```python
from agentsphere import Sandbox

sandbox = Sandbox()

# 从沙箱读取并下载文件
content = sandbox.files.read('/path/in/sandbox')

# 写入本地文件系统
with open('/local/path', 'w') as file:
    file.write(content)
```

**使用预签名 URL 授权下载**:

**Python**:
```python
from agentsphere import Sandbox
import requests

# 启动安全沙箱
sandbox = Sandbox(timeout=12000, secure=True)

# 创建 10 秒过期的文件下载预签名 URL
signed_url = sandbox.download_url(
    path="demo.txt", 
    user="user", 
    use_signature=True, 
    use_signature_expiration=10000
)

# 用户只需访问 URL 即可下载文件，也可在浏览器中使用
response = requests.get(signed_url)
print("Download content:", response.text)
```

---

## 高级用法示例

### AI 代码执行示例

**Python**:
```python
from agentsphere import Sandbox
import time

def execute_ai_generated_code(code, language="python"):
    """执行 AI 生成的代码"""
    
    # 创建沙箱
    sandbox = Sandbox(
        timeout=300,  # 5 分钟超时
        metadata={
            "purpose": "ai-code-execution",
            "language": language,
            "timestamp": str(time.time())
        }
    )
    
    try:
        # 执行代码
        if language == "python":
            result = sandbox.run_code(code)
        else:
            # 对于其他语言，可以写入文件然后执行
            sandbox.files.write(f"/tmp/code.{language}", code)
            if language == "javascript":
                result = sandbox.commands.run("node /tmp/code.js")
            elif language == "bash":
                result = sandbox.commands.run("bash /tmp/code.bash")
            else:
                raise ValueError(f"Unsupported language: {language}")
        
        return {
            "success": True,
            "output": result.stdout if hasattr(result, 'stdout') else str(result.logs),
            "error": result.stderr if hasattr(result, 'stderr') else None
        }
        
    except Exception as e:
        return {
            "success": False,
            "output": None,
            "error": str(e)
        }
    
    finally:
        # 清理资源
        sandbox.kill()

# 使用示例
ai_code = """
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(10, 6))
plt.plot(x, y)
plt.title('Sine Wave')
plt.xlabel('X')
plt.ylabel('Y')
plt.show()
"""

result = execute_ai_generated_code(ai_code, "python")
print("Execution result:", result)
```

### 多用户会话管理

**Python**:
```python
from agentsphere import Sandbox
from typing import Dict, Optional

class SessionManager:
    def __init__(self):
        self.user_sandboxes: Dict[str, str] = {}  # user_id -> sandbox_id
    
    def get_or_create_sandbox(self, user_id: str) -> Sandbox:
        """为用户获取或创建沙箱"""
        
        # 检查用户是否已有活跃沙箱
        if user_id in self.user_sandboxes:
            sandbox_id = self.user_sandboxes[user_id]
            
            # 尝试连接到现有沙箱
            try:
                sandbox = Sandbox.connect(sandbox_id)
                return sandbox
            except:
                # 如果连接失败，从记录中移除
                del self.user_sandboxes[user_id]
        
        # 创建新沙箱
        sandbox = Sandbox(
            timeout=1800,  # 30 分钟
            metadata={
                "user_id": user_id,
                "session_type": "interactive",
                "created_by": "session_manager"
            }
        )
        
        # 记录沙箱 ID
        self.user_sandboxes[user_id] = sandbox.get_info().sandbox_id
        
        return sandbox
    
    def cleanup_user_session(self, user_id: str):
        """清理用户会话"""
        if user_id in self.user_sandboxes:
            sandbox_id = self.user_sandboxes[user_id]
            try:
                sandbox = Sandbox.connect(sandbox_id)
                sandbox.kill()
            except:
                pass  # 沙箱可能已经停止
            
            del self.user_sandboxes[user_id]
    
    def list_active_sessions(self):
        """列出所有活跃会话"""
        active_sessions = []
        
        # 获取所有运行中的沙箱
        running_sandboxes = Sandbox.list()
        
        for sandbox_info in running_sandboxes:
            if "user_id" in sandbox_info.metadata:
                active_sessions.append({
                    "user_id": sandbox_info.metadata["user_id"],
                    "sandbox_id": sandbox_info.sandbox_id,
                    "started_at": sandbox_info.started_at,
                    "metadata": sandbox_info.metadata
                })
        
        return active_sessions

# 使用示例
session_manager = SessionManager()

# 为用户创建会话
user1_sandbox = session_manager.get_or_create_sandbox("user_123")
user1_sandbox.run_code("print('Hello from user 123!')")

user2_sandbox = session_manager.get_or_create_sandbox("user_456")
user2_sandbox.run_code("print('Hello from user 456!')")

# 列出活跃会话
print("Active sessions:", session_manager.list_active_sessions())

# 清理会话
session_manager.cleanup_user_session("user_123")
```

---

## 错误处理和最佳实践

### 错误处理

**Python**:
```python
from agentsphere import Sandbox
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def safe_sandbox_operation(code: str, timeout: int = 300):
    """安全的沙箱操作，包含完整的错误处理"""
    
    sandbox = None
    try:
        # 创建沙箱
        sandbox = Sandbox(
            timeout=timeout,
            metadata={"operation": "safe_execution"}
        )
        
        logger.info(f"Created sandbox: {sandbox.get_info().sandbox_id}")
        
        # 执行代码
        result = sandbox.run_code(code)
        
        # 检查执行结果
        if hasattr(result, 'error') and result.error:
            logger.error(f"Code execution error: {result.error}")
            return {"success": False, "error": result.error}
        
        logger.info("Code executed successfully")
        return {
            "success": True, 
            "output": str(result.logs),
            "sandbox_id": sandbox.get_info().sandbox_id
        }
        
    except Exception as e:
        logger.error(f"Sandbox operation failed: {str(e)}")
        return {"success": False, "error": str(e)}
    
    finally:
        # 确保清理资源
        if sandbox:
            try:
                sandbox.kill()
                logger.info("Sandbox cleaned up successfully")
            except Exception as e:
                logger.warning(f"Failed to cleanup sandbox: {str(e)}")

# 使用示例
result = safe_sandbox_operation("""
import sys
print(f"Python version: {sys.version}")
print("Hello, safe execution!")
""")

print("Operation result:", result)
```

### 最佳实践

1. **资源管理**:
   - 始终在 `finally` 块中清理沙箱资源
   - 设置合理的超时时间
   - 监控活跃沙箱数量

2. **错误处理**:
   - 捕获和记录所有异常
   - 提供有意义的错误消息
   - 实现重试机制

3. **性能优化**:
   - 重用沙箱实例（通过连接功能）
   - 使用元数据进行沙箱分类和管理
   - 合理设置超时时间

4. **安全考虑**:
   - 对于敏感操作使用安全模式
   - 使用预签名 URL 进行文件操作授权
   - 限制网络访问（如果需要）

---

## 总结

AgentSphere SDK 提供了强大而灵活的沙箱管理能力，支持：

✅ **多语言执行环境** - Python、JavaScript/TypeScript 等  
✅ **完整的生命周期管理** - 创建、连接、监控、销毁  
✅ **灵活的元数据系统** - 用户会话关联、自定义标签  
✅ **强大的文件系统** - 读写、上传、下载、监控  
✅ **网络访问能力** - 公共 URL、服务器部署  
✅ **流式命令执行** - 实时输出、后台任务  
✅ **安全授权机制** - 预签名 URL、安全模式  

通过这些功能，开发者可以构建强大的 AI 驱动应用程序，安全地执行动态生成的代码，并提供出色的用户体验。

---

**相关链接**:
- [AgentSphere 官网](https://www.agentsphere.run/)
- [API 密钥管理](https://www.agentsphere.run/apikey)
- [技术支持](https://www.agentsphere.run/support)