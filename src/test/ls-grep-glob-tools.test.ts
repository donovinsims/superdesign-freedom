import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LSTool, LSToolParams } from '../tools/ls-tool';
import { GrepTool, GrepToolParams } from '../tools/grep-tool';
import { GlobTool, GlobToolParams } from '../tools/glob-tool';
import { ExecutionContext } from '../tools/base-tool';

// Mock VS Code output channel for testing
const mockOutputChannel = {
  appendLine: (message: string) => console.log(`[LOG] ${message}`),
  append: (message: string) => console.log(`[LOG] ${message}`),
  clear: () => {},
  show: () => {},
  hide: () => {},
  dispose: () => {},
  name: 'Test',
  replace: () => {},
};

/**
 * Helper function to create test environment and tools
 */
function createTestEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'superdesign-ls-grep-glob-test-'));
  
  const context: ExecutionContext = {
    workingDirectory: tempDir,
    outputChannel: mockOutputChannel,
    sessionId: 'test-session'
  };

  const lsTool = new LSTool();
  const grepTool = new GrepTool();
  const globTool = new GlobTool();

  return { tempDir, context, lsTool, grepTool, globTool };
}

/**
 * Helper function to create test file structure
 */
function createTestFiles(baseDir: string) {
  // Create directory structure
  fs.mkdirSync(path.join(baseDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'src', 'components'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, '.hidden'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'node_modules'), { recursive: true });

  // Create test files with various content
  fs.writeFileSync(
    path.join(baseDir, 'src', 'index.ts'), 
    'export function hello() {\n  console.log("Hello World");\n}\n\nclass MyClass {\n  constructor() {}\n}'
  );
  
  fs.writeFileSync(
    path.join(baseDir, 'src', 'utils.js'),
    'function helper() {\n  return "helper function";\n}\n\nexport { helper };'
  );
  
  fs.writeFileSync(
    path.join(baseDir, 'src', 'components', 'Button.tsx'),
    'import React from "react";\n\nfunction Button() {\n  return <button>Click me</button>;\n}'
  );
  
  fs.writeFileSync(
    path.join(baseDir, 'docs', 'README.md'),
    '# Test Project\n\nThis is a test function for our tools.\n\n## Usage\n\nCall the function like this.'
  );
  
  fs.writeFileSync(
    path.join(baseDir, 'package.json'),
    '{\n  "name": "test-project",\n  "version": "1.0.0",\n  "scripts": {\n    "test": "jest"\n  }\n}'
  );
  
  fs.writeFileSync(
    path.join(baseDir, '.hidden', 'secret.txt'),
    'This is a hidden file with secret content.'
  );
  
  fs.writeFileSync(
    path.join(baseDir, 'node_modules', 'lib.js'),
    'module.exports = "library code";'
  );

  // Create a log file to test ignore patterns
  fs.writeFileSync(
    path.join(baseDir, 'debug.log'),
    'LOG: Application started\nLOG: Function called\n'
  );
}

/**
 * Test LSTool functionality
 */
