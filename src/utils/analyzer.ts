// import * as fs from 'fs'; // TODO: Implement when needed
import * as path from 'path';
import { ProjectFile, AnalysisResult, CodeComplexity, DependencyInfo } from '../types/index';

/**
 * Project detection and analysis results
 */
export interface ProjectAnalysis {
  projectType: 'nodejs' | 'manifest';
  startCommand: string;
  dependencies: string[];
  framework?: string;     // e.g., 'express', 'react', 'next'
  version?: string | undefined;        // from package.json
  entryPoint?: string | undefined;     // main file
}

/**
 * Package.json structure for Node.js projects
 */
interface PackageJson {
  name?: string;
  version?: string;
  main?: string;
  scripts?: { [key: string]: string };
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
}

/**
 * Manifest.yaml structure for Manifest projects
 */
interface ManifestConfig {
  name?: string;
  version?: string;
  entities?: { [key: string]: any };
  // Add other manifest properties as needed
}

/**
 * ProjectAnalyzer - Analyzes project code and structure
 * 
 * This utility provides:
 * - Project type detection (Node.js vs Manifest)
 * - Project metadata extraction
 * - Static code analysis
 * - Dependency analysis
 * - Code complexity metrics
 * - Security vulnerability detection
 * - Code quality assessment
 */
export class ProjectAnalyzer {
  
  /**
   * Analyze project files to determine type and extract metadata
   * Supports Node.js and Manifest project types
   */
  public static analyzeProject(files: ProjectFile[]): ProjectAnalysis {
    console.log(`Analyzing project with ${files.length} files`);
    
    // Check for project type indicators
    const hasPackageJson = files.some(file => file.path === 'package.json');
    const manifestFile = files.find(file => file.path === 'manifest.yaml' || file.path === 'manifest.yml');
    
    if (manifestFile) {
      return this.analyzeManifestProject(files, manifestFile);
    } else if (hasPackageJson) {
      return this.analyzeNodeJsProject(files);
    } else {
      // Default fallback - treat as basic Node.js project
      return {
        projectType: 'nodejs',
        startCommand: 'node index.js',
        dependencies: ['npm'],
        framework: 'unknown'
      };
    }
  }

  /**
   * Analyze Node.js project based on package.json
   */
  private static analyzeNodeJsProject(files: ProjectFile[]): ProjectAnalysis {
    const packageJsonFile = files.find(file => file.path === 'package.json');
    
    if (!packageJsonFile) {
      // Shouldn't happen but handle gracefully
      return {
        projectType: 'nodejs',
        startCommand: 'node index.js',
        dependencies: ['npm']
      };
    }

    let packageJson: PackageJson = {};
    try {
      packageJson = JSON.parse(packageJsonFile.content);
    } catch (error) {
      console.warn('Failed to parse package.json:', error);
      return {
        projectType: 'nodejs',
        startCommand: 'node index.js',
        dependencies: ['npm'],
        framework: 'malformed-package-json'
      };
    }

    // Determine start command
    let startCommand = 'npm start'; // Default
    if (packageJson.scripts?.start) {
      startCommand = 'npm start';
    } else if (packageJson.scripts?.dev) {
      startCommand = 'npm run dev';
    } else if (packageJson.main) {
      startCommand = `node ${packageJson.main}`;
    } else {
      startCommand = 'node index.js';
    }

    // Detect framework
    const framework = this.detectNodeJsFramework(packageJson);
    
    return {
      projectType: 'nodejs',
      startCommand,
      dependencies: ['npm'],
      framework,
      version: packageJson.version,
      entryPoint: packageJson.main || 'index.js'
    };
  }

