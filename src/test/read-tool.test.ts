import * as fs from 'fs';
import * as path from 'path';
import { ReadTool, ReadToolParams } from '../tools/read-tool';
import { SuperDesignToolRegistry } from '../tools/registry';
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

// Test workspace setup
const testWorkspace = '/tmp/superdesign-test';
const testFilesDir = path.join(testWorkspace, 'test-files');

/**
 * Setup test environment
 */
function setupTestEnvironment(): void {
  // Create test workspace
  if (!fs.existsSync(testWorkspace)) {
    fs.mkdirSync(testWorkspace, { recursive: true });
  }
  
  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }

  // Create test files
  const testTextFile = path.join(testFilesDir, 'test.txt');
  const longTextFile = path.join(testFilesDir, 'long.txt');
  const jsFile = path.join(testFilesDir, 'script.js');
  const htmlFile = path.join(testFilesDir, 'design.html');
  
  // Small text file
  fs.writeFileSync(testTextFile, 'Hello SuperDesign!\nThis is a test file.\nLine 3 content.');
  
  // Long text file for pagination testing
  const longContent = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: This is content for testing pagination and line range reading.`).join('\n');
  fs.writeFileSync(longTextFile, longContent);
  
  // JavaScript file
  fs.writeFileSync(jsFile, `// JavaScript test file
function hello() {
  console.log("Hello from SuperDesign!");
}

export { hello };`);

  // HTML file for design testing
  fs.writeFileSync(htmlFile, `<!DOCTYPE html>
<html>
<head>
  <title>SuperDesign Test</title>
</head>
<body>
  <h1>Hello SuperDesign!</h1>
  <p>This is a test HTML file for design iteration.</p>