async function testLSTool(): Promise<boolean> {
  console.log('\n=== Testing LSTool ===');
  
  const { tempDir, context, lsTool } = createTestEnvironment();
  
  try {
    createTestFiles(tempDir);
    
    // Test 1: Basic directory listing
    console.log('Test 1: Basic directory listing');
    const basicParams: LSToolParams = {};
    const basicResult = await lsTool.execute(basicParams, context);
    
    if (!basicResult.success || !basicResult.result) {
      console.error('❌ Basic listing failed');
      return false;
    }
    
    const entries = basicResult.result.entries;
    if (!Array.isArray(entries) || entries.length < 4) {
      console.error('❌ Expected multiple entries, got:', entries?.length);
      return false;
    }
    
    console.log('✅ Basic listing works');
    
    // Test 2: Detailed listing
    console.log('Test 2: Detailed listing');
    const detailedParams: LSToolParams = { detailed: true };
    const detailedResult = await lsTool.execute(detailedParams, context);
    
    if (!detailedResult.success || !detailedResult.result?.detailed_listing) {
      console.error('❌ Detailed listing failed');
      return false;
    }
    
    console.log('✅ Detailed listing works');
    
    // Test 3: Show hidden files
    console.log('Test 3: Show hidden files');
    const hiddenParams: LSToolParams = { show_hidden: true };
    const hiddenResult = await lsTool.execute(hiddenParams, context);
    
    if (!hiddenResult.success || !hiddenResult.result) {
      console.error('❌ Hidden files listing failed');
      return false;
    }
    
    const hasHiddenFile = hiddenResult.result.entries.some((e: any) => e.name.startsWith('.'));
    if (!hasHiddenFile) {
      console.error('❌ Hidden files not shown');
      return false;
    }
    
    console.log('✅ Hidden files listing works');
    
    // Test 4: Ignore patterns
    console.log('Test 4: Ignore patterns');
    const ignoreParams: LSToolParams = { ignore: ['*.log', 'node_modules'] };
    const ignoreResult = await lsTool.execute(ignoreParams, context);
    
    if (!ignoreResult.success || !ignoreResult.result) {
      console.error('❌ Ignore patterns failed');
      return false;
    }
    
    const hasLogFile = ignoreResult.result.entries.some((e: any) => e.name.endsWith('.log'));
    const hasNodeModules = ignoreResult.result.entries.some((e: any) => e.name === 'node_modules');
    
    if (hasLogFile || hasNodeModules) {
      console.error('❌ Ignore patterns not working');
      return false;
    }
    
    console.log('✅ Ignore patterns work');
    
    // Test 5: Subdirectory listing
    console.log('Test 5: Subdirectory listing');
    const subDirParams: LSToolParams = { path: 'src' };
    const subDirResult = await lsTool.execute(subDirParams, context);
    
    if (!subDirResult.success || !subDirResult.result) {
      console.error('❌ Subdirectory listing failed');
      return false;
    }
    
    console.log('✅ Subdirectory listing works');
    
    return true;
    
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Test GrepTool functionality
 */
async function testGrepTool(): Promise<boolean> {
  console.log('\n=== Testing GrepTool ===');
  
  const { tempDir, context, grepTool } = createTestEnvironment();
  
  try {
    createTestFiles(tempDir);
    
    // Test 1: Basic pattern search
    console.log('Test 1: Basic pattern search');
    const basicParams: GrepToolParams = { pattern: 'function' };
    const basicResult = await grepTool.execute(basicParams, context);
    
    if (!basicResult.success || !basicResult.result) {
      console.error('❌ Basic search failed');
      return false;
    }
    
    const matches = basicResult.result.matches;
    if (!Array.isArray(matches) || matches.length === 0) {
      console.error('❌ Expected matches, got:', matches?.length);
      return false;
    }
    
    console.log('✅ Basic pattern search works');
    
    // Test 2: Case-sensitive search
    console.log('Test 2: Case-sensitive search');
    const caseParams: GrepToolParams = { 
      pattern: 'Function', 
      case_sensitive: true 
    };
    const caseResult = await grepTool.execute(caseParams, context);
    
    if (!caseResult.success) {
      console.error('❌ Case-sensitive search failed');
      return false;
    }
    
    // Should have fewer matches (only exact case)
    const caseMatches = caseResult.result?.matches || [];
    const insensitiveMatches = matches;
    
    if (caseMatches.length > insensitiveMatches.length) {
      console.error('❌ Case-sensitive search returned more matches than insensitive');
      return false;
    }
    
    console.log('✅ Case-sensitive search works');
    
    // Test 3: File pattern filtering
    console.log('Test 3: File pattern filtering');
    const filterParams: GrepToolParams = { 
      pattern: 'export', 
      include: '*.ts' 
    };
    const filterResult = await grepTool.execute(filterParams, context);
    
    if (!filterResult.success || !filterResult.result) {
      console.error('❌ File pattern filtering failed');
      return false;
    }
    
    // Check that matches are only from .ts files
    const filteredMatches = filterResult.result.matches;
    const allFromTS = filteredMatches.every((match: any) => 
      match.filePath.endsWith('.ts') || match.filePath.endsWith('.tsx')
    );
    
    if (!allFromTS) {
      console.error('❌ File pattern filtering not working correctly');
      return false;
    }
    
    console.log('✅ File pattern filtering works');
    
    // Test 4: Regex pattern
    console.log('Test 4: Regex pattern');
    const regexParams: GrepToolParams = { 
      pattern: 'function\\s+\\w+' 
    };
    const regexResult = await grepTool.execute(regexParams, context);
    
    if (!regexResult.success) {
      console.error('❌ Regex pattern search failed');
      return false;
    }
    
    console.log('✅ Regex pattern search works');
    
    // Test 5: Search in subdirectory
    console.log('Test 5: Search in subdirectory');
    const subDirParams: GrepToolParams = { 
      pattern: 'React', 
      path: 'src' 
    };
    const subDirResult = await grepTool.execute(subDirParams, context);
    
    if (!subDirResult.success) {
      console.error('❌ Subdirectory search failed');
      return false;
    }
    
    console.log('✅ Subdirectory search works');
    
    return true;
    
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Test GlobTool functionality
 */
async function testGlobTool(): Promise<boolean> {
  console.log('\n=== Testing GlobTool ===');
  
  const { tempDir, context, globTool } = createTestEnvironment();
  
  try {
    createTestFiles(tempDir);
    
    // Test 1: Simple glob pattern
    console.log('Test 1: Simple glob pattern');
    const basicParams: GlobToolParams = { pattern: '*.json' };
    const basicResult = await globTool.execute(basicParams, context);
    
    if (!basicResult.success || !basicResult.result) {
      console.error('❌ Basic glob search failed');
      return false;
    }
    
    const matches = basicResult.result.matches;
    if (!Array.isArray(matches) || matches.length === 0) {
      console.error('❌ Expected JSON file matches, got:', matches?.length);
      return false;
    }
    
    const hasPackageJson = matches.some((match: any) => match.path === 'package.json');
    if (!hasPackageJson) {
      console.error('❌ package.json not found in matches');
      return false;
    }
    
    console.log('✅ Simple glob pattern works');
    
    // Test 2: Recursive pattern
    console.log('Test 2: Recursive pattern');
    const recursiveParams: GlobToolParams = { pattern: '**/*.ts' };
    const recursiveResult = await globTool.execute(recursiveParams, context);
    
    if (!recursiveResult.success || !recursiveResult.result) {
      console.error('❌ Recursive glob search failed');
      return false;
    }
    
    const tsMatches = recursiveResult.result.matches;
    const hasIndexTs = tsMatches.some((match: any) => match.path.endsWith('index.ts'));
    
    if (!hasIndexTs) {
      console.error('❌ TypeScript files not found in recursive search');
      return false;
    }
    
    console.log('✅ Recursive pattern works');
    
    // Test 3: Brace expansion
    console.log('Test 3: Brace expansion');
    const braceParams: GlobToolParams = { pattern: '**/*.{js,ts}' };
    const braceResult = await globTool.execute(braceParams, context);
    
    if (!braceResult.success || !braceResult.result) {
      console.error('❌ Brace expansion failed');
      return false;
    }
    
    const jstsMatches = braceResult.result.matches;
    const hasJS = jstsMatches.some((match: any) => match.path.endsWith('.js'));
    const hasTS = jstsMatches.some((match: any) => match.path.endsWith('.ts'));
    
    if (!hasJS || !hasTS) {
      console.error('❌ Brace expansion not working');
      return false;
    }
    
    console.log('✅ Brace expansion works');
    
    // Test 4: Include directories
    console.log('Test 4: Include directories');
    const dirParams: GlobToolParams = { 
      pattern: 'src*', 
      include_dirs: true 
    };
    const dirResult = await globTool.execute(dirParams, context);
    
    if (!dirResult.success || !dirResult.result) {
      console.error('❌ Directory inclusion failed');
      return false;
    }
    
    const dirMatches = dirResult.result.matches;
    const hasSrcDir = dirMatches.some((match: any) => 
      match.path === 'src' && match.isDirectory
    );
    
    if (!hasSrcDir) {
      console.error('❌ Source directory not found');
      return false;
    }
    
    console.log('✅ Directory inclusion works');
    
    // Test 5: Show hidden files
    console.log('Test 5: Show hidden files');
    const hiddenParams: GlobToolParams = { 
      pattern: '.*', 
      show_hidden: true 
    };
    const hiddenResult = await globTool.execute(hiddenParams, context);
    
    if (!hiddenResult.success || !hiddenResult.result) {
      console.error('❌ Hidden files search failed');
      return false;
    }
    
    console.log('✅ Hidden files search works');
    
    return true;
    
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log('🧪 Running SuperDesign LS/Grep/Glob Tools Tests\n');
  
  let allPassed = true;
  
  try {
    const lsTestResult = await testLSTool();
    const grepTestResult = await testGrepTool();
    const globTestResult = await testGlobTool();
    
    allPassed = lsTestResult && grepTestResult && globTestResult;
    
    console.log('\n📊 Test Summary:');
    console.log(`LSTool: ${lsTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`GrepTool: ${grepTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`GlobTool: ${globTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    
  } catch (error) {
    console.error('💥 Test execution error:', error);
    allPassed = false;
  }
  
  if (allPassed) {
    console.log('\n🎉 All LS/Grep/Glob tools tests PASSED!');
    process.exit(0);
  } else {
    console.log('\n💥 Some LS/Grep/Glob tools tests FAILED!');
    process.exit(1);
  }
}

// Run tests when script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testLSTool, testGrepTool, testGlobTool }; 