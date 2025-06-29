import { BaseTool, DefaultToolRegistry, Tool, ToolSchema, ExecutionContext, ToolResult } from '../tools/base-tool';
import { BaseAgent, AgentConfig, AgentOptions, TaskResult, SDKMessage } from '../core/agent';
import { MessageAdapter, AIMessage } from '../utils/message-adapter';

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
 * Test Tool Implementation
 */
class TestReadTool extends BaseTool {
  readonly name = 'test_read';
  readonly description = 'Test tool for reading files';
  readonly schema: ToolSchema = {
    name: 'test_read',
    description: 'Read a file for testing',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          name: 'filePath',
          type: 'string',
          description: 'Path to the file to read'
        },
        encoding: {
          name: 'encoding',
          type: 'string',
          description: 'File encoding (optional)'
        }
      },
      required: ['filePath']
    }
  };

  async execute(params: any, context: ExecutionContext): Promise<ToolResult> {
    this.log(`Reading file: ${params.filePath}`, context);

    // Validate path security
    if (!this.validatePath(params.filePath, context)) {
      return this.createResult(false, null, 'Path validation failed - outside workspace');
    }

    // Simulate file reading
    const mockContent = `// Mock content for ${params.filePath}\nexport const test = 'hello';`;
    
    return this.createResult(true, mockContent, undefined, {
      duration: 50,
      filesAffected: [params.filePath],
      outputSize: mockContent.length
    });
  }
}

/**
 * Test Agent Implementation
 */
class TestCodingAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
    this.setInitialized(true);
  }

  async executeTaskWithStreaming(request: string, options?: AgentOptions): Promise<TaskResult> {
    const startTime = Date.now();
    const sessionId = options?.sessionId || `session-${Date.now()}`;
    
    // Simulate task execution
    const messages: SDKMessage[] = [
      MessageAdapter.createUserMessage(request, sessionId),
      MessageAdapter.createAssistantMessage(
        `I'll help you with: ${request}`,
        sessionId,
        { duration: 100, cost: 0.001 }
      )
    ];

    // Simulate tool usage if request mentions files
    if (request.toLowerCase().includes('read') || request.toLowerCase().includes('file')) {
      messages.push({
        type: 'assistant',
        subtype: 'tool_use',
        message: {
          content: [{
            type: 'tool_use',
            id: 'tool-call-123',
            name: 'test_read',
            input: { filePath: 'test.ts' }
          }]
        },
        session_id: sessionId
      });

      messages.push({
        type: 'result',
        subtype: 'success',
        content: '// Mock file content\nexport const test = "hello";',
        session_id: sessionId,
        parent_tool_use_id: 'tool-call-123',
        duration_ms: 50
      });
    }

    return {
      success: true,
      messages,
      finalMessage: `Task completed: ${request}`,
      toolsUsed: request.toLowerCase().includes('file') ? ['test_read'] : [],
      duration: Date.now() - startTime,
      totalCost: 0.001
    };
  }

  async executeTask(request: string, projectPath: string, options?: AgentOptions): Promise<TaskResult> {
    return this.executeTaskWithStreaming(request, { ...options, sessionId: `session-${Date.now()}` });
  }

  async query(
    prompt: string,
    options?: Partial<AgentOptions>,
    abortController?: AbortController,
    onMessage?: (message: SDKMessage) => void
  ): Promise<SDKMessage[]> {
    const result = await this.executeTaskWithStreaming(prompt, options as AgentOptions);
    
    // Call onMessage callback for each message if provided
    if (onMessage) {
      for (const message of result.messages) {
        onMessage(message);
      }
    }

    return result.messages;
  }
}

/**
 * Test Tool Registry
 */
function testToolRegistry(): boolean {
  console.log('\n🔧 Testing Tool Registry...');
  
  try {
    const registry = new DefaultToolRegistry();
    const testTool = new TestReadTool();

    // Test tool registration
    registry.registerTool(testTool);
    console.log('✅ Tool registered successfully');

    // Test tool retrieval
    const retrievedTool = registry.getTool('test_read');
    if (!retrievedTool) {
      throw new Error('Tool not found after registration');
    }
    console.log('✅ Tool retrieved successfully');

    // Test tool listing
    const allTools = registry.getAllTools();
    if (allTools.length !== 1 || allTools[0].name !== 'test_read') {
      throw new Error('Tool listing failed');
    }
    console.log('✅ Tool listing working');

    // Test schema generation
    const schemas = registry.getAllSchemas();
    if (schemas.length !== 1 || schemas[0].name !== 'test_read') {
      throw new Error('Schema generation failed');
    }
    console.log('✅ Schema generation working');

    // Test tool existence check
    if (!registry.hasTool('test_read') || registry.hasTool('nonexistent')) {
      throw new Error('Tool existence check failed');
    }
    console.log('✅ Tool existence check working');

    return true;
  } catch (error) {
    console.log(`❌ Tool Registry test failed: ${error}`);
    return false;
  }
}

