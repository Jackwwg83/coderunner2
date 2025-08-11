import { create } from 'zustand';
import api from '../api';
import websocketClient, { DeploymentLog, DeploymentStatus, DeploymentMetrics } from '../websocket';

export interface Deployment {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'deploying' | 'running' | 'stopped' | 'failed';
  publicUrl?: string;
  runtimeType: 'nodejs' | 'manifest';
  createdAt: string;
  updatedAt: string;
  // Metrics
  cpu?: number;
  memory?: number;
  network?: {
    in: number;
    out: number;
  };
}

// DeploymentLog is now imported from websocket.ts

interface DeploymentsState {
  deployments: Deployment[];
  currentDeployment: Deployment | null;
  logs: Map<string, DeploymentLog[]>;
  isLoading: boolean;
  error: string | null;
  isWebSocketConnected: boolean;
  wsError: string | null;

  // Actions
  fetchDeployments: () => Promise<void>;
  fetchDeployment: (id: string) => Promise<void>;
  createDeployment: (data: FormData) => Promise<Deployment>;
  deleteDeployment: (id: string) => Promise<void>;
  controlDeployment: (id: string, action: 'start' | 'stop' | 'restart') => Promise<void>;
  
  // WebSocket
  connectWebSocket: (token: string) => Promise<void>;
  disconnectWebSocket: () => void;
  subscribeToDeployment: (deploymentId: string) => void;
  unsubscribeFromDeployment: (deploymentId: string) => void;
  fetchDeploymentLogs: (deploymentId: string) => Promise<void>;
  
  // Utils
  clearError: () => void;
  updateDeploymentStatus: (id: string, status: string) => void;
  addLog: (deploymentId: string, log: DeploymentLog) => void;
}

export const useDeploymentsStore = create<DeploymentsState>((set, get) => ({
  deployments: [],
  currentDeployment: null,
  logs: new Map(),
  isLoading: false,
  error: null,
  isWebSocketConnected: false,
  wsError: null,

  fetchDeployments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/deployments');
      set({ 
        deployments: response.data.deployments || [],
        isLoading: false 
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to fetch deployments'
      });
    }
  },

  fetchDeployment: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/deployments/${id}`);
      set({ 
        currentDeployment: response.data.deployment,
        isLoading: false 
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to fetch deployment'
      });
    }
  },

  createDeployment: async (data: FormData) => {
    set({ isLoading: true, error: null });
    try {
      // Convert FormData to JSON
      const projectName = data.get('projectName') as string;
      const projectDescription = data.get('projectDescription') as string;
      const runtimeType = data.get('runtimeType') as string;
      
      const deployData = {
        projectName,
        projectDescription,
        runtimeType,
        files: [], // TODO: Handle file uploads
        config: {
          env: {},
          port: 8080
        }
      };

      const response = await api.post('/deploy', deployData);
      const deployment = response.data.deployment;
      
      set(state => ({
        deployments: [...state.deployments, deployment],
        isLoading: false
      }));
      
      return deployment;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to create deployment'
      });
      throw error;
    }
  },

  deleteDeployment: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/deployments/${id}`);
      set(state => ({
        deployments: state.deployments.filter(d => d.id !== id),
        isLoading: false
      }));
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to delete deployment'
      });
    }
  },

  controlDeployment: async (id: string, action: 'start' | 'stop' | 'restart') => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/deployments/${id}/${action}`);
      await get().fetchDeployment(id);
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || `Failed to ${action} deployment`
      });
    }
  },

  connectWebSocket: async (token: string) => {
    try {
      // Set up event listeners
      websocketClient.on('connection:status', (status) => {
        set({ 
          isWebSocketConnected: status.connected,
          wsError: status.connected ? null : 'Connection lost'
        });
      });

      websocketClient.on('deployment:status', (data: DeploymentStatus) => {
        get().updateDeploymentStatus(data.deploymentId, data.status);
      });

      websocketClient.on('deployment:log', (log: DeploymentLog) => {
        get().addLog(log.deploymentId, log);
      });

      websocketClient.on('deployment:metrics', (data: DeploymentMetrics) => {
        // Update deployment metrics
        set(state => ({
          deployments: state.deployments.map(d => 
            d.id === data.deploymentId 
              ? { ...d, cpu: data.cpu, memory: data.memory, network: data.network }
              : d
          )
        }));
      });

      websocketClient.on('deployment:error', (data) => {
        console.error(`Deployment ${data.deploymentId} error:`, data.error);
        set({ wsError: data.error });
      });

      // Connect to WebSocket
      await websocketClient.connect(token);
      set({ isWebSocketConnected: true, wsError: null });
      
    } catch (error: any) {
      console.error('Failed to connect WebSocket:', error);
      set({ isWebSocketConnected: false, wsError: error.message });
      throw error;
    }
  },

  disconnectWebSocket: () => {
    websocketClient.disconnect();
    set({ isWebSocketConnected: false, wsError: null });
  },

  subscribeToDeployment: (deploymentId: string) => {
    websocketClient.subscribeToDeployment(deploymentId);
  },

  unsubscribeFromDeployment: (deploymentId: string) => {
    websocketClient.unsubscribeFromDeployment(deploymentId);
  },

  fetchDeploymentLogs: async (deploymentId: string) => {
    try {
      const response = await api.get(`/websocket/deployments/${deploymentId}/logs`);
      const logs = response.data.data.logs || [];
      
      set(state => {
        const newLogs = new Map(state.logs);
        newLogs.set(deploymentId, logs);
        return { logs: newLogs };
      });
    } catch (error: any) {
      console.error(`Failed to fetch logs for deployment ${deploymentId}:`, error);
      set({ error: error.response?.data?.error || 'Failed to fetch logs' });
    }
  },

  clearError: () => set({ error: null }),

  updateDeploymentStatus: (id: string, status: string) => {
    set(state => ({
      deployments: state.deployments.map(d => 
        d.id === id ? { ...d, status: status as any } : d
      ),
      currentDeployment: state.currentDeployment?.id === id 
        ? { ...state.currentDeployment, status: status as any }
        : state.currentDeployment
    }));
  },

  addLog: (deploymentId: string, log: DeploymentLog) => {
    set(state => {
      const logs = new Map(state.logs);
      const deploymentLogs = logs.get(deploymentId) || [];
      
      // Add log with proper timestamp handling
      const logEntry = {
        ...log,
        timestamp: log.timestamp || new Date().toISOString()
      };
      
      deploymentLogs.push(logEntry);
      
      // Keep only last 1000 logs
      if (deploymentLogs.length > 1000) {
        deploymentLogs.shift();
      }
      
      // Sort logs by timestamp
      deploymentLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      logs.set(deploymentId, deploymentLogs);
      return { logs };
    });
  }
}));