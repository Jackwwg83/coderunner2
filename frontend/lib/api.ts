import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('auth-token') || localStorage.getItem('auth-token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear auth and redirect to login
      Cookies.remove('auth-token');
      localStorage.removeItem('auth-token');
      
      // Only redirect if we're in the browser
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    }
    
    return Promise.reject(error);
  }
);

// API helper functions
export const apiHelpers = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) => 
      api.post('/auth/login', { email, password }),
    
    register: (email: string, password: string) => 
      api.post('/auth/register', { email, password }),
    
    verify: () => 
      api.get('/auth/verify'),
    
    logout: () => 
      api.post('/auth/logout')
  },
  
  // Deployment endpoints
  deployments: {
    list: () => 
      api.get('/deployments'),
    
    get: (id: string) => 
      api.get(`/deployments/${id}`),
    
    create: (data: any) => 
      api.post('/deploy', data),
    
    delete: (id: string) => 
      api.delete(`/deployments/${id}`),
    
    control: (id: string, action: 'start' | 'stop' | 'restart') => 
      api.post(`/deployments/${id}/${action}`),
    
    logs: (id: string, tail = 100) => 
      api.get(`/websocket/deployments/${id}/logs?tail=${tail}`),
    
    metrics: (id: string) => 
      api.get(`/metrics/deployment/${id}`)
  },
  
  // Project endpoints
  projects: {
    list: () => 
      api.get('/projects'),
    
    get: (id: string) => 
      api.get(`/projects/${id}`),
    
    create: (data: any) => 
      api.post('/projects', data),
    
    update: (id: string, data: any) => 
      api.put(`/projects/${id}`, data),
    
    delete: (id: string) => 
      api.delete(`/projects/${id}`)
  },
  
  // Database endpoints
  databases: {
    // Deployments
    listDeployments: () => 
      api.get('/orchestrator/deployments'),
    
    getDeployment: (id: string) => 
      api.get(`/orchestrator/deployments/${id}`),
    
    deploy: (data: any) => 
      api.post('/orchestrator/deploy', data),
    
    deleteDeployment: (id: string) => 
      api.delete(`/orchestrator/deployments/${id}`),
    
    // Templates
    listTemplates: () => 
      api.get('/orchestrator/templates'),
    
    getTemplate: (id: string) => 
      api.get(`/orchestrator/templates/${id}`),
    
    // Tenants
    listTenants: (deploymentId: string) => 
      api.get(`/orchestrator/${deploymentId}/tenants`),
    
    createTenant: (deploymentId: string, data: any) => 
      api.post(`/orchestrator/${deploymentId}/tenants`, data),
    
    deleteTenant: (deploymentId: string, tenantId: string) => 
      api.delete(`/orchestrator/${deploymentId}/tenants/${tenantId}`),
    
    // Backups
    listBackups: (deploymentId: string) => 
      api.get(`/orchestrator/${deploymentId}/backups`),
    
    createBackup: (deploymentId: string, data: { type: 'full' | 'incremental' }) => 
      api.post(`/orchestrator/${deploymentId}/backups`, data),
    
    restoreBackup: (deploymentId: string, backupId: string) => 
      api.post(`/orchestrator/${deploymentId}/backups/${backupId}/restore`),
    
    deleteBackup: (deploymentId: string, backupId: string) => 
      api.delete(`/orchestrator/${deploymentId}/backups/${backupId}`),
    
    // Metrics
    getMetrics: (deploymentId: string) => 
      api.get(`/orchestrator/${deploymentId}/metrics`)
  },
  
  // System endpoints
  system: {
    health: () => 
      api.get('/health'),
    
    metrics: () => 
      api.get('/metrics/current'),
    
    status: () => 
      api.get('/websocket/status')
  }
};

export default api;