/**
 * Test Tool Execution and Validation
 */
function testToolExecution(): boolean {
  console.log('\n🛠️ Testing Tool Execution...');
  
  try {
    const testTool = new TestReadTool();
    const context: ExecutionContext = {
      workingDirectory: '/test/workspace',
      sessionId: 'test-session',
      outputChannel: mockOutputChannel as any
    };

    // Test parameter validation - valid params
    const validParams = { filePath: 'src/test.ts', encoding: 'utf8' };
    const validationResult = testTool.validate(validParams);
    if (!validationResult.isValid) {
      throw new Error(`Valid params failed validation: ${validationResult.errors.join(', ')}`);
    }
    console.log('✅ Valid parameter validation working');

    // Test parameter validation - missing required param
    const invalidParams = { encoding: 'utf8' }; // Missing filePath
    const invalidValidation = testTool.validate(invalidParams);
    if (invalidValidation.isValid) {
      throw new Error('Invalid params passed validation');
    }
    console.log('✅ Invalid parameter validation working');

    // Test tool execution
    const executionPromise = testTool.execute(validParams, context);
    if (!(executionPromise instanceof Promise)) {
      throw new Error('Tool execution should return a Promise');
    }
    console.log('✅ Tool execution returns Promise');

    return true;
  } catch (error) {
    console.log(`❌ Tool Execution test failed: ${error}`);
    return false;
  }
}

/**
 * Test Agent System
 */
async function testAgentSystem(): Promise<boolean> {
  console.log('\n🤖 Testing Agent System...');
  
  try {
    const registry = new DefaultToolRegistry();
    registry.registerTool(new TestReadTool());

    const config: AgentConfig = {
      workingDirectory: '/test/workspace',
      outputChannel: mockOutputChannel as any,
      toolRegistry: registry,
      llmConfig: {
        provider: 'test',
        model: 'test-model',
        apiKey: 'test-key',
        maxTokens: 1000,
        temperature: 0.7
      },
      systemPrompts: {
        default: 'You are a helpful assistant',
        design: 'You are a design expert',
        coding: 'You are a coding expert'
      },
      security: {
        allowedPaths: ['/test/workspace'],
        restrictToWorkspace: true
      }
    };

    const agent = new TestCodingAgent(config);

    // Test agent initialization
    if (!agent.isReady()) {
      throw new Error('Agent should be ready after initialization');
    }
    console.log('✅ Agent initialization working');

    // Test session management
    const session = agent.getSession('test-session', '/test/workspace');
    if (!session || session.id !== 'test-session') {
      throw new Error('Session creation failed');
    }
    console.log('✅ Session management working');

    // Test project analysis
    const analysis = await agent.analyzeCodbase('/test/workspace');
    if (!analysis || typeof analysis.projectType !== 'string') {
      throw new Error('Project analysis failed');
    }
    console.log('✅ Project analysis working');

    // Test task execution
    const taskResult = await agent.executeTaskWithStreaming('Read a test file');
    if (!taskResult.success || taskResult.messages.length === 0) {
      throw new Error('Task execution failed');
    }
    console.log('✅ Task execution working');

    // Test query method (ClaudeCodeService compatibility)
    const messages = await agent.query('Simple test query');
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Query method failed');
    }
    console.log('✅ Query method (ClaudeCodeService compatibility) working');

    return true;
  } catch (error) {
    console.log(`❌ Agent System test failed: ${error}`);
    return false;
  }
}

/**
 * Test Message Adapter
 */
