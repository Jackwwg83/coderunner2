# 🔗 V0 前端集成实施计划

> **执行时间**: Phase 2 Day 3-4  
> **目标**: 将 V0 生成的前端代码完整集成到 CodeRunner 后端系统

## 📋 集成任务清单

### Phase 2-T03: V0 前端集成与后端对接 (Day 3-4)

#### Day 3: 基础集成和认证系统

##### 🏗️ 项目结构重组
```bash
# 1. 创建前端目录结构
mkdir -p frontend
mv ui-design/* frontend/
cd frontend

# 2. 安装缺失依赖
npm install socket.io-client zustand axios @types/node
npm install @hookform/resolvers zod
```

##### ⚙️ 配置文件调整

**1. Next.js 配置 (`frontend/next.config.mjs`)**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
  },
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

**2. 环境变量 (`frontend/.env.local`)**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXTAUTH_SECRET=your-secret-key
NODE_ENV=development
```

**3. TypeScript 类型定义 (`frontend/lib/types.ts`)**
```typescript
// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// 部署对象类型
export interface Deployment {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'deploying' | 'failed';
  type: 'nodejs' | 'python' | 'manifest';
  url: string;
  lastDeploy: string;
  cpu: number;
  memory: number;
  created?: string;
  runtime?: string;
  uptime?: string;
}

// 用户认证类型
export interface User {
  id: string;
  email: string;
  name?: string;
  planType: string;
  createdAt: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

// WebSocket 消息类型
export interface WSMessage {
  type: 'status_update' | 'log' | 'metrics' | 'notification';
  deploymentId?: string;
  timestamp: string;
  data: any;
}
```

##### 🔐 认证状态管理 (Zustand)

**创建 `frontend/lib/store/auth.ts`**:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthTokens } from '@/lib/types';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  setUser: (user: User) => void;
  setTokens: (tokens: AuthTokens) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          
          if (response.ok) {
            const data = await response.json();
            set({
              user: data.user,
              tokens: data.tokens,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            throw new Error('Login failed');
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (email: string, password: string, name?: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
          });
          
          if (response.ok) {
            const data = await response.json();
            set({
              user: data.user,
              tokens: data.tokens,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            throw new Error('Registration failed');
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
        });
      },

      refreshToken: async () => {
        const { tokens } = get();
        if (!tokens?.refresh) return;
        
        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: tokens.refresh }),
          });
          
          if (response.ok) {
            const data = await response.json();
            set({ tokens: data });
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
        }
      },

      setUser: (user: User) => set({ user }),
      setTokens: (tokens: AuthTokens) => set({ tokens }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

##### 📡 HTTP 客户端配置

**创建 `frontend/lib/api.ts`**:
```typescript
import axios from 'axios';
import { useAuthStore } from '@/lib/store/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 10000,
});

