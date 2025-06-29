import * as path from 'path';
import * as fs from 'fs';
import { LLMService, LLMServiceConfig } from '../core/llm-service';

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
 * Load environment variables from .env file
 */
function loadEnvFile(): void {
  const envPath = path.join(__dirname, '../../.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found at:', envPath);
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        // Join back in case the value contains '=' characters
        let value = valueParts.join('=');
        // Remove quotes if present
        value = value.replace(/^["'](.*)["']$/, '$1');
        process.env[key.trim()] = value;
      }
    }
  }
  
  console.log('✅ Environment variables loaded from .env');
}

/**
 * Test OpenAI integration
 */
async function testOpenAI(): Promise<boolean> {
  console.log('\n🧠 Testing OpenAI integration...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not found in environment');
    return false;
  }

  if (!apiKey.startsWith('sk-')) {
    console.log('❌ Invalid OpenAI API key format (should start with sk-)');
    return false;
  }

  try {
    const config: LLMServiceConfig = {
      provider: {
        name: 'openai',
        model: 'gpt-4.1-mini', // Using mini for faster/cheaper testing
        apiKey: apiKey,
      },
      maxTokens: 100,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant for testing purposes.',
    };

    const llmService = new LLMService(config, mockOutputChannel as any);
    
    console.log('📤 Sending test message to OpenAI...');
    const response = await llmService.generateResponse([
      {
        role: 'user',
        content: 'Say "Hello from OpenAI!" and nothing else.',
      },
    ]);

    console.log('📥 OpenAI Response:', response.content);
    
    if (response.usage) {
      console.log('💰 Token Usage:', {
        prompt: response.usage.promptTokens,
        completion: response.usage.completionTokens,
        total: response.usage.promptTokens + response.usage.completionTokens,
      });
    }

    console.log('✅ OpenAI integration working correctly!');
    return true;
    
  } catch (error) {
    console.log('❌ OpenAI test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test Anthropic integration
 */
async function testAnthropic(): Promise<boolean> {
  console.log('\n🤖 Testing Anthropic integration...');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('❌ ANTHROPIC_API_KEY not found in environment');
    return false;
  }

  if (!apiKey.startsWith('sk-ant-')) {
    console.log('❌ Invalid Anthropic API key format (should start with sk-ant-)');
    return false;
  }

  try {
    const config: LLMServiceConfig = {
      provider: {
        name: 'anthropic',
        model: 'claude-3-5-haiku-20241022', // Using Haiku for faster/cheaper testing
        apiKey: apiKey,
      },
      maxTokens: 100,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant for testing purposes.',
    };

    const llmService = new LLMService(config, mockOutputChannel as any);
    
    console.log('📤 Sending test message to Anthropic...');
    const response = await llmService.generateResponse([
      {
        role: 'user',
        content: 'Say "Hello from Claude!" and nothing else.',
      },
    ]);

    console.log('📥 Anthropic Response:', response.content);
    
    if (response.usage) {
      console.log('💰 Token Usage:', {
        prompt: response.usage.promptTokens,
        completion: response.usage.completionTokens,
        total: response.usage.promptTokens + response.usage.completionTokens,
      });
    }

    console.log('✅ Anthropic integration working correctly!');
    return true;
    
  } catch (error) {
    console.log('❌ Anthropic test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test streaming functionality
 */
async function testStreaming(): Promise<boolean> {
  console.log('\n🌊 Testing streaming functionality...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⏭️ Skipping streaming test - no OpenAI API key');
    return true; // Not a failure, just skipped
  }

  try {
    const config: LLMServiceConfig = {
      provider: {
        name: 'openai',
        model: 'gpt-4.1-mini',
        apiKey: apiKey,
      },
      maxTokens: 50,
      temperature: 0.7,
    };

    const llmService = new LLMService(config, mockOutputChannel as any);
    
    console.log('📤 Starting streaming test...');
    const streamingResponse = await llmService.generateStreamingResponse([
      {
        role: 'user',
        content: 'Count from 1 to 5, one number per line.',
      },
    ]);

    let fullContent = '';
    let chunkCount = 0;
    
    for await (const chunk of streamingResponse.stream) {
      fullContent += chunk;
      chunkCount++;
      process.stdout.write(chunk);
    }
    
    console.log(`\n📊 Streaming completed: ${chunkCount} chunks, ${fullContent.length} characters`);
    console.log('✅ Streaming functionality working correctly!');
    return true;
    
  } catch (error) {
    console.log('❌ Streaming test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('🧪 SuperDesign LLM Service Integration Test\n');
  console.log('=' .repeat(50));
  
  // Load environment variables
  loadEnvFile();
  
  const results = {
    openai: false,
    anthropic: false,
    streaming: false,
  };
  
  // Run tests
  try {
    results.openai = await testOpenAI();
  } catch (error) {
    console.log('❌ OpenAI test crashed:', error);
  }
  
  try {
    results.anthropic = await testAnthropic();
  } catch (error) {
    console.log('❌ Anthropic test crashed:', error);
  }
  
  try {
    results.streaming = await testStreaming();
  } catch (error) {
    console.log('❌ Streaming test crashed:', error);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📋 Test Results Summary:');
  console.log(`🧠 OpenAI:     ${results.openai ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🤖 Anthropic:  ${results.anthropic ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🌊 Streaming:  ${results.streaming ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.values(results).length;
  
  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All tests passed! LLM Service is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️ Some tests failed. Check API keys and network connection.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}

export { runTests, testOpenAI, testAnthropic, testStreaming }; 