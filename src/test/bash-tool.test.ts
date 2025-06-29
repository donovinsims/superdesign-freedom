import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BashTool, BashToolParams } from '../tools/bash-tool';
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'superdesign-bash-test-'));
  
  const context: ExecutionContext = {
    workingDirectory: tempDir,
    outputChannel: mockOutputChannel,
    sessionId: 'test-session'
  };

  const bashTool = new BashTool();

  return { tempDir, context, bashTool };
}

/**
 * Helper function to create test files and directories
 */
function createTestFiles(baseDir: string) {
  // Create some test files
  fs.writeFileSync(
    path.join(baseDir, 'test.txt'), 
    'Hello World\nLine 2\nLine 3'
  );
  
  fs.writeFileSync(
    path.join(baseDir, 'package.json'),
    '{\n  "name": "test-project",\n  "version": "1.0.0"\n}'
  );

  // Create a subdirectory
  fs.mkdirSync(path.join(baseDir, 'subdir'), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, 'subdir', 'nested.txt'),
    'Nested file content'
  );
}

/**
 * Test BashTool basic functionality
 */
async function testBasicCommands(): Promise<boolean> {
  console.log('\n=== Testing BashTool Basic Commands ===');
  
  const { tempDir, context, bashTool } = createTestEnvironment();
  
  try {
    createTestFiles(tempDir);
    
    // Test 1: Simple echo command
    console.log('Test 1: Simple echo command');
    const echoParams: BashToolParams = { 
      command: 'echo "Hello World"',
      description: 'Testing echo command'
    };
    const echoResult = await bashTool.execute(echoParams, context);
    
    if (!echoResult.success || !echoResult.result) {
      console.error('❌ Echo command failed');
      return false;
    }
    
    if (!echoResult.result.stdout.includes('Hello World')) {
      console.error('❌ Echo output incorrect');
      return false;
    }
    
    console.log('✅ Echo command works');
    
    // Test 2: List files command
    console.log('Test 2: List files command');
    const lsParams: BashToolParams = { 
      command: os.platform() === 'win32' ? 'dir' : 'ls -la',
      description: 'List directory contents'
    };
    const lsResult = await bashTool.execute(lsParams, context);
    
    if (!lsResult.success || !lsResult.result) {
      console.error('❌ List files command failed');
      return false;
    }
    
    console.log('✅ List files command works');
    
    // Test 3: Change directory and execute
    console.log('Test 3: Change directory and execute');
    const cdParams: BashToolParams = { 
      command: os.platform() === 'win32' ? 'dir' : 'pwd',
      directory: 'subdir',
      description: 'Test directory change'
    };
    const cdResult = await bashTool.execute(cdParams, context);
    
    if (!cdResult.success || !cdResult.result) {
      console.error('❌ Directory change command failed');
      return false;
    }
    
    console.log('✅ Directory change command works');
    
    // Test 4: Command with environment variables
    console.log('Test 4: Command with environment variables');
    const envParams: BashToolParams = { 
      command: os.platform() === 'win32' ? 'echo %TEST_VAR%' : 'echo $TEST_VAR',
      env: { TEST_VAR: 'test_value' },
      description: 'Test environment variables'
    };
    const envResult = await bashTool.execute(envParams, context);
    
    if (!envResult.success || !envResult.result) {
      console.error('❌ Environment variable command failed');
      return false;
    }
    
    console.log('✅ Environment variable command works');
    
    return true;
    
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Test BashTool security features
 */
async function testSecurityFeatures(): Promise<boolean> {
  console.log('\n=== Testing BashTool Security Features ===');
  
  const { tempDir, context, bashTool } = createTestEnvironment();
  
  try {
    // Test 1: Unsafe command rejection
    console.log('Test 1: Unsafe command rejection');
    const unsafeParams: BashToolParams = { 
      command: 'rm -rf /',
      description: 'This should be rejected'
    };
    const unsafeResult = await bashTool.execute(unsafeParams, context);
    
    if (unsafeResult.success) {
      console.error('❌ Unsafe command was not rejected');
      return false;
    }
    
    if (!unsafeResult.error?.includes('potentially unsafe operations')) {
      console.error('❌ Wrong error message for unsafe command');
      return false;
    }
    
    console.log('✅ Unsafe command rejection works');
    
    // Test 2: Path traversal prevention
    console.log('Test 2: Path traversal prevention');
    const traversalParams: BashToolParams = { 
      command: 'echo test',
      directory: '../../../etc'
    };
    const traversalResult = await bashTool.execute(traversalParams, context);
    
    if (traversalResult.success) {
      console.error('❌ Path traversal was not prevented');
      return false;
    }
    
    console.log('✅ Path traversal prevention works');
    
    // Test 3: Absolute path rejection
    console.log('Test 3: Absolute path rejection');
    const absoluteParams: BashToolParams = { 
      command: 'echo test',
      directory: '/etc'
    };
    const absoluteResult = await bashTool.execute(absoluteParams, context);
    
    if (absoluteResult.success) {
      console.error('❌ Absolute path was not rejected');
      return false;
    }
    
    console.log('✅ Absolute path rejection works');
    
    // Test 4: Empty command rejection
    console.log('Test 4: Empty command rejection');
    const emptyParams: BashToolParams = { 
      command: '   ',
      description: 'Empty command test'
    };
    const emptyResult = await bashTool.execute(emptyParams, context);
    
    if (emptyResult.success) {
      console.error('❌ Empty command was not rejected');
      return false;
    }
    
    console.log('✅ Empty command rejection works');
    
    return true;
    
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Test BashTool error handling and edge cases
 */
async function testErrorHandling(): Promise<boolean> {
  console.log('\n=== Testing BashTool Error Handling ===');
  
  const { tempDir, context, bashTool } = createTestEnvironment();
  
  try {
    // Test 1: Command that fails
    console.log('Test 1: Command that fails');
    const failParams: BashToolParams = { 
      command: os.platform() === 'win32' ? 'dir nonexistent' : 'ls nonexistent',
      description: 'Command that should fail'
    };
    const failResult = await bashTool.execute(failParams, context);
    
    if (failResult.success) {
      console.error('❌ Failed command was reported as successful');
      return false;
    }
    
    if (failResult.result?.exitCode === 0) {
      console.error('❌ Failed command has exit code 0');
      return false;
    }
    
    console.log('✅ Command failure handling works');
    
    // Test 2: Timeout test (short timeout)
    console.log('Test 2: Timeout test');
    const timeoutParams: BashToolParams = { 
      command: os.platform() === 'win32' ? 'timeout 5' : 'sleep 5',
      timeout: 1000, // 1 second timeout
      description: 'Command that should timeout'
    };
    const timeoutResult = await bashTool.execute(timeoutParams, context);
    
    if (timeoutResult.success) {
      console.error('❌ Timeout command was reported as successful');
      return false;
    }
    
    if (!timeoutResult.result?.timedOut) {
      console.error('❌ Timeout was not detected');
      return false;
    }
    
    console.log('✅ Timeout handling works');
    
    // Test 3: Nonexistent directory
    console.log('Test 3: Nonexistent directory');
    const noDirParams: BashToolParams = { 
      command: 'echo test',
      directory: 'nonexistent'
    };
    const noDirResult = await bashTool.execute(noDirParams, context);
    
    if (noDirResult.success) {
      console.error('❌ Nonexistent directory was not caught');
      return false;
    }
    
    console.log('✅ Nonexistent directory handling works');
    
    // Test 4: Invalid parameter types
    console.log('Test 4: Invalid parameter types');
    const invalidParams: any = { 
      command: 123, // Should be string
      timeout: 'invalid' // Should be number
    };
    const invalidResult = await bashTool.execute(invalidParams, context);
    
    if (invalidResult.success) {
      console.error('❌ Invalid parameters were not caught');
      return false;
    }
    
    console.log('✅ Invalid parameter handling works');
    
    return true;
    
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Test BashTool advanced features
 */
async function testAdvancedFeatures(): Promise<boolean> {
  console.log('\n=== Testing BashTool Advanced Features ===');
  
  const { tempDir, context, bashTool } = createTestEnvironment();
  
  try {
    createTestFiles(tempDir);
    
    // Test 1: Output capture disabled
    console.log('Test 1: Output capture disabled');
    const noCaptureParams: BashToolParams = { 
      command: 'echo "Should not be captured"',
      capture_output: false,
      description: 'Test output capture disabled'
    };
    const noCaptureResult = await bashTool.execute(noCaptureParams, context);
    
    if (!noCaptureResult.success) {
      console.error('❌ No capture command failed');
      return false;
    }
    
    // Output should be empty when capture is disabled
    if (noCaptureResult.result?.stdout && noCaptureResult.result.stdout.length > 0) {
      console.error('❌ Output was captured when disabled');
      return false;
    }
    
    console.log('✅ Output capture disable works');
    
    // Test 2: Custom timeout
    console.log('Test 2: Custom timeout');
    const customTimeoutParams: BashToolParams = { 
      command: 'echo "Quick command"',
      timeout: 5000, // 5 seconds
      description: 'Test custom timeout'
    };
    const customTimeoutResult = await bashTool.execute(customTimeoutParams, context);
    
    if (!customTimeoutResult.success) {
      console.error('❌ Custom timeout command failed');
      return false;
    }
    
    console.log('✅ Custom timeout works');
    
    // Test 3: Multiple environment variables
    console.log('Test 3: Multiple environment variables');
    const multiEnvParams: BashToolParams = { 
      command: os.platform() === 'win32' 
        ? 'echo %VAR1% %VAR2%' 
        : 'echo "$VAR1 $VAR2"',
      env: { 
        VAR1: 'value1',
        VAR2: 'value2'
      },
      description: 'Test multiple environment variables'
    };
    const multiEnvResult = await bashTool.execute(multiEnvParams, context);
    
    if (!multiEnvResult.success || !multiEnvResult.result) {
      console.error('❌ Multiple environment variables command failed');
      return false;
    }
    
    const output = multiEnvResult.result.stdout;
    if (!output.includes('value1') || !output.includes('value2')) {
      console.error('❌ Environment variables not set correctly');
      return false;
    }
    
    console.log('✅ Multiple environment variables work');
    
    // Test 4: Command with stderr output
    console.log('Test 4: Command with stderr output');
    const stderrParams: BashToolParams = { 
      command: os.platform() === 'win32' 
        ? 'echo Error message 1>&2 && echo Success'
        : 'echo "Error message" >&2 && echo "Success"',
      description: 'Test stderr capture'
    };
    const stderrResult = await bashTool.execute(stderrParams, context);
    
    if (!stderrResult.success || !stderrResult.result) {
      console.error('❌ Stderr command failed');
      return false;
    }
    
    if (!stderrResult.result.stderr.includes('Error message')) {
      console.error('❌ Stderr not captured correctly');
      return false;
    }
    
    if (!stderrResult.result.stdout.includes('Success')) {
      console.error('❌ Stdout not captured correctly');
      return false;
    }
    
    console.log('✅ Stderr capture works');
    
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
  console.log('🧪 Running SuperDesign BashTool Tests\n');
  
  let allPassed = true;
  
  try {
    const basicTestResult = await testBasicCommands();
    const securityTestResult = await testSecurityFeatures();
    const errorTestResult = await testErrorHandling();
    const advancedTestResult = await testAdvancedFeatures();
    
    allPassed = basicTestResult && securityTestResult && errorTestResult && advancedTestResult;
    
    console.log('\n📊 Test Summary:');
    console.log(`Basic Commands: ${basicTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Security Features: ${securityTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Error Handling: ${errorTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Advanced Features: ${advancedTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    
  } catch (error) {
    console.error('💥 Test execution error:', error);
    allPassed = false;
  }
  
  if (allPassed) {
    console.log('\n🎉 All BashTool tests PASSED!');
    process.exit(0);
  } else {
    console.log('\n💥 Some BashTool tests FAILED!');
    process.exit(1);
  }
}

// Run tests when script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testBasicCommands, testSecurityFeatures, testErrorHandling, testAdvancedFeatures }; 