// 请求拦截器 - 添加认证头
api.interceptors.request.use((config) => {
  const { tokens } = useAuthStore.getState();
  if (tokens?.access) {
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  return config;
});

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { refreshToken, logout } = useAuthStore.getState();
    
    if (error.response?.status === 401) {
      try {
        await refreshToken();
        // 重试原请求
        return api.request(error.config);
      } catch (refreshError) {
        logout();
        window.location.href = '/auth';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

##### 🔒 认证中间件

**创建 `frontend/middleware.ts`**:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-storage')?.value;
  const isAuthPage = request.nextUrl.pathname === '/auth';
  const isPublicPage = ['/auth', '/'].includes(request.nextUrl.pathname);

  // 如果用户已登录且访问认证页面，重定向到首页
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 如果用户未登录且访问受保护页面，重定向到认证页面
  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

##### 🎨 V0 认证页面集成

**更新 `frontend/app/auth/page.tsx`**:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/store/auth'
import { Zap } from 'lucide-react'

export default function AuthPage() {
  const router = useRouter()
  const { login, register, isLoading } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password)
      } else {
        await register(formData.email, formData.password, formData.name)
      }
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <Card className="w-full max-w-md bg-neutral-900 border-neutral-800">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-black" />
            </div>
          </div>
          <CardTitle className="text-2xl">CodeRunner</CardTitle>
          <p className="text-neutral-400">Deploy in seconds 🚀</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Input
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-neutral-800 border-neutral-700 focus:border-orange-500"
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-neutral-800 border-neutral-700 focus:border-orange-500"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-neutral-800 border-neutral-700 focus:border-orange-500"
              required
            />
            
            {error && (
              <div className="text-red-400 text-sm text-center">{error}</div>
            )}
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'login' ? 'default' : 'outline'}
                onClick={() => setMode('login')}
                className="flex-1"
                disabled={isLoading}
              >
                Login
              </Button>
              <Button
                type="button"
                variant={mode === 'register' ? 'default' : 'outline'}
                onClick={() => setMode('register')}
                className="flex-1"
                disabled={isLoading}
              >
                Sign Up
              </Button>
            </div>
            
            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-black"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : (mode === 'login' ? 'Login' : 'Create Account')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### Day 4: 实时功能集成和部署管理

##### 📱 WebSocket 状态管理

**创建 `frontend/lib/store/websocket.ts`**:
```typescript
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { WSMessage } from '@/lib/types';
import { useAuthStore } from './auth';

interface WebSocketState {
  socket: Socket | null;
  isConnected: boolean;
  logs: Map<string, any[]>;
  deploymentStatus: Map<string, string>;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  subscribeToDeployment: (deploymentId: string) => void;
  unsubscribeFromDeployment: (deploymentId: string) => void;
  addLog: (deploymentId: string, log: any) => void;
  updateStatus: (deploymentId: string, status: string) => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  logs: new Map(),
  deploymentStatus: new Map(),

  connect: () => {
    const { tokens } = useAuthStore.getState();
    if (!tokens?.access) return;

    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000', {
      auth: { token: tokens.access },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      set({ isConnected: true });
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
      console.log('WebSocket disconnected');
    });

    socket.on('message', (message: WSMessage) => {
      const { addLog, updateStatus } = get();
      
      switch (message.type) {
        case 'log':
          if (message.deploymentId) {
            addLog(message.deploymentId, message.data);
          }
          break;
        case 'status_update':
          if (message.deploymentId) {
            updateStatus(message.deploymentId, message.data.status);
          }
          break;
      }
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  subscribeToDeployment: (deploymentId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('subscribe', { type: 'deployment', id: deploymentId });
    }
  },

  unsubscribeFromDeployment: (deploymentId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('unsubscribe', { type: 'deployment', id: deploymentId });
    }
  },

  addLog: (deploymentId: string, log: any) => {
    set((state) => {
      const newLogs = new Map(state.logs);
      const existingLogs = newLogs.get(deploymentId) || [];
      newLogs.set(deploymentId, [...existingLogs, log]);
      return { logs: newLogs };
    });
  },

  updateStatus: (deploymentId: string, status: string) => {
    set((state) => {
      const newStatus = new Map(state.deploymentStatus);
      newStatus.set(deploymentId, status);
      return { deploymentStatus: newStatus };
    });
  },
}));
```

##### 🔄 部署状态管理

**创建 `frontend/lib/store/deployments.ts`**:
```typescript
import { create } from 'zustand';
import { Deployment } from '@/lib/types';
import api from '@/lib/api';

interface DeploymentsState {
  deployments: Deployment[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchDeployments: () => Promise<void>;
  createDeployment: (data: any) => Promise<Deployment>;
  updateDeployment: (id: string, data: Partial<Deployment>) => void;
  deleteDeployment: (id: string) => Promise<void>;
  controlDeployment: (id: string, action: 'start' | 'stop' | 'restart') => Promise<void>;
}

export const useDeploymentsStore = create<DeploymentsState>((set, get) => ({
  deployments: [],
  isLoading: false,
  error: null,

  fetchDeployments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/api/deployments');
      set({ deployments: response.data.deployments, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch deployments', isLoading: false });
    }
  },

  createDeployment: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/deploy', data);
      const newDeployment = response.data.data;
      set((state) => ({
        deployments: [newDeployment, ...state.deployments],
        isLoading: false,
      }));
      return newDeployment;
    } catch (error) {
      set({ error: 'Failed to create deployment', isLoading: false });
      throw error;
    }
  },

  updateDeployment: (id: string, data: Partial<Deployment>) => {
    set((state) => ({
      deployments: state.deployments.map((d) =>
        d.id === id ? { ...d, ...data } : d
      ),
    }));
  },

  deleteDeployment: async (id: string) => {
    try {
      await api.delete(`/api/deployments/${id}`);
      set((state) => ({
        deployments: state.deployments.filter((d) => d.id !== id),
      }));
    } catch (error) {
      set({ error: 'Failed to delete deployment' });
      throw error;
    }
  },

  controlDeployment: async (id: string, action: 'start' | 'stop' | 'restart') => {
    try {
      await api.post(`/api/deployments/${id}/${action}`);
      // Status will be updated via WebSocket
    } catch (error) {
      set({ error: `Failed to ${action} deployment` });
      throw error;
    }
  },
}));
```

##### 📊 V0 仪表板集成

**更新 `frontend/app/page.tsx`**:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth'
import { useDeploymentsStore } from '@/lib/store/deployments'
import { useWebSocketStore } from '@/lib/store/websocket'
// ... 保持原有的UI组件导入

export default function Dashboard() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { deployments, isLoading, fetchDeployments } = useDeploymentsStore()
  const { connect, isConnected } = useWebSocketStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth')
      return
    }
    
    // 获取部署列表
    fetchDeployments()
    
    // 连接WebSocket
    connect()
  }, [isAuthenticated])

  // 过滤部署
  const filteredDeployments = deployments.filter(deployment =>
    deployment.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 统计数据
  const stats = [
    { 
      label: 'Active Deployments', 
      value: deployments.filter(d => d.status === 'running').length.toString(),
      icon: Server, 
      color: 'text-green-400' 
    },
    { 
      label: 'Total Projects', 
      value: deployments.length.toString(),
      icon: FileText, 
      color: 'text-blue-400' 
    },
    // ... 其他统计项
  ]

  if (isLoading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">
      Loading...
    </div>
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 保持原有的UI结构，但使用实际数据 */}
      {/* 部署卡片使用 filteredDeployments 数据 */}
      {/* WebSocket连接状态指示器 */}
      {!isConnected && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded text-sm">
          Reconnecting...
        </div>
      )}
      
      {/* ... 原有的JSX结构，替换为实际数据 */}
    </div>
  )
}
```

##### 🚀 V0 新建部署页面集成

**更新 `frontend/app/deploy/new/page.tsx`**:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDeploymentsStore } from '@/lib/store/deployments'
// ... 保持原有的UI组件导入

export default function NewDeploymentPage() {
  const router = useRouter()
  const { createDeployment, isLoading } = useDeploymentsStore()
  
  // 保持原有的状态管理
  const [selectedType, setSelectedType] = useState('nodejs')
  const [projectName, setProjectName] = useState('')
  const [envVars, setEnvVars] = useState([{ key: 'NODE_ENV', value: 'production' }])
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [isDeploying, setIsDeploying] = useState(false)

  // 文件处理函数
  const processFiles = async (files: File[]): Promise<Array<{path: string, content: string}>> => {
    const processedFiles = []
    
    for (const file of files) {
      const content = await file.text()
      processedFiles.push({
        path: file.name,
        content: content
      })
    }
    
    return processedFiles
  }

  // 部署处理函数
  const handleDeploy = async () => {
    if (!projectName.trim() || files.length === 0) {
      setError('Project name and files are required')
      return
    }

    setIsDeploying(true)
    setError('')

    try {
      const processedFiles = await processFiles(files)
      const envVarsObject = envVars.reduce((acc, env) => {
        if (env.key && env.value) {
          acc[env.key] = env.value
        }
        return acc
      }, {} as Record<string, string>)

      const deploymentData = {
        projectName: projectName.trim(),
        projectDescription: `${selectedType} project`,
        files: processedFiles,
        config: {
          env: envVarsObject,
          runtime: selectedType,
        }
      }

      const deployment = await createDeployment(deploymentData)
      router.push(`/deployments/${deployment.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed')
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 保持原有的UI结构 */}
      {/* 添加错误显示和加载状态 */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded">
          {error}
        </div>
      )}
      
      {/* 更新部署按钮 */}
      <Button
        onClick={handleDeploy}
        className="bg-orange-500 hover:bg-orange-600 text-black font-medium"
        disabled={!projectName || files.length === 0 || isDeploying}
      >
        <Zap className="w-4 h-4 mr-2" />
        {isDeploying ? 'Deploying...' : 'Deploy Now'}
      </Button>
    </div>
  )
}
```

## 🔧 后端 API 增强需求

### 新增 API 端点

**部署管理 API** (`src/routes/deployments.ts`):
```typescript
import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// 获取用户的部署列表
router.get('/', AuthMiddleware.authenticateToken, async (req, res) => {
  const userId = AuthMiddleware.getUserId(req);
  // 实现部署列表获取逻辑
});

