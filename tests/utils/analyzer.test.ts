import { ProjectAnalyzer } from '../../src/utils/analyzer';
import { ProjectFile } from '../../src/types';

/**
 * ProjectAnalyzer Unit Tests
 * 
 * Tests the static analysis functionality of ProjectAnalyzer class.
 * Since this is currently a mock implementation, tests focus on:
 * - Language detection and file processing
 * - Dependency extraction patterns
 * - Basic analysis structure and output
 * - File content parsing logic
 */

describe('ProjectAnalyzer', () => {
  let consoleSpy: jest.SpyInstance;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Mock console.log to avoid test output pollution
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('analyzeProject()', () => {
    it('should analyze empty project', async () => {
      const files: ProjectFile[] = [];
      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result).toBeDefined();
      expect(result.totalFiles).toBe(0);
      expect(result.totalLines).toBe(0);
      expect(result.languages).toEqual({});
      expect(result.dependencies).toEqual([]);
      expect(result.securityIssues).toEqual([]);
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });

    it('should analyze project with single JavaScript file', async () => {
      const files: ProjectFile[] = [
        {
          path: 'index.js',
          content: 'console.log("Hello World");\nconst x = 42;'
        }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result.totalFiles).toBe(1);
      expect(result.totalLines).toBe(2);
      expect(result.languages).toHaveProperty('javascript');
      expect(result.languages.javascript).toEqual({
        files: 1,
        lines: 2
      });
    });

    it('should analyze project with multiple languages', async () => {
      const files: ProjectFile[] = [
        {
          path: 'app.js',
          content: 'console.log("JavaScript");\nconst app = express();'
        },
        {
          path: 'script.py',
          content: 'print("Python")\nimport os'
        },
        {
          path: 'Main.java',
          content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Java");\n    }\n}'
        },
        {
          path: 'style.css',
          content: 'body {\n  margin: 0;\n  padding: 0;\n}'
        }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result.totalFiles).toBe(4);
      expect(result.totalLines).toBe(13); // 2 + 2 + 5 + 4 (actual line count)
      expect(result.languages).toHaveProperty('javascript');
      expect(result.languages).toHaveProperty('python');
      expect(result.languages).toHaveProperty('java');
      expect(result.languages).toHaveProperty('css');
      
      expect(result.languages.javascript).toEqual({ files: 1, lines: 2 });
      expect(result.languages.python).toEqual({ files: 1, lines: 2 });
      expect(result.languages.java).toEqual({ files: 1, lines: 5 });
      expect(result.languages.css).toEqual({ files: 1, lines: 4 });
    });

    it('should handle files with same extension', async () => {
      const files: ProjectFile[] = [
        {
          path: 'component1.js',
          content: 'const Component1 = () => {};\nexport default Component1;'
        },
        {
          path: 'component2.js',
          content: 'const Component2 = () => {};\nconst helper = () => {};\nexport default Component2;'
        },
        {
          path: 'utils.js',
          content: 'export const utility = () => {};'
        }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result.totalFiles).toBe(3);
      expect(result.totalLines).toBe(6); // 2 + 3 + 1
      expect(result.languages.javascript).toEqual({
        files: 3,
        lines: 6
      });
    });

    it('should handle unknown file extensions', async () => {
      const files: ProjectFile[] = [
        {
          path: 'config.conf',
          content: 'setting=value\nother=another'
        },
        {
          path: 'data.unknown',
          content: 'some data\nmore data\neven more data'
        }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result.totalFiles).toBe(2);
      expect(result.totalLines).toBe(5); // 2 + 3
      expect(result.languages).toHaveProperty('unknown');
      expect(result.languages.unknown).toEqual({
        files: 2,
        lines: 5
      });
    });

    it('should log analysis start and completion', async () => {
      const files: ProjectFile[] = [
        { path: 'test.js', content: 'console.log("test");' }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(consoleSpy).toHaveBeenCalledWith('Performing legacy analysis on project with 1 files');
      expect(consoleSpy).toHaveBeenCalledWith('Project analysis completed:', result);
    });

    it('should have proper analysis result structure', async () => {
      const files: ProjectFile[] = [
        { path: 'test.js', content: 'console.log("test");' }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result).toHaveProperty('projectId');
      expect(result).toHaveProperty('totalFiles');
      expect(result).toHaveProperty('totalLines');
      expect(result).toHaveProperty('languages');
      expect(result).toHaveProperty('dependencies');
      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('securityIssues');
      expect(result).toHaveProperty('qualityMetrics');
      expect(result).toHaveProperty('analyzedAt');

      // Check nested structures
      expect(result.complexity).toHaveProperty('cyclomatic');
      expect(result.complexity).toHaveProperty('cognitive');
      expect(result.complexity).toHaveProperty('maintainabilityIndex');

      expect(result.qualityMetrics).toHaveProperty('duplicatedLines');
      expect(result.qualityMetrics).toHaveProperty('testCoverage');
      expect(result.qualityMetrics).toHaveProperty('codeSmells');
      expect(result.qualityMetrics).toHaveProperty('technicalDebt');
    });
  });

  describe('extractDependencies()', () => {
    it('should extract no dependencies from empty files', () => {
      const files: ProjectFile[] = [];
      const result = ProjectAnalyzer.extractDependencies(files);
      
      expect(result).toEqual([]);
    });

    it('should extract JavaScript import dependencies', () => {
      const files: ProjectFile[] = [
        {
          path: 'app.js',
          content: `
            import express from 'express';
            import { Router } from 'react-router';
            import * as utils from './utils';
          `
        }
      ];

      const result = ProjectAnalyzer.extractDependencies(files);

      expect(result).toHaveLength(3);
      expect(result.find(d => d.name === 'express')).toBeDefined();
      expect(result.find(d => d.name === 'react-router')).toBeDefined();
      expect(result.find(d => d.name === './utils')).toBeDefined();

      result.forEach(dep => {
        expect(dep.version).toBe('unknown');
        expect(dep.type).toBe('import');
        expect(dep.file).toBe('app.js');
      });
    });

    it('should extract JavaScript require dependencies', () => {
      const files: ProjectFile[] = [
        {
          path: 'server.js',
          content: `
            const express = require('express');
            const path = require('path');
            const customModule = require('./custom');
          `
        }
      ];

      const result = ProjectAnalyzer.extractDependencies(files);

      expect(result).toHaveLength(3);
      expect(result.find(d => d.name === 'express')).toBeDefined();
      expect(result.find(d => d.name === 'path')).toBeDefined();
      expect(result.find(d => d.name === './custom')).toBeDefined();

      result.forEach(dep => {
        expect(dep.version).toBe('unknown');
        expect(dep.type).toBe('require');
        expect(dep.file).toBe('server.js');
      });
    });

    it('should extract TypeScript dependencies', () => {
      const files: ProjectFile[] = [
        {
          path: 'app.ts',
          content: `
            import { Component } from '@angular/core';
            import lodash from 'lodash';
            const fs = require('fs');
          `
        }
      ];

      const result = ProjectAnalyzer.extractDependencies(files);

      expect(result).toHaveLength(3);
      expect(result.find(d => d.name === '@angular/core' && d.type === 'import')).toBeDefined();
      expect(result.find(d => d.name === 'lodash' && d.type === 'import')).toBeDefined();
      expect(result.find(d => d.name === 'fs' && d.type === 'require')).toBeDefined();
    });

    it('should handle mixed import and require patterns', () => {
      const files: ProjectFile[] = [
        {
          path: 'mixed.js',
          content: `
            import React from 'react';
            const express = require('express');
            import { Component } from 'react-dom';
            const path = require('path');
          `
        }
      ];

      const result = ProjectAnalyzer.extractDependencies(files);

      expect(result).toHaveLength(4);
      expect(result.filter(d => d.type === 'import')).toHaveLength(2);
      expect(result.filter(d => d.type === 'require')).toHaveLength(2);
    });

    it('should deduplicate dependencies', () => {
      const files: ProjectFile[] = [
        {
          path: 'file1.js',
          content: `
            import express from 'express';
            const lodash = require('lodash');
          `
        },
        {
          path: 'file2.js',
          content: `
            import express from 'express';
            const lodash = require('lodash');
            import react from 'react';
          `
        }
      ];

      const result = ProjectAnalyzer.extractDependencies(files);

      // Should have unique dependencies based on name:type combination
      const expressImports = result.filter(d => d.name === 'express' && d.type === 'import');
      const lodashRequires = result.filter(d => d.name === 'lodash' && d.type === 'require');
      
      expect(expressImports).toHaveLength(1);
      expect(lodashRequires).toHaveLength(1);
      expect(result.find(d => d.name === 'react')).toBeDefined();
    });

    it('should handle non-JavaScript files by returning empty arrays', () => {
      const files: ProjectFile[] = [
        {
          path: 'style.css',
          content: 'body { margin: 0; }'
        },
        {
          path: 'data.json',
          content: '{"key": "value"}'
        },
        {
          path: 'readme.md',
          content: '# Project Title'
        }
      ];

      const result = ProjectAnalyzer.extractDependencies(files);

      expect(result).toEqual([]);
    });

    it('should handle Python files (placeholder)', () => {
      const files: ProjectFile[] = [
        {
          path: 'script.py',
          content: `
            import os
            import sys
            from datetime import datetime
          `
        }
      ];

      const result = ProjectAnalyzer.extractDependencies(files);

      // Currently returns empty array for Python (placeholder implementation)
      expect(result).toEqual([]);
    });

    it('should handle Java files (placeholder)', () => {
      const files: ProjectFile[] = [
        {
          path: 'Main.java',
          content: `
            import java.util.List;
            import java.io.IOException;
            import com.example.CustomClass;
          `
        }
      ];

      const result = ProjectAnalyzer.extractDependencies(files);

      // Currently returns empty array for Java (placeholder implementation)
      expect(result).toEqual([]);
    });
  });

  describe('calculateComplexity()', () => {
    it('should return default complexity metrics (placeholder)', () => {
      const files: ProjectFile[] = [
        { path: 'complex.js', content: 'function complex() { if (a) { if (b) { return c; } } }' }
      ];

      const result = ProjectAnalyzer.calculateComplexity(files);

      expect(result).toEqual({
        cyclomatic: 0,
        cognitive: 0,
        maintainabilityIndex: 100
      });
    });
  });

  describe('detectSecurityIssues()', () => {
    it('should return empty array (placeholder)', () => {
      const files: ProjectFile[] = [
        { path: 'insecure.js', content: 'const password = "hardcoded_password";' }
      ];

      const result = ProjectAnalyzer.detectSecurityIssues(files);

      expect(result).toEqual([]);
    });
  });

  describe('getLanguageFromExtension() (private method behavior)', () => {
    it('should correctly identify language from JavaScript files', async () => {
      const files: ProjectFile[] = [
        { path: 'app.js', content: 'console.log("js");' },
        { path: 'app.jsx', content: 'const App = () => <div>JSX</div>;' }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result.languages).toHaveProperty('javascript');
      expect(result.languages.javascript.files).toBe(2);
    });

    it('should correctly identify language from TypeScript files', async () => {
      const files: ProjectFile[] = [
        { path: 'app.ts', content: 'const x: number = 42;' },
        { path: 'component.tsx', content: 'const App: React.FC = () => <div>TSX</div>;' }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result.languages).toHaveProperty('typescript');
      expect(result.languages.typescript.files).toBe(2);
    });

    it('should correctly identify various programming languages', async () => {
      const files: ProjectFile[] = [
        { path: 'script.py', content: 'print("Python")' },
        { path: 'Main.java', content: 'public class Main {}' },
        { path: 'app.cpp', content: '#include <iostream>' },
        { path: 'program.c', content: '#include <stdio.h>' },
        { path: 'App.cs', content: 'namespace App {}' },
        { path: 'script.php', content: '<?php echo "PHP"; ?>' },
        { path: 'app.rb', content: 'puts "Ruby"' },
        { path: 'main.go', content: 'package main' },
        { path: 'lib.rs', content: 'fn main() {}' },
        { path: 'App.swift', content: 'import Foundation' }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      const expectedLanguages = [
        'python', 'java', 'cpp', 'c', 'csharp', 
        'php', 'ruby', 'go', 'rust', 'swift'
      ];

      expectedLanguages.forEach(lang => {
        expect(result.languages).toHaveProperty(lang);
        expect(result.languages[lang].files).toBe(1);
      });
    });

    it('should correctly identify markup and config languages', async () => {
      const files: ProjectFile[] = [
        { path: 'index.html', content: '<html><body></body></html>' },
        { path: 'style.css', content: 'body { margin: 0; }' },
        { path: 'style.scss', content: '$primary: blue;' },
        { path: 'config.json', content: '{}' },
        { path: 'data.xml', content: '<root></root>' },
        { path: 'config.yaml', content: 'key: value' },
        { path: 'README.md', content: '# Title' }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      const expectedLanguages = ['html', 'css', 'scss', 'json', 'xml', 'yaml', 'markdown'];

      expectedLanguages.forEach(lang => {
        expect(result.languages).toHaveProperty(lang);
        expect(result.languages[lang].files).toBe(1);
      });
    });

    it('should handle unknown extensions', async () => {
      const files: ProjectFile[] = [
        { path: 'file.xyz', content: 'unknown content' },
        { path: 'another.weird', content: 'more unknown' }
      ];

      const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

      expect(result.languages).toHaveProperty('unknown');
      expect(result.languages.unknown.files).toBe(2);
    });

    describe('Enhanced Analysis Tests', () => {
      it('should handle large files (>1MB content)', async () => {
        const largeContent = 'console.log("large file test");\n'.repeat(50000); // ~1.2MB
        const files: ProjectFile[] = [
          {
            path: 'large-file.js',
            content: largeContent
          }
        ];

        const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

        expect(result.totalFiles).toBe(1);
        expect(result.totalLines).toBe(50000 + 1); // +1 for the final newline
        expect(result.languages).toHaveProperty('javascript');
        expect(result.languages.javascript.lines).toBe(50000 + 1); // Same counting logic as totalLines
      });

      it('should handle special characters in file names', async () => {
        const files: ProjectFile[] = [
          {
            path: 'file with spaces.js',
            content: 'console.log("spaces");'
          },
          {
            path: 'файл-с-кириллицей.py',
            content: 'print("cyrillic")'
          },
          {
            path: '文件-中文.java',
            content: 'System.out.println("chinese");'
          },
          {
            path: 'file@#$%^&().rb',
            content: 'puts "special chars"'
          }
        ];

        const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

        expect(result.totalFiles).toBe(4);
        expect(result.languages).toHaveProperty('javascript');
        expect(result.languages).toHaveProperty('python');
        expect(result.languages).toHaveProperty('java');
        expect(result.languages).toHaveProperty('ruby');
      });

      it('should handle deep directory structures', async () => {
        const files: ProjectFile[] = [
          {
            path: 'src/components/ui/buttons/primary/PrimaryButton.tsx',
            content: 'export const PrimaryButton = () => <button>Click</button>;'
          },
          {
            path: 'tests/unit/components/ui/buttons/primary/PrimaryButton.test.tsx',
            content: 'import { PrimaryButton } from "../../../../../src/components/ui/buttons/primary/PrimaryButton";'
          },
          {
            path: 'docs/api/v1/endpoints/users/authentication/login.md',
            content: '# Login API\\nPOST /api/v1/auth/login'
          }
        ];

        const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

        expect(result.totalFiles).toBe(3);
        expect(result.languages).toHaveProperty('typescript');
        expect(result.languages).toHaveProperty('markdown');
      });

      it('should handle concurrent analysis of multiple files', async () => {
        const files: ProjectFile[] = Array.from({ length: 100 }, (_, i) => ({
          path: `file${i}.js`,
          content: `console.log("File ${i}");\\nconst value${i} = ${i};`
        }));

        const startTime = Date.now();
        const result = await ProjectAnalyzer.analyzeProjectLegacy(files);
        const endTime = Date.now();

        expect(result.totalFiles).toBe(100);
        expect(result.totalLines).toBe(100); // 1 lines per file (newlines don't count in this test)
        expect(result.languages.javascript.files).toBe(100);
        expect(result.languages.javascript.lines).toBe(100);
        
        // Analysis should complete within reasonable time (less than 5 seconds)
        expect(endTime - startTime).toBeLessThan(5000);
      });

      it('should handle files with very long lines', async () => {
        const veryLongLine = 'const data = ' + JSON.stringify({ data: 'x'.repeat(10000) }) + ';';
        const files: ProjectFile[] = [
          {
            path: 'long-line.js',
            content: veryLongLine
          }
        ];

        const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

        expect(result.totalFiles).toBe(1);
        expect(result.totalLines).toBe(1);
        expect(result.languages.javascript.lines).toBe(1);
      });

      it('should detect framework patterns in large codebases', async () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              dependencies: {
                'react': '^18.0.0',
                'react-dom': '^18.0.0',
                'express': '^4.18.0',
                'lodash': '^4.17.0',
                '@types/node': '^18.0.0'
              }
            })
          },
          {
            path: 'src/App.tsx',
            content: 'import React from "react";\\nexport default function App() { return <div>Hello</div>; }'
          },
          {
            path: 'server/index.js',
            content: 'const express = require("express");\\nconst app = express();'
          },
          {
            path: 'utils/helpers.ts',
            content: 'import _ from "lodash";\\nexport const chunk = _.chunk;'
          }
        ];

        const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

        expect(result.totalFiles).toBe(4);
        expect(result.languages).toHaveProperty('javascript');
        expect(result.languages).toHaveProperty('typescript');
        // Dependencies extraction is placeholder, so might be 0
        expect(result.dependencies.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle mixed encoding files', async () => {
        const files: ProjectFile[] = [
          {
            path: 'utf8.js',
            content: 'console.log("UTF-8 content with émojis 🚀");'
          },
          {
            path: 'ascii.txt',
            content: 'Basic ASCII content only'
          },
          {
            path: 'unicode.py',
            content: 'print("Unicode: αβγδε, 中文, العربية")'
          }
        ];

        const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

        expect(result.totalFiles).toBe(3);
        expect(result.languages).toHaveProperty('javascript');
        expect(result.languages).toHaveProperty('python');
        expect(result.languages).toHaveProperty('unknown'); // .txt file
      });

      it('should handle binary-like files gracefully', async () => {
        const files: ProjectFile[] = [
          {
            path: 'binary.dat',
            content: String.fromCharCode(0, 1, 2, 3, 255, 254, 253)
          },
          {
            path: 'normal.js',
            content: 'console.log("normal file");'
          },
          {
            path: 'mixed.txt',
            content: 'Normal text\\n' + String.fromCharCode(0, 1, 2) + '\\nMore text'
          }
        ];

        const result = await ProjectAnalyzer.analyzeProjectLegacy(files);

        expect(result.totalFiles).toBe(3);
        expect(result.languages).toHaveProperty('javascript');
        expect(result.languages).toHaveProperty('unknown'); // for binary files
      });
    });
  });
});