function testMessageAdapter(): boolean {
  console.log('\n💬 Testing Message Adapter...');
  
  try {
    const sessionId = 'test-session-123';

    // Test simple message conversion
    const aiMessage: AIMessage = {
      role: 'assistant',
      content: 'Hello, this is a test message'
    };

    const sdkMessages = MessageAdapter.convertToSDKMessage(aiMessage, sessionId);
    if (sdkMessages.length !== 1 || sdkMessages[0].content !== 'Hello, this is a test message') {
      throw new Error('Simple message conversion failed');
    }
    console.log('✅ Simple message conversion working');

    // Test tool call message conversion
    const toolCallMessage: AIMessage = {
      role: 'assistant',
      content: [{
        type: 'tool-call',
        toolCallId: 'call-123',
        toolName: 'test_read',
        args: { filePath: 'test.ts' }
      }]
    };

    const toolCallSDK = MessageAdapter.convertToSDKMessage(toolCallMessage, sessionId);
    if (toolCallSDK.length !== 1 || toolCallSDK[0].subtype !== 'tool_use') {
      throw new Error('Tool call message conversion failed');
    }
    console.log('✅ Tool call message conversion working');

    // Test reverse conversion
    const sdkMessage: SDKMessage = {
      type: 'user',
      content: 'Test user message',
      session_id: sessionId
    };

    const convertedBack = MessageAdapter.convertFromSDKMessage(sdkMessage);
    if (convertedBack.role !== 'user' || convertedBack.content !== 'Test user message') {
      throw new Error('Reverse message conversion failed');
    }
    console.log('✅ Reverse message conversion working');

    // Test error message creation
    const errorMessage = MessageAdapter.createErrorMessage(
      new Error('Test error'),
      sessionId,
      'tool-call-123'
    );
    if (errorMessage.type !== 'result' || errorMessage.subtype !== 'error') {
      throw new Error('Error message creation failed');
    }
    console.log('✅ Error message creation working');

    // Test cost calculation
    const messagesWithCost: SDKMessage[] = [
      { type: 'assistant', content: 'msg1', session_id: sessionId, total_cost_usd: 0.001 },
      { type: 'assistant', content: 'msg2', session_id: sessionId, total_cost_usd: 0.002 }
    ];
    const totalCost = MessageAdapter.calculateTotalCost(messagesWithCost);
    if (totalCost !== 0.003) {
      throw new Error('Cost calculation failed');
    }
    console.log('✅ Cost calculation working');

    // Test duration calculation
    const messagesWithDuration: SDKMessage[] = [
      { type: 'assistant', content: 'msg1', session_id: sessionId, duration_ms: 100 },
      { type: 'assistant', content: 'msg2', session_id: sessionId, duration_ms: 200 }
    ];
    const totalDuration = MessageAdapter.calculateTotalDuration(messagesWithDuration);
    if (totalDuration !== 300) {
      throw new Error('Duration calculation failed');
    }
    console.log('✅ Duration calculation working');

    return true;
  } catch (error) {
    console.log(`❌ Message Adapter test failed: ${error}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runCoreComponentsTests(): Promise<void> {
  console.log('🧪 SuperDesign Core Components Integration Test\n');
  console.log('=' .repeat(60));
  
  const results = {
    toolRegistry: false,
    toolExecution: false,
    agentSystem: false,
    messageAdapter: false,
  };
  
  // Run tests
  try {
    results.toolRegistry = testToolRegistry();
  } catch (error) {
    console.log('❌ Tool Registry test crashed:', error);
  }
  
  try {
    results.toolExecution = testToolExecution();
  } catch (error) {
    console.log('❌ Tool Execution test crashed:', error);
  }
  
  try {
    results.agentSystem = await testAgentSystem();
  } catch (error) {
    console.log('❌ Agent System test crashed:', error);
  }
  
  try {
    results.messageAdapter = testMessageAdapter();
  } catch (error) {
    console.log('❌ Message Adapter test crashed:', error);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📋 Test Results Summary:');
  console.log(`🔧 Tool Registry:    ${results.toolRegistry ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🛠️  Tool Execution:  ${results.toolExecution ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🤖 Agent System:    ${results.agentSystem ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`💬 Message Adapter:  ${results.messageAdapter ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.values(results).length;
  
  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All core component tests passed! Phase 1.3 infrastructure is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️ Some tests failed. Check the implementation and try again.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runCoreComponentsTests().catch((error) => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}

export { runCoreComponentsTests, testToolRegistry, testToolExecution, testAgentSystem, testMessageAdapter }; 