// 获取部署详情
router.get('/:id', AuthMiddleware.authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = AuthMiddleware.getUserId(req);
  // 实现部署详情获取逻辑
});

// 控制部署状态
router.post('/:id/:action', AuthMiddleware.authenticateToken, async (req, res) => {
  const { id, action } = req.params; // action: start, stop, restart
  const userId = AuthMiddleware.getUserId(req);
  // 实现部署控制逻辑
});

// 删除部署
router.delete('/:id', AuthMiddleware.authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = AuthMiddleware.getUserId(req);
  // 实现部署删除逻辑
});

export default router;
```

### WebSocket 服务实现 (Phase 2-T01)

**WebSocket 服务** (`src/services/websocket.ts`):
```typescript
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

export class WebSocketService {
  private io: Server;
  private deploymentSubscriptions: Map<string, Set<string>> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        credentials: true
      }
    });

    this.setupAuthentication();
    this.setupEventHandlers();
  }

  private setupAuthentication() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        socket.userId = (decoded as any).userId;
        next();
      } catch (err) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected via WebSocket`);

      socket.on('subscribe', (data) => {
        if (data.type === 'deployment' && data.id) {
          this.subscribeToDeployment(socket.id, data.id);
        }
      });

      socket.on('unsubscribe', (data) => {
        if (data.type === 'deployment' && data.id) {
          this.unsubscribeFromDeployment(socket.id, data.id);
        }
      });

      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        this.cleanupSubscriptions(socket.id);
      });
    });
  }

  // 发送日志消息到订阅的客户端
  public broadcastLog(deploymentId: string, logEntry: any) {
    const subscribers = this.deploymentSubscriptions.get(deploymentId);
    if (subscribers) {
      subscribers.forEach(socketId => {
        this.io.to(socketId).emit('message', {
          type: 'log',
          deploymentId,
          timestamp: new Date().toISOString(),
          data: logEntry
        });
      });
    }
  }

  // 发送状态更新
  public broadcastStatusUpdate(deploymentId: string, status: string) {
    const subscribers = this.deploymentSubscriptions.get(deploymentId);
    if (subscribers) {
      subscribers.forEach(socketId => {
        this.io.to(socketId).emit('message', {
          type: 'status_update',
          deploymentId,
          timestamp: new Date().toISOString(),
          data: { status }
        });
      });
    }
  }

  private subscribeToDeployment(socketId: string, deploymentId: string) {
    if (!this.deploymentSubscriptions.has(deploymentId)) {
      this.deploymentSubscriptions.set(deploymentId, new Set());
    }
    this.deploymentSubscriptions.get(deploymentId)!.add(socketId);
  }

  private unsubscribeFromDeployment(socketId: string, deploymentId: string) {
    const subscribers = this.deploymentSubscriptions.get(deploymentId);
    if (subscribers) {
      subscribers.delete(socketId);
      if (subscribers.size === 0) {
        this.deploymentSubscriptions.delete(deploymentId);
      }
    }
  }

  private cleanupSubscriptions(socketId: string) {
    for (const [deploymentId, subscribers] of this.deploymentSubscriptions) {
      subscribers.delete(socketId);
      if (subscribers.size === 0) {
        this.deploymentSubscriptions.delete(deploymentId);
      }
    }
  }
}
```

## ✅ 验收标准

### Day 3 完成标准
- [ ] V0 代码成功迁移到 `/frontend` 目录
- [ ] 认证系统完整集成，用户可以登录/注册
- [ ] 部署列表页面显示真实数据
- [ ] 新建部署功能可以成功创建部署
- [ ] API 客户端正确处理认证和错误

### Day 4 完成标准  
- [ ] WebSocket 连接建立成功
- [ ] 实时日志流在部署详情页面正常工作
- [ ] 部署状态实时更新
- [ ] 部署控制功能(启动/停止/重启)正常工作
- [ ] 错误处理和用户反馈完善

### 测试检查清单
- [ ] 认证流程 E2E 测试通过
- [ ] 部署创建到状态监控全流程测试通过  
- [ ] WebSocket 连接稳定性测试通过
- [ ] 多浏览器兼容性测试通过
- [ ] 响应式设计在移动设备上正常工作
- [ ] 错误边界和异常处理覆盖主要场景

---

**📋 任务追踪**: 此计划与 `03-subagent-tasks.md` P2-T03 任务对应  
**🔄 更新频率**: 每日更新进度和遇到的问题  
**📊 成功指标**: 用户可以通过V0界面完成完整的部署工作流