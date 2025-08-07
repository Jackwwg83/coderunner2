// Phase 1 功能演示
const { ProjectAnalyzer } = require('./dist/utils/analyzer');
const ManifestEngine = require('./dist/services/manifestEngine').default || require('./dist/services/manifestEngine').ManifestEngine;

console.log('🚀 CodeRunner v2.0 Phase 1 功能演示\n');

// 演示 1: ProjectAnalyzer - Node.js 项目识别
console.log('📦 演示 1: ProjectAnalyzer - Node.js 项目');
console.log('='.repeat(50));

const nodejsFiles = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
      scripts: {
        start: 'node server.js',
        dev: 'nodemon server.js'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5'
      }
    }, null, 2)
  },
  {
    path: 'server.js',
    content: 'const express = require("express");\nconst app = express();'
  }
];

const nodejsAnalysis = ProjectAnalyzer.analyzeProject(nodejsFiles);
console.log('分析结果:', JSON.stringify(nodejsAnalysis, null, 2));

// 演示 2: ProjectAnalyzer - Manifest 项目识别
console.log('\n📦 演示 2: ProjectAnalyzer - Manifest 项目');
console.log('='.repeat(50));

const manifestFiles = [
  {
    path: 'manifest.yaml',
    content: `name: todo-app
version: 1.0.0
entities:
  - name: Task
    fields:
      - name: title
        type: string
        required: true
      - name: completed
        type: boolean
      - name: priority
        type: number`
  }
];

const manifestAnalysis = ProjectAnalyzer.analyzeProject(manifestFiles);
console.log('分析结果:', JSON.stringify(manifestAnalysis, null, 2));

// 演示 3: ManifestEngine - 代码生成
console.log('\n🔧 演示 3: ManifestEngine - 代码生成');
console.log('='.repeat(50));

// 创建 ManifestEngine 实例
const engine = typeof ManifestEngine === 'function' ? new ManifestEngine() : ManifestEngine;
const generateProject = engine.generateProject ? engine.generateProject.bind(engine) : engine;

try {
  const generatedFiles = typeof generateProject === 'function' 
    ? generateProject(manifestFiles[0].content)
    : ManifestEngine.generateProject(manifestFiles[0].content);
    
  console.log(`生成了 ${generatedFiles.length} 个文件:`);
  generatedFiles.forEach(file => {
    console.log(`  - ${file.path} (${file.content.length} bytes)`);
  });

  // 显示生成的 package.json
  const packageJson = generatedFiles.find(f => f.path === 'package.json');
  if (packageJson) {
    console.log('\n生成的 package.json 片段:');
    const parsed = JSON.parse(packageJson.content);
    console.log(JSON.stringify({
      name: parsed.name,
      version: parsed.version,
      dependencies: Object.keys(parsed.dependencies || {})
    }, null, 2));
  }

  // 显示生成的 API 路由片段
  const indexJs = generatedFiles.find(f => f.path === 'index.js');
  if (indexJs) {
    console.log('\n生成的 Express.js 服务器代码示例 (前20行):');
    const lines = indexJs.content.split('\n').slice(0, 20);
    console.log(lines.join('\n'));
  }
} catch (error) {
  console.error('代码生成错误:', error.message);
}

console.log('\n✅ Phase 1 核心功能演示完成！');
console.log('\n📊 完成状态总结:');
console.log('  ✅ P1-T01: ProjectAnalyzer - 项目类型识别 (nodejs/manifest)');
console.log('  ✅ P1-T02: ManifestEngine - YAML 到 Express.js 代码生成');
console.log('\n📝 待执行任务:');
console.log('  ⏳ P1-T03: 重构 OrchestrationService 整合以上功能');
console.log('  ⏳ P1-T04: 创建 /deploy API 端点');
console.log('  ⏳ P1-T05: 编写集成测试');