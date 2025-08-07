import { Request } from 'express';

// Database Schema Types (Based on 04-database-schema.md)
export interface User {
  id: string; // UUID
  email: string;
  password_hash: string;
  plan_type: string; // 'free', 'personal', 'team'
  created_at: Date;
  updated_at: Date;
}

// Legacy User interface for backward compatibility
export interface LegacyUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  profile?: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string;
  website?: string;
  location?: string;
  githubUsername?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  editorSettings: EditorSettings;
  notifications: NotificationSettings;
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  theme: string;
  keyBindings: 'default' | 'vim' | 'emacs';
}

export interface NotificationSettings {
  executionComplete: boolean;
  projectShared: boolean;
  systemUpdates: boolean;
  weeklyDigest: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
  planType: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

// Authentication Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  planType?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: Omit<User, 'password_hash'>;
    token: string;
    expiresAt: Date;
  };
  error?: string;
  message?: string;
}

export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export interface TokenBlacklistEntry {
  token: string;
  userId: string;
  expiresAt: Date;
  reason: 'logout' | 'password_change' | 'account_deletion';
}

export class AuthError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 401, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code || 'AUTH_ERROR';
    Error.captureStackTrace(this, AuthError);
  }
}

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength?: 'weak' | 'medium' | 'strong';
}

// Project Types (Database Schema)
export interface Project {
  id: string; // UUID
  user_id: string; // Foreign key to users
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

// Legacy Project interface for backward compatibility
export interface LegacyProject {
  id: string;
  name: string;
  description: string;
  templateId: string;
  userId: string;
  isPublic: boolean;
  tags: string[];
  files: ProjectFile[];
  settings?: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

// Deployment Types
export enum DeploymentStatus {
  PENDING = 'PENDING',
  PROVISIONING = 'PROVISIONING',
  BUILDING = 'BUILDING',
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  FAILED = 'FAILED',
  DESTROYED = 'DESTROYED'
}

export interface Deployment {
  id: string; // UUID
  project_id: string; // Foreign key to projects
  app_sandbox_id?: string;
  public_url?: string;
  db_sandbox_id?: string;
  db_connection_info?: any; // JSONB
  status: DeploymentStatus;
  runtime_type?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectFile {
  path: string;
  content: string;
  language?: string | undefined;
  isTemplate?: boolean;
  size?: number;
  lastModified?: Date;
}

export interface ProjectSettings {
  environment?: string;
  dependencies?: { [key: string]: string };
  scripts?: { [key: string]: string };
  buildCommand?: string;
  runCommand?: string;
  testCommand?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  framework?: string;
  files: ProjectFile[];
  tags: string[];
  isOfficial: boolean;
  downloadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  templateId?: string;
  isPublic?: boolean;
  tags?: string[];
  files?: ProjectFile[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  files?: ProjectFile[];
  settings?: ProjectSettings;
}

// Execution Types
export enum ExecutionStatus {
  QUEUED = 'queued',
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export interface ExecutionRequest {
  id?: string;
  projectId: string;
  userId: string;
  files: ProjectFile[];
  entryPoint?: string;
  environment?: string;
  dependencies?: { [key: string]: string };
  command?: string;
  args?: string[];
  timeout?: number;
  memory?: number;
  status?: ExecutionStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  output: string;
  error: string;
  exitCode?: number;
  executionTime: number;
  memoryUsed?: number;
  createdAt: Date;
  updatedAt: Date;
  logs?: ExecutionLog[];
}

export interface ExecutionLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

// Analysis Types
export interface AnalysisResult {
  projectId: string;
  totalFiles: number;
  totalLines: number;
  languages: { [language: string]: { files: number; lines: number } };
  dependencies: DependencyInfo[];
  complexity: CodeComplexity;
  securityIssues: SecurityIssue[];
  qualityMetrics: QualityMetrics;
  analyzedAt: Date;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'import' | 'require' | 'dependency';
  file: string;
  isDevDependency?: boolean;
  hasVulnerabilities?: boolean;
}

export interface CodeComplexity {
  cyclomatic: number;
  cognitive: number;
  maintainabilityIndex: number;
}

export interface SecurityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file: string;
  line?: number;
  column?: number;
  cweId?: string;
  recommendation?: string;
}

export interface QualityMetrics {
  duplicatedLines: number;
  testCoverage: number;
  codeSmells: number;
  technicalDebt: number;
  bugs?: number;
  vulnerabilities?: number;
  reliabilityRating?: string;
  securityRating?: string;
  maintainabilityRating?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Database Types
export interface DatabaseQueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: any[];
}

// Database Service Input Types
export interface CreateUserInput {
  email: string;
  password_hash: string;
  plan_type?: string;
}

export interface UpdateUserInput {
  email?: string;
  password_hash?: string;
  plan_type?: string;
}

export interface CreateProjectInput {
  user_id: string;
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
}

export interface CreateDeploymentInput {
  project_id: string;
  app_sandbox_id?: string;
  public_url?: string;
  db_sandbox_id?: string;
  db_connection_info?: any;
  status?: DeploymentStatus;
  runtime_type?: string;
}

export interface UpdateDeploymentInput {
  app_sandbox_id?: string;
  public_url?: string;
  db_sandbox_id?: string;
  db_connection_info?: any;
  status?: DeploymentStatus;
  runtime_type?: string;
}

// Transaction types
export interface TransactionClient {
  query: (text: string, params?: any[]) => Promise<DatabaseQueryResult>;
}

// AgentSphere Integration Types (Placeholder)
export interface AgentSphereConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}

export interface AgentSphereRequest {
  agentId: string;
  input: any;
  context?: any;
  options?: {
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
    retryPolicy?: 'none' | 'exponential' | 'linear';
  };
}

export interface AgentSphereResponse {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  agentId: string;
  requestId: string;
}

// Validation Types
export interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: { [field: string]: string[] };
}

// Event Types
export interface SystemEvent {
  id: string;
  type: string;
  userId?: string;
  projectId?: string;
  data: any;
  timestamp: Date;
  source: string;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
  requestId?: string;
}

// Manifest Engine Types
export interface ManifestConfig {
  name: string;
  version?: string;
  entities: ManifestEntity[];
}

export interface ManifestEntity {
  name: string;
  fields: ManifestField[];
}

export interface ManifestField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
}