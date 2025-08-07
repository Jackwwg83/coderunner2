import { ProjectAnalyzer, ProjectAnalysis } from '../../utils/analyzer';
import { ProjectFile } from '../../types/index';

describe('ProjectAnalyzer', () => {
  describe('analyzeProject', () => {
    describe('Node.js project detection', () => {
      it('should detect Node.js project with package.json', () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'test-app',
              version: '1.0.0',
              main: 'index.js',
              scripts: {
                start: 'node index.js'
              }
            })
          }
        ];

        const result: ProjectAnalysis = ProjectAnalyzer.analyzeProject(files);

        expect(result.projectType).toBe('nodejs');
        expect(result.startCommand).toBe('npm start');
        expect(result.dependencies).toContain('npm');
        expect(result.version).toBe('1.0.0');
        expect(result.entryPoint).toBe('index.js');
      });

      it('should detect Express framework', () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'express-app',
              dependencies: {
                express: '^4.18.0'
              }
            })
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.framework).toBe('express');
      });

      it('should detect React framework', () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'react-app',
              dependencies: {
                react: '^18.0.0',
                'react-dom': '^18.0.0'
              }
            })
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.framework).toBe('react');
      });

      it('should detect Next.js framework', () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'nextjs-app',
              dependencies: {
                next: '^13.0.0'
              }
            })
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.framework).toBe('next');
      });

      it('should use dev script when start script is missing', () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'dev-app',
              scripts: {
                dev: 'nodemon index.js'
              }
            })
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.startCommand).toBe('npm run dev');
      });

      it('should use main field when no scripts available', () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'main-app',
              main: 'server.js'
            })
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.startCommand).toBe('node server.js');
      });

      it('should handle malformed package.json gracefully', () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: '{ invalid json'
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.projectType).toBe('nodejs');
        expect(result.framework).toBe('malformed-package-json');
        expect(result.startCommand).toBe('node index.js');
      });
    });

    describe('Manifest project detection', () => {
      it('should detect Manifest project with manifest.yaml', () => {
        const files: ProjectFile[] = [
          {
            path: 'manifest.yaml',
            content: `name: my-api
version: 1.2.0
entities:
  User:
    fields:
      name: string
      email: string`
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.projectType).toBe('manifest');
        expect(result.startCommand).toBe('npm start');
        expect(result.dependencies).toContain('npm');
        expect(result.framework).toBe('manifest-generated');
        expect(result.version).toBe('1.2.0');
        expect(result.entryPoint).toBe('index.js');
      });

      it('should detect Manifest project with manifest.yml', () => {
        const files: ProjectFile[] = [
          {
            path: 'manifest.yml',
            content: `name: another-api
version: 2.0.0`
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.projectType).toBe('manifest');
        expect(result.version).toBe('2.0.0');
      });

      it('should handle malformed manifest.yaml gracefully', () => {
        const files: ProjectFile[] = [
          {
            path: 'manifest.yaml',
            content: 'invalid yaml content without colons'
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.projectType).toBe('manifest');
        expect(result.framework).toBe('manifest-generated');
        expect(result.startCommand).toBe('npm start');
        expect(result.version).toBeUndefined();
      });

      it('should prioritize manifest over package.json', () => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'nodejs-app'
            })
          },
          {
            path: 'manifest.yaml',
            content: 'name: manifest-app'
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.projectType).toBe('manifest');
      });
    });

    describe('Unknown project handling', () => {
      it('should default to Node.js for unknown project types', () => {
        const files: ProjectFile[] = [
          {
            path: 'index.html',
            content: '<html><body>Hello</body></html>'
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.projectType).toBe('nodejs');
        expect(result.startCommand).toBe('node index.js');
        expect(result.framework).toBe('unknown');
      });

      it('should handle empty file list', () => {
        const files: ProjectFile[] = [];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.projectType).toBe('nodejs');
        expect(result.startCommand).toBe('node index.js');
        expect(result.framework).toBe('unknown');
      });
    });
  });

  describe('Framework detection', () => {
    it('should detect various Node.js frameworks correctly', () => {
      const testCases = [
        { deps: { fastify: '^4.0.0' }, expected: 'fastify' },
        { deps: { koa: '^2.0.0' }, expected: 'koa' },
        { deps: { '@nestjs/core': '^9.0.0' }, expected: 'nestjs' },
        { deps: { vue: '^3.0.0' }, expected: 'vue' },
        { deps: { '@angular/core': '^15.0.0' }, expected: 'angular' },
        { deps: { '@hapi/hapi': '^20.0.0' }, expected: 'hapi' }
      ];

      testCases.forEach(({ deps, expected }) => {
        const files: ProjectFile[] = [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'test-app',
              dependencies: deps
            })
          }
        ];

        const result = ProjectAnalyzer.analyzeProject(files);
        expect(result.framework).toBe(expected);
      });
    });

    it('should prioritize more specific frameworks', () => {
      const files: ProjectFile[] = [
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'complex-app',
            dependencies: {
              react: '^18.0.0',
              next: '^13.0.0', // Next.js should take priority over React
              express: '^4.18.0'
            }
          })
        }
      ];

      const result = ProjectAnalyzer.analyzeProject(files);
      expect(result.framework).toBe('next'); // Most specific framework wins
    });

    it('should check devDependencies as well', () => {
      const files: ProjectFile[] = [
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'dev-deps-app',
            devDependencies: {
              '@vue/cli-service': '^5.0.0'
            }
          })
        }
      ];

      const result = ProjectAnalyzer.analyzeProject(files);
      expect(result.framework).toBe('vue');
    });
  });
});