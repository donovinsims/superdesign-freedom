import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WriteTool, WriteToolParams } from '../tools/write-tool';
import { EditTool, EditToolParams } from '../tools/edit-tool';
import { MultiEditTool, MultiEditToolParams } from '../tools/multiedit-tool';
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
 * Helper function to create test context and tools
 */
function createTestEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'superdesign-tools-test-'));
  
  const context: ExecutionContext = {
    workingDirectory: tempDir,
    sessionId: 'test-session',
    outputChannel: mockOutputChannel as any,
  };

  const writeTool = new WriteTool();
  const editTool = new EditTool();
  const multiEditTool = new MultiEditTool();

  return { tempDir, context, writeTool, editTool, multiEditTool };
}

/**
 * Helper function to clean up test environment
 */
function cleanupTestEnvironment(tempDir: string) {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Test WriteTool functionality
 */
async function testWriteTool(): Promise<boolean> {
  console.log('\n📝 Testing WriteTool...');
  
  const { tempDir, context, writeTool } = createTestEnvironment();
  
  try {
    // Test 1: Write content to new file
    const params1: WriteToolParams = {
      file_path: 'test.txt',
      content: 'Hello, World!'
    };

    const result1 = await writeTool.execute(params1, context);
    if (!result1.success || !result1.result?.is_new_file) {
      throw new Error('Failed to write new file');
    }

    const filePath1 = path.join(tempDir, 'test.txt');
    if (!fs.existsSync(filePath1) || fs.readFileSync(filePath1, 'utf8') !== 'Hello, World!') {
      throw new Error('File content mismatch');
    }
    console.log('✅ Write new file working');

    // Test 2: Overwrite existing file
    const params2: WriteToolParams = {
      file_path: 'test.txt',
      content: 'Updated content'
    };

    const result2 = await writeTool.execute(params2, context);
    if (!result2.success || result2.result?.is_new_file) {
      throw new Error('Failed to overwrite existing file');
    }
    
    if (fs.readFileSync(filePath1, 'utf8') !== 'Updated content') {
      throw new Error('File overwrite failed');
    }
    console.log('✅ Overwrite existing file working');

    // Test 3: Create nested directories
    const params3: WriteToolParams = {
      file_path: 'nested/dir/test.txt',
      content: 'Nested content'
    };

    const result3 = await writeTool.execute(params3, context);
    if (!result3.success) {
      throw new Error('Failed to create nested directories');
    }

    const nestedPath = path.join(tempDir, 'nested/dir/test.txt');
    if (!fs.existsSync(nestedPath)) {
      throw new Error('Nested file not created');
    }
    console.log('✅ Nested directory creation working');

    // Test 4: Security validation (path traversal)
    const params4: WriteToolParams = {
      file_path: '../outside.txt',
      content: 'Malicious content'
    };

    const result4 = await writeTool.execute(params4, context);
    if (result4.success) {
      throw new Error('Security validation failed - path traversal allowed');
    }
    console.log('✅ Security validation working');

    // Test 5: Parameter validation
    const result5 = await writeTool.execute({} as WriteToolParams, context);
    if (result5.success) {
      throw new Error('Parameter validation failed');
    }
    console.log('✅ Parameter validation working');

    return true;
  } catch (error) {
    console.log(`❌ WriteTool test failed: ${error}`);
    return false;
  } finally {
    cleanupTestEnvironment(tempDir);
  }
}

/**
 * Test EditTool functionality
 */
async function testEditTool(): Promise<boolean> {
  console.log('\n✏️  Testing EditTool...');
  
  const { tempDir, context, editTool } = createTestEnvironment();
  
  try {
    // Setup: Create test file
    const testFilePath = path.join(tempDir, 'edit-test.txt');
    const originalContent = 'function test() {\n  console.log("old");\n}';
    fs.writeFileSync(testFilePath, originalContent);

    // Test 1: Basic text replacement
    const params1: EditToolParams = {
      file_path: 'edit-test.txt',
      old_string: 'console.log("old");',
      new_string: 'console.log("new");'
    };

    const result1 = await editTool.execute(params1, context);
    if (!result1.success || result1.result?.replacements_made !== 1) {
      throw new Error('Basic text replacement failed');
    }

    const updatedContent = fs.readFileSync(testFilePath, 'utf8');
    if (!updatedContent.includes('console.log("new");') || updatedContent.includes('console.log("old");')) {
      throw new Error('Text replacement content verification failed');
    }
    console.log('✅ Basic text replacement working');

    // Test 2: Multiple replacements
    const multiFilePath = path.join(tempDir, 'multi-replace.txt');
    fs.writeFileSync(multiFilePath, 'TODO: Fix this\nTODO: And this\nDONE: Completed');

    const params2: EditToolParams = {
      file_path: 'multi-replace.txt',
      old_string: 'TODO:',
      new_string: 'DONE:',
      expected_replacements: 2
    };

    const result2 = await editTool.execute(params2, context);
    if (!result2.success || result2.result?.replacements_made !== 2) {
      throw new Error('Multiple replacements failed');
    }

    const multiContent = fs.readFileSync(multiFilePath, 'utf8');
    if (multiContent !== 'DONE: Fix this\nDONE: And this\nDONE: Completed') {
      throw new Error('Multiple replacement content verification failed');
    }
    console.log('✅ Multiple replacements working');

    // Test 3: Create new file with empty old_string
    const params3: EditToolParams = {
      file_path: 'new-file.txt',
      old_string: '',
      new_string: 'New file content'
    };

    const result3 = await editTool.execute(params3, context);
    if (!result3.success || !result3.result?.is_new_file) {
      throw new Error('New file creation with edit tool failed');
    }

    const newFilePath = path.join(tempDir, 'new-file.txt');
    if (!fs.existsSync(newFilePath) || fs.readFileSync(newFilePath, 'utf8') !== 'New file content') {
      throw new Error('New file content verification failed');
    }
    console.log('✅ New file creation working');

    // Test 4: Text not found error
    const params4: EditToolParams = {
      file_path: 'edit-test.txt',
      old_string: 'nonexistent text',
      new_string: 'replacement'
    };

    const result4 = await editTool.execute(params4, context);
    if (result4.success) {
      throw new Error('Should fail when text not found');
    }
    console.log('✅ Text not found error handling working');

    // Test 5: Replacement count mismatch
    const countFilePath = path.join(tempDir, 'count-test.txt');
    fs.writeFileSync(countFilePath, 'foo foo foo');

    const params5: EditToolParams = {
      file_path: 'count-test.txt',
      old_string: 'foo',
      new_string: 'bar',
      expected_replacements: 2  // Expects 2 but there are 3
    };

    const result5 = await editTool.execute(params5, context);
    if (result5.success) {
      throw new Error('Should fail when replacement count mismatches');
    }
    console.log('✅ Replacement count validation working');

    return true;
  } catch (error) {
    console.log(`❌ EditTool test failed: ${error}`);
    return false;
  } finally {
    cleanupTestEnvironment(tempDir);
  }
}

/**
 * Test MultiEditTool functionality
 */
async function testMultiEditTool(): Promise<boolean> {
  console.log('\n🔀 Testing MultiEditTool...');
  
  const { tempDir, context, multiEditTool } = createTestEnvironment();
  
  try {
    // Setup: Create test file
    const testFilePath = path.join(tempDir, 'multi-edit.js');
    const originalContent = `function calculate(a, b) {
  let result = a + b;
  console.log("Result: " + result);
  return result;
}`;
    fs.writeFileSync(testFilePath, originalContent);

    // Test 1: Multiple sequential edits
    const params1: MultiEditToolParams = {
      file_path: 'multi-edit.js',
      edits: [
        {
          old_string: 'let result = a + b;',
          new_string: 'let result = a * b;'
        },
        {
          old_string: '"Result: " + result',
          new_string: '`Result: ${result}`'
        },
        {
          old_string: 'function calculate',
          new_string: 'function multiply'
        }
      ]
    };

    const result1 = await multiEditTool.execute(params1, context);
    if (!result1.success || result1.result?.edits_successful !== 3) {
      throw new Error('Multiple sequential edits failed');
    }

    const updatedContent = fs.readFileSync(testFilePath, 'utf8');
    if (!updatedContent.includes('function multiply') || 
        !updatedContent.includes('let result = a * b;') || 
        !updatedContent.includes('`Result: ${result}`')) {
      throw new Error('Sequential edits content verification failed');
    }
    console.log('✅ Multiple sequential edits working');

    // Test 2: Partial success with fail_fast=false
    const partialFilePath = path.join(tempDir, 'partial-edit.txt');
    fs.writeFileSync(partialFilePath, 'Line 1\nLine 2\nLine 3');

    const params2: MultiEditToolParams = {
      file_path: 'partial-edit.txt',
      fail_fast: false,
      edits: [
        {
          old_string: 'Line 1',
          new_string: 'Modified Line 1'
        },
        {
          old_string: 'Nonexistent Line',  // This will fail
          new_string: 'Should not appear'
        },
        {
          old_string: 'Line 3',
          new_string: 'Modified Line 3'
        }
      ]
    };

    const result2 = await multiEditTool.execute(params2, context);
    if (!result2.success || result2.result?.edits_successful !== 2 || result2.result?.edits_failed !== 1) {
      throw new Error('Partial success with fail_fast=false failed');
    }

    const partialContent = fs.readFileSync(partialFilePath, 'utf8');
    if (!partialContent.includes('Modified Line 1') || 
        !partialContent.includes('Modified Line 3') || 
        partialContent.includes('Should not appear')) {
      throw new Error('Partial edit content verification failed');
    }
    console.log('✅ Partial success (fail_fast=false) working');

    // Test 3: Fail fast on first error
    const failFilePath = path.join(tempDir, 'fail-fast.txt');
    fs.writeFileSync(failFilePath, 'Content here');

    const params3: MultiEditToolParams = {
      file_path: 'fail-fast.txt',
      fail_fast: true,
      edits: [
        {
          old_string: 'Nonexistent',  // This will fail
          new_string: 'Should not appear'
        },
        {
          old_string: 'Content',
          new_string: 'Modified Content'
        }
      ]
    };

    const result3 = await multiEditTool.execute(params3, context);
    if (result3.success || result3.result?.edits_attempted !== 1) {
      throw new Error('Fail fast behavior failed');
    }

    const failContent = fs.readFileSync(failFilePath, 'utf8');
    if (failContent !== 'Content here') {
      throw new Error('Fail fast content should be unchanged');
    }
    console.log('✅ Fail fast behavior working');

    // Test 4: Empty edits array validation
    const params4: MultiEditToolParams = {
      file_path: 'test.txt',
      edits: []
    };

    const result4 = await multiEditTool.execute(params4, context);
    if (result4.success) {
      throw new Error('Should fail with empty edits array');
    }
    console.log('✅ Empty edits validation working');

    return true;
  } catch (error) {
    console.log(`❌ MultiEditTool test failed: ${error}`);
    return false;
  } finally {
    cleanupTestEnvironment(tempDir);
  }
}

/**
 * Test tool registry integration
 */
function testToolRegistryIntegration(): boolean {
  console.log('\n🗂️  Testing Tool Registry Integration...');
  
  try {
    const { SuperDesignToolRegistry } = require('../tools/registry');
    const registry = new SuperDesignToolRegistry();

    // Test tool registration
    if (!registry.hasTool('write') || !registry.hasTool('edit') || !registry.hasTool('multiedit')) {
      throw new Error('Tools not properly registered');
    }
    console.log('✅ Tools properly registered');

    // Test file tools categorization
    const fileTools = registry.getFileTools();
    const toolNames = fileTools.map((tool: any) => tool.name);
    
    if (!toolNames.includes('write') || !toolNames.includes('edit') || !toolNames.includes('multiedit')) {
      throw new Error('File tools categorization failed');
    }
    console.log('✅ File tools categorization working');

    // Test tool stats
    const stats = registry.getToolStats();
    if (!stats.implemented.includes('write') || 
        !stats.implemented.includes('edit') || 
        !stats.implemented.includes('multiedit')) {
      throw new Error('Tool stats incorrect');
    }
    
    if (stats.pending.includes('write') || stats.pending.includes('edit')) {
      throw new Error('Implemented tools should not be in pending list');
    }
    console.log('✅ Tool stats working');

    return true;
  } catch (error) {
    console.log(`❌ Tool Registry Integration test failed: ${error}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runWriteEditToolsTests(): Promise<void> {
  console.log('🧪 SuperDesign Write/Edit Tools Test\n');
  console.log('=' .repeat(60));
  
  const results = {
    writeTool: false,
    editTool: false,
    multiEditTool: false,
    registryIntegration: false,
  };
  
  // Run tests
  try {
    results.writeTool = await testWriteTool();
  } catch (error) {
    console.log('❌ WriteTool test crashed:', error);
  }
  
  try {
    results.editTool = await testEditTool();
  } catch (error) {
    console.log('❌ EditTool test crashed:', error);
  }
  
  try {
    results.multiEditTool = await testMultiEditTool();
  } catch (error) {
    console.log('❌ MultiEditTool test crashed:', error);
  }
  
  try {
    results.registryIntegration = testToolRegistryIntegration();
  } catch (error) {
    console.log('❌ Registry Integration test crashed:', error);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📋 Test Results Summary:');
  console.log(`📝 WriteTool:           ${results.writeTool ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`✏️  EditTool:            ${results.editTool ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔀 MultiEditTool:       ${results.multiEditTool ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🗂️  Registry Integration: ${results.registryIntegration ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.values(results).length;
  
  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All write/edit tools tests passed! Tasks 2.2.1, 2.2.2, 2.2.3, 2.2.4 are working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️ Some tests failed. Check the implementation and try again.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runWriteEditToolsTests().catch((error) => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}

export { runWriteEditToolsTests, testWriteTool, testEditTool, testMultiEditTool, testToolRegistryIntegration }; 