</body>
</html>`);

  console.log('✅ Test environment setup complete');
}

/**
 * Cleanup test environment
 */
function cleanupTestEnvironment(): void {
  try {
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    console.log('✅ Test environment cleanup complete');
  } catch (error) {
    console.log('⚠️ Warning: Could not fully cleanup test environment:', error);
  }
}

/**
 * Test ReadTool basic functionality
 */
async function testReadToolBasic(): Promise<boolean> {
  console.log('\n📖 Testing ReadTool Basic Functionality...');
  
  try {
    const readTool = new ReadTool();
    const context: ExecutionContext = {
      workingDirectory: testWorkspace,
      sessionId: 'test-session',
      outputChannel: mockOutputChannel as any
    };

    // Test reading simple text file
    const textParams: ReadToolParams = {
      filePath: 'test-files/test.txt'
    };

    const textResult = await readTool.execute(textParams, context);
    if (!textResult.success) {
      throw new Error(`Text file read failed: ${textResult.error}`);
    }

    const fileResult = textResult.result as any;
    if (!fileResult.content.includes('Hello SuperDesign!')) {
      throw new Error('Text file content not read correctly');
    }

    console.log('✅ Basic text file reading working');

    // Test reading JavaScript file
    const jsParams: ReadToolParams = {
      filePath: 'test-files/script.js'
    };

    const jsResult = await readTool.execute(jsParams, context);
    if (!jsResult.success) {
      throw new Error(`JavaScript file read failed: ${jsResult.error}`);
    }

    const jsFileResult = jsResult.result as any;
    if (!jsFileResult.content.includes('function hello()')) {
      throw new Error('JavaScript file content not read correctly');
    }

    console.log('✅ JavaScript file reading working');

    // Test reading HTML file  
    const htmlParams: ReadToolParams = {
      filePath: 'test-files/design.html'
    };

    const htmlResult = await readTool.execute(htmlParams, context);
    if (!htmlResult.success) {
      throw new Error(`HTML file read failed: ${htmlResult.error}`);
    }

    const htmlFileResult = htmlResult.result as any;
    if (!htmlFileResult.content.includes('SuperDesign Test')) {
      throw new Error('HTML file content not read correctly');
    }

    console.log('✅ HTML file reading working');

    return true;
  } catch (error) {
    console.log(`❌ ReadTool basic test failed: ${error}`);
    return false;
  }
}

/**
 * Test ReadTool line range functionality
 */
async function testReadToolLineRange(): Promise<boolean> {
  console.log('\n📄 Testing ReadTool Line Range Functionality...');
  
  try {
    const readTool = new ReadTool();
    const context: ExecutionContext = {
      workingDirectory: testWorkspace,
      sessionId: 'test-session',
      outputChannel: mockOutputChannel as any
    };

    // Test reading specific line range
    const rangeParams: ReadToolParams = {
      filePath: 'test-files/long.txt',
      startLine: 10,
      lineCount: 5
    };

    const rangeResult = await readTool.execute(rangeParams, context);
    if (!rangeResult.success) {
      throw new Error(`Line range read failed: ${rangeResult.error}`);
    }

    const fileResult = rangeResult.result as any;
    if (!fileResult.content.includes('Line 10:')) {
      throw new Error('Line range starting point incorrect');
    }

    if (fileResult.content.includes('Line 16:')) {
      throw new Error('Line range ending point incorrect (should stop at line 14)');
    }

    console.log('✅ Line range reading working');

    // Test reading from specific start line without limit
    const startParams: ReadToolParams = {
      filePath: 'test-files/long.txt',
      startLine: 45
    };

    const startResult = await readTool.execute(startParams, context);
    if (!startResult.success) {
      throw new Error(`Start line read failed: ${startResult.error}`);
    }

    const startFileResult = startResult.result as any;
    if (!startFileResult.content.includes('Line 45:')) {
      throw new Error('Start line reading incorrect');
    }

    console.log('✅ Start line reading working');

    return true;
  } catch (error) {
    console.log(`❌ ReadTool line range test failed: ${error}`);
    return false;
  }
}

/**
 * Test ReadTool error handling
 */
async function testReadToolErrorHandling(): Promise<boolean> {
  console.log('\n⚠️ Testing ReadTool Error Handling...');
  
  try {
    const readTool = new ReadTool();
    const context: ExecutionContext = {
      workingDirectory: testWorkspace,
      sessionId: 'test-session',
      outputChannel: mockOutputChannel as any
    };

    // Test non-existent file
    const nonExistentParams: ReadToolParams = {
      filePath: 'non-existent.txt'
    };

    const nonExistentResult = await readTool.execute(nonExistentParams, context);
    if (nonExistentResult.success) {
      throw new Error('Should have failed for non-existent file');
    }

    if (!nonExistentResult.error?.includes('File not found')) {
      throw new Error('Should have proper error message for non-existent file');
    }

    console.log('✅ Non-existent file error handling working');

    // Test invalid parameters
    const invalidParams: ReadToolParams = {
      filePath: 'test-files/test.txt',
      startLine: -1  // Invalid start line
    };

    const validation = readTool.validate(invalidParams);
    if (validation.isValid) {
      throw new Error('Should have failed validation for negative start line');
    }

    console.log('✅ Parameter validation working');

    // Test path traversal protection (try to read outside workspace)
    const traversalParams: ReadToolParams = {
      filePath: '../../../etc/passwd'  // Path traversal attempt
    };

    const traversalResult = await readTool.execute(traversalParams, context);
    if (traversalResult.success) {
      throw new Error('Should have failed for path traversal attempt');
    }

    console.log('✅ Path traversal protection working');

    return true;
  } catch (error) {
    console.log(`❌ ReadTool error handling test failed: ${error}`);
    return false;
  }
}

/**
 * Test SuperDesign Tool Registry
 */
function testSuperDesignRegistry(): boolean {
  console.log('\n🛠️ Testing SuperDesign Tool Registry...');
  
  try {
    const registry = new SuperDesignToolRegistry();

    // Test tool registration
    const readTool = registry.getTool('read');
    if (!readTool) {
      throw new Error('ReadTool not found in registry');
    }

    console.log('✅ ReadTool registered successfully');

    // Test tool schema
    const schemas = registry.getAllSchemas();
    const readSchema = schemas.find(schema => schema.name === 'read');
    if (!readSchema) {
      throw new Error('ReadTool schema not found');
    }

    if (!readSchema.parameters.properties.filePath) {
      throw new Error('ReadTool schema missing filePath parameter');
    }

    console.log('✅ Tool schema generation working');

    // Test category filtering
    const fileTools = registry.getFileTools();
    if (fileTools.length === 0 || !fileTools.some(tool => tool.name === 'read')) {
      throw new Error('File tools category filtering not working');
    }

    console.log('✅ Tool category filtering working');

    // Test tool statistics
    const stats = registry.getToolStats();
    if (stats.total === 0 || !stats.implemented.includes('read')) {
      throw new Error('Tool statistics not working correctly');
    }

    console.log('✅ Tool statistics working');
    console.log(`📊 Registry stats: ${stats.total} total, ${stats.implemented.length} implemented, ${stats.pending.length} pending`);

    // Test validation
    const validation = registry.validateSupport();
    if (validation.missingTools.length === 0) {
      console.log('✅ All required tools implemented');
    } else {
      console.log(`⚠️ Missing tools: ${validation.missingTools.join(', ')}`);
    }

    return true;
  } catch (error) {
    console.log(`❌ SuperDesign Registry test failed: ${error}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runReadToolTests(): Promise<void> {
  console.log('🧪 SuperDesign ReadTool & Registry Integration Test\n');
  console.log('=' .repeat(60));
  
  // Setup test environment
  setupTestEnvironment();
  
  const results = {
    readToolBasic: false,
    readToolLineRange: false,
    readToolErrorHandling: false,
    superDesignRegistry: false,
  };
  
  // Run tests
  try {
    results.readToolBasic = await testReadToolBasic();
  } catch (error) {
    console.log('❌ ReadTool basic test crashed:', error);
  }
  
  try {
    results.readToolLineRange = await testReadToolLineRange();
  } catch (error) {
    console.log('❌ ReadTool line range test crashed:', error);
  }
  
  try {
    results.readToolErrorHandling = await testReadToolErrorHandling();
  } catch (error) {
    console.log('❌ ReadTool error handling test crashed:', error);
  }
  
  try {
    results.superDesignRegistry = testSuperDesignRegistry();
  } catch (error) {
    console.log('❌ SuperDesign Registry test crashed:', error);
  }
  
  // Cleanup
  cleanupTestEnvironment();
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📋 Test Results Summary:');
  console.log(`📖 ReadTool Basic:       ${results.readToolBasic ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📄 ReadTool Line Range:  ${results.readToolLineRange ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`⚠️  ReadTool Errors:     ${results.readToolErrorHandling ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🛠️  Registry:            ${results.superDesignRegistry ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.values(results).length;
  
  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All ReadTool tests passed! Ready for next tool implementation.');
    process.exit(0);
  } else {
    console.log('⚠️ Some tests failed. Check the implementation and try again.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runReadToolTests().catch((error) => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}

export { runReadToolTests }; 