  /**
   * Analyze Manifest project based on manifest.yaml/yml
   */
  private static analyzeManifestProject(files: ProjectFile[], manifestFile: ProjectFile): ProjectAnalysis {
    let manifestConfig: ManifestConfig = {};
    
    try {
      // Simple YAML parsing - in production, use a proper YAML parser like 'js-yaml'
      // For now, we'll do basic validation to ensure it's a valid structure
      const content = manifestFile.content.trim();
      
      // Basic YAML structure validation
      if (!content || !content.includes(':')) {
        throw new Error('Invalid YAML structure');
      }
      
      // For now, we'll assume it's valid and extract basic info
      // TODO: Implement proper YAML parsing when js-yaml is available
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('name:')) {
          const name = line.split('name:')[1]?.trim().replace(/["']/g, '');
          if (name) manifestConfig.name = name;
        }
        if (line.trim().startsWith('version:')) {
          const version = line.split('version:')[1]?.trim().replace(/["']/g, '');
          if (version) manifestConfig.version = version;
        }
      }
      
    } catch (error) {
      console.warn('Failed to parse manifest file:', error);
      // Continue with defaults
    }

    return {
      projectType: 'manifest',
      startCommand: 'npm start', // Default for generated Express apps
      dependencies: ['npm'],
      framework: 'manifest-generated',
      version: manifestConfig.version,
      entryPoint: 'index.js' // Generated Express apps typically use index.js
    };
  }

  /**
   * Detect Node.js framework from package.json dependencies
   */
  private static detectNodeJsFramework(packageJson: PackageJson): string {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Check for popular frameworks in order of specificity
    if (allDeps.next || allDeps['next']) return 'next';
    if (allDeps.nuxt || allDeps['@nuxt/core']) return 'nuxt';
    if (allDeps.express) return 'express';
    if (allDeps.react || allDeps['react-dom']) return 'react';
    if (allDeps.vue || allDeps['@vue/cli-service']) return 'vue';
    if (allDeps.angular || allDeps['@angular/core']) return 'angular';
    if (allDeps.nestjs || allDeps['@nestjs/core']) return 'nestjs';
    if (allDeps.fastify) return 'fastify';
    if (allDeps.koa) return 'koa';
    if (allDeps.hapi || allDeps['@hapi/hapi']) return 'hapi';
    
    return 'nodejs'; // Generic Node.js project
  }

  /**
   * Analyze project files and structure (Legacy method for code analysis)
   * TODO: Implement comprehensive analysis
   */
  public static async analyzeProjectLegacy(files: ProjectFile[]): Promise<AnalysisResult> {
    console.log(`Performing legacy analysis on project with ${files.length} files`);
    
    const analysis: AnalysisResult = {
      projectId: '',
      totalFiles: files.length,
      totalLines: 0,
      languages: {},
      dependencies: [],
      complexity: {
        cyclomatic: 0,
        cognitive: 0,
        maintainabilityIndex: 100
      },
      securityIssues: [],
      qualityMetrics: {
        duplicatedLines: 0,
        testCoverage: 0,
        codeSmells: 0,
        technicalDebt: 0
      },
      analyzedAt: new Date()
    };

    // Analyze each file
    for (const file of files) {
      await this.analyzeFile(file, analysis);
    }

    // Calculate final metrics
    this.calculateFinalMetrics(analysis);

    console.log('Project analysis completed:', analysis);
    return analysis;
  }

  /**
   * Analyze individual file
   * TODO: Implement detailed file analysis
   */
  private static async analyzeFile(file: ProjectFile, analysis: AnalysisResult): Promise<void> {
    const extension = path.extname(file.path).toLowerCase();
    const language = this.getLanguageFromExtension(extension);
    
    // Count lines
    const lines = file.content.split('\n').length;
    analysis.totalLines += lines;
    
    // Track languages
    if (!analysis.languages[language]) {
      analysis.languages[language] = { files: 0, lines: 0 };
    }
    analysis.languages[language].files++;
    analysis.languages[language].lines += lines;

    // TODO: Implement more sophisticated analysis
    // - Parse AST for complexity metrics
    // - Detect security vulnerabilities
    // - Analyze dependencies
    // - Check code quality patterns
  }

  /**
   * Detect dependencies from file content
   * TODO: Implement for different languages
   */
  public static extractDependencies(files: ProjectFile[]): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    
    for (const file of files) {
      const fileDeps = this.extractFileDependencies(file);
      dependencies.push(...fileDeps);
    }

    // Remove duplicates and return
    return this.deduplicateDependencies(dependencies);
  }

  /**
   * Extract dependencies from a single file
   * TODO: Implement parsers for different languages
   */
  private static extractFileDependencies(file: ProjectFile): DependencyInfo[] {
    // const _dependencies: DependencyInfo[] = [];
    const extension = path.extname(file.path).toLowerCase();
    
    switch (extension) {
    case '.js':
    case '.ts':
      return ProjectAnalyzer.extractJavaScriptDependencies(file);
    case '.py':
      return ProjectAnalyzer.extractPythonDependencies(file);
    case '.java':
      return ProjectAnalyzer.extractJavaDependencies(file);
    default:
      return [];
    }
  }

  /**
   * Extract JavaScript/TypeScript dependencies
   * TODO: Implement proper parsing
   */
  private static extractJavaScriptDependencies(file: ProjectFile): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const content = file.content;
    
    // Simple regex-based extraction (TODO: use proper AST parsing)
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    
    let match;
    
    // Extract imports
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push({
        name: match[1],
        version: 'unknown',
        type: 'import',
        file: file.path
      });
    }
    
    // Extract requires
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push({
        name: match[1],
        version: 'unknown',
        type: 'require',
        file: file.path
      });
    }
    
    return dependencies;
  }

  /**
   * Extract Python dependencies
   * TODO: Implement Python import parsing
   */
  private static extractPythonDependencies(_file: ProjectFile): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    // TODO: Implement Python import extraction
    return dependencies;
  }

  /**
   * Extract Java dependencies
   * TODO: Implement Java import parsing
   */
  private static extractJavaDependencies(_file: ProjectFile): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    // TODO: Implement Java import extraction
    return dependencies;
  }

  /**
   * Calculate code complexity metrics
   * TODO: Implement proper complexity calculation
   */
  public static calculateComplexity(_files: ProjectFile[]): CodeComplexity {
    // TODO: Implement cyclomatic complexity calculation
    // TODO: Implement cognitive complexity calculation
    // TODO: Calculate maintainability index
    
    return {
      cyclomatic: 0,
      cognitive: 0,
      maintainabilityIndex: 100
    };
  }

  /**
   * Detect potential security issues
   * TODO: Implement security analysis
   */
  public static detectSecurityIssues(_files: ProjectFile[]): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    file: string;
    line?: number;
  }> {
    // TODO: Implement security vulnerability detection
    // - SQL injection patterns
    // - XSS vulnerabilities
    // - Hardcoded secrets
    // - Insecure dependencies
    return [];
  }

  /**
   * Get programming language from file extension
   */
  private static getLanguageFromExtension(extension: string): string {
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown'
    };

    return languageMap[extension] || 'unknown';
  }

  /**
   * Remove duplicate dependencies
   */
  private static deduplicateDependencies(dependencies: DependencyInfo[]): DependencyInfo[] {
    const seen = new Set<string>();
    return dependencies.filter(dep => {
      const key = `${dep.name}:${dep.type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate final analysis metrics
   */
  private static calculateFinalMetrics(_analysis: AnalysisResult): void {
    // TODO: Implement final metric calculations
    // - Complexity scoring
    // - Quality assessment
    // - Risk analysis
  }
}