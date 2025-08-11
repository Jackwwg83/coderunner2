import { Request } from 'express';

// Database Schema Types (Based on 04-database-schema.md)
export interface User {
  id: string; // UUID
  email: string;
  password_hash?: string; // Optional for OAuth users
  plan_type: string; // 'free', 'personal', 'team'
  name?: string; // Display name from OAuth or manual entry
  avatar_url?: string; // Profile picture URL
  oauth_provider?: string; // OAuth provider (google, github, etc.)
  oauth_id?: string; // OAuth provider user ID
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
  jti?: string; // JWT ID for tracking
  type?: 'access' | 'refresh';
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
    refreshToken?: string;
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
  password_hash?: string; // Optional for OAuth users
  plan_type?: string;
  name?: string;
  avatar_url?: string;
  oauth_provider?: string;
  oauth_id?: string;
}

export interface UpdateUserInput {
  email?: string;
  password_hash?: string;
  plan_type?: string;
  name?: string;
  avatar_url?: string;
  oauth_provider?: string;
  oauth_id?: string;
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
  deploymentId?: string;
}

// Re-export WebSocket-specific types
export * from './websocket';

// Manifest Engine Types
export interface ManifestConfig {
  name: string;
  version?: string;
  description?: string;
  entities: ManifestEntity[];
  endpoints?: any[];
  environment?: any;
  authentication?: ManifestAuth;
  database?: ManifestDatabase;
  middleware?: string[];
}

export interface ManifestEntity {
  name: string;
  fields: ManifestField[];
}

export interface ManifestField {
  name: string;
  type: 'text' | 'longtext' | 'number' | 'boolean' | 'date' | 'datetime' | 'email' | 'url' | 'enum' | 'array' | 'reference';
  required?: boolean;
  unique?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enumValues?: string[];
  defaultValue?: any;
  reference?: string; // For reference fields
  description?: string;
}

export interface ManifestAuth {
  enabled: boolean;
  type: 'jwt' | 'basic' | 'oauth';
  secretKey?: string;
  expiresIn?: string;
  protectedRoutes?: string[];
}

export interface ManifestDatabase {
  type: 'lowdb' | 'sqlite' | 'memory';
  path?: string;
  options?: any;
}

export interface ManifestValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

export interface ManifestTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'api' | 'mobile' | 'enterprise';
  manifest: ManifestConfig;
  tags: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

// Configuration Management Types (P2-T04)
export interface EnvironmentConfig {
  id: string;
  projectId: string;
  environment: 'development' | 'staging' | 'production';
  name: string;
  description?: string;
  variables: EnvironmentVariable[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentVariable {
  id: string;
  configId: string;
  key: string;
  value: string;
  isEncrypted: boolean;
  isRequired: boolean;
  description?: string;
  variableType: 'string' | 'number' | 'boolean' | 'secret' | 'url' | 'json';
  defaultValue?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  framework?: string;
  isOfficial: boolean;
  usageCount: number;
  templateData: {
    variables: TemplateVariable[];
    environments: string[];
    framework?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  key: string;
  description: string;
  variableType: 'string' | 'number' | 'boolean' | 'secret' | 'url' | 'json';
  defaultValue?: string;
  isRequired: boolean;
  isEncrypted?: boolean;
  environments: string[];
}

export interface ConfigAuditLog {
  id: string;
  userId: string;
  projectId: string;
  configId?: string;
  variableId?: string;
  action: 'create' | 'update' | 'delete' | 'export' | 'import' | 'apply_template';
  resourceType: 'config' | 'variable' | 'template';
  changes?: any;
  metadata?: any;
  timestamp: Date;
}

export interface CreateEnvironmentConfigRequest {
  environment: 'development' | 'staging' | 'production';
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateEnvironmentVariableRequest {
  key: string;
  value: string;
  isEncrypted?: boolean;
  isRequired?: boolean;
  description?: string;
  variableType?: 'string' | 'number' | 'boolean' | 'secret' | 'url' | 'json';
  defaultValue?: string | undefined;
}

export interface ApplyTemplateRequest {
  templateId: string;
  environment: 'development' | 'staging' | 'production';
  overrides: Record<string, string>;
}

export interface ConfigurationDeploymentData {
  variables: Record<string, string>;
  environment: string;
  lastUpdated: Date;
}

// P3-T01 PostgreSQL Template Types
export interface DatabaseTemplate {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  version: string;
  description: string;
  configuration: any; // Template-specific configuration
  environment: 'development' | 'staging' | 'production';
  created_at: Date;
  updated_at: Date;
  deployed_at?: Date;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'destroyed';
}

export interface DatabaseDeployment {
  id: string;
  template_id: string;
  instance_id: string;
  connection_string: string;
  admin_connection_string?: string;
  endpoint: string;
  port: number;
  status: 'creating' | 'available' | 'maintenance' | 'failed' | 'deleting';
  deployment_time: number;
  resource_usage: {
    cpu_cores: number;
    memory_mb: number;
    storage_gb: number;
    network_throughput: number;
  };
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseTenant {
  id: string;
  deployment_id: string;
  tenant_id: string;
  schema_name?: string;
  database_name?: string;
  isolation_type: 'schema' | 'database' | 'row';
  resource_limits: {
    max_connections: number;
    storage_quota_mb: number;
    cpu_quota_percent: number;
  };
  status: 'active' | 'suspended' | 'migrating' | 'deleting';
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseBackup {
  id: string;
  deployment_id: string;
  backup_id: string;
  type: 'full' | 'incremental' | 'differential';
  size_bytes: number;
  status: 'creating' | 'completed' | 'failed' | 'restoring';
  encryption_enabled: boolean;
  compression: 'none' | 'gzip' | 'lz4';
  storage_location: string;
  created_at: Date;
  expires_at: Date;
}

export interface DatabaseMetrics {
  deployment_id: string;
  timestamp: Date;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  storage_usage_percent: number;
  connections_active: number;
  connections_max: number;
  queries_per_second: number;
  slow_queries_count: number;
  replication_lag_ms?: number;
}