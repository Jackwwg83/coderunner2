/**
 * Mock AgentSphere SDK for development and testing
 * This file provides a mock implementation when the real SDK is not available
 */

export interface SandboxInfo {
  sandbox_id: string;
  status: 'running' | 'stopped' | 'failed' | 'starting';
  started_at: Date;
  end_at: Date;
  metadata: Record<string, any>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  pid?: number;
}

export interface SandboxCommands {
  run(command: string, options?: { background?: boolean }): Promise<CommandResult>;
}

export interface SandboxFiles {
  write(files: Array<{ path: string; data: string }>): Promise<void>;
  read(path: string): Promise<string>;
}

export class Sandbox {
  private sandboxId: string;
  private info: SandboxInfo;
  private isInitialized = false;

  public commands: SandboxCommands;
  public files: SandboxFiles;

  constructor() {
    this.sandboxId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.info = {
      sandbox_id: this.sandboxId,
      status: 'starting',
      started_at: new Date(),
      end_at: new Date(Date.now() + 300000), // 5 minutes from now
      metadata: {}
    };

    this.commands = {
      run: async (command: string, options?: { background?: boolean }) => {
        console.log(`[Mock Sandbox] Running command: ${command}`);
        
        // Mock different command responses
        if (command === 'npm install') {
          return {
            stdout: 'Mock: Dependencies installed successfully',
            stderr: '',
            exitCode: 0
          };
        }
        
        if (command.startsWith('npm start') || command.includes('node')) {
          return {
            stdout: 'Mock: Application started',
            stderr: '',
            exitCode: 0,
            pid: 12345
          };
        }
        
        if (command.includes('tail') && command.includes('log')) {
          return {
            stdout: '[Mock] Application log entry 1\n[Mock] Application log entry 2\n[Mock] Server started on port 3000',
            stderr: '',
            exitCode: 0
          };
        }
        
        return {
          stdout: `Mock command output for: ${command}`,
          stderr: '',
          exitCode: 0
        };
      }
    };

    this.files = {
      write: async (files: Array<{ path: string; data: string }>) => {
        console.log(`[Mock Sandbox] Writing ${files.length} files`);
        // Mock file writing - just log the operation
        files.forEach(file => {
          console.log(`[Mock Sandbox] Writing file: ${file.path} (${file.data.length} bytes)`);
        });
      },
      read: async (path: string) => {
        console.log(`[Mock Sandbox] Reading file: ${path}`);
        return `Mock file content for ${path}`;
      }
    };
  }

  async initialize(config: {
    timeout?: number;
    metadata?: Record<string, any>;
    envs?: Record<string, string>;
  }): Promise<void> {
    console.log('[Mock Sandbox] Initializing sandbox with config:', config);
    this.info.metadata = { ...this.info.metadata, ...config.metadata };
    this.info.status = 'running';
    this.isInitialized = true;
    
    // Mock initialization delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  getInfo(): SandboxInfo {
    return { ...this.info };
  }

  getHost(port: number): string {
    return `${this.sandboxId}.agentsphere.run:${port}`;
  }

  async kill(): Promise<void> {
    console.log(`[Mock Sandbox] Killing sandbox: ${this.sandboxId}`);
    this.info.status = 'stopped';
    this.info.end_at = new Date();
  }

  static async list(): Promise<SandboxInfo[]> {
    // Return mock running sandboxes
    return [
      {
        sandbox_id: 'mock_sandbox_1',
        status: 'running',
        started_at: new Date(Date.now() - 300000), // 5 minutes ago
        end_at: new Date(Date.now() + 300000), // 5 minutes from now
        metadata: { userId: 'test-user', projectId: 'test-project' }
      }
    ];
  }

  static async connect(sandboxId: string): Promise<Sandbox> {
    console.log(`[Mock Sandbox] Connecting to existing sandbox: ${sandboxId}`);
    const sandbox = new Sandbox();
    sandbox.sandboxId = sandboxId;
    sandbox.info.sandbox_id = sandboxId;
    sandbox.info.status = 'running';
    sandbox.isInitialized = true;
    return sandbox;
  }
}