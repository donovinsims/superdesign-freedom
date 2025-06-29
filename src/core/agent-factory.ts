import * as vscode from 'vscode';
import { LLMService, ConversationMessage, LLMResponse, StreamingLLMResponse } from './llm-service';
import { ConfigManager, AgentProvider } from './config-manager';

/**
 * Common interface for both Claude Code and Custom coding agents
 */
export interface CodingAgent {
  /**
   * Process a user query and return a response
   */
  query(
    prompt: string,
    options?: {
      onMessage?: (message: any) => void;
      abortController?: AbortController;
    }
  ): Promise<any[]>;

  /**
   * Get the agent type for identification
   */
  getType(): AgentProvider;

  /**
   * Clean up resources
   */
  dispose(): void;
}

/**
 * Custom Coding Agent implementation using our LLM Service
 */
export class CustomCodingAgent implements CodingAgent {
  private llmService: LLMService;
  private configManager: ConfigManager;
  private outputChannel: vscode.OutputChannel;
  private conversationHistory: ConversationMessage[] = [];

  constructor(
    llmService: LLMService,
    configManager: ConfigManager,
    outputChannel: vscode.OutputChannel
  ) {
    this.llmService = llmService;
    this.configManager = configManager;
    this.outputChannel = outputChannel;
    
    this.outputChannel.appendLine('CustomCodingAgent initialized');
  }

  async query(
    prompt: string,
    options?: {
      onMessage?: (message: any) => void;
      abortController?: AbortController;
    }
  ): Promise<any[]> {
    try {
      this.outputChannel.appendLine(`Processing query: ${prompt.substring(0, 100)}...`);
      
      // Add user message to conversation history
      const userMessage: ConversationMessage = {
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      };
      this.conversationHistory.push(userMessage);

      // Check if we should use streaming or regular response
      if (options?.onMessage) {
        return await this.handleStreamingQuery(userMessage, {
          onMessage: options.onMessage,
          abortController: options.abortController,
        });
      } else {
        return await this.handleRegularQuery(userMessage);
      }
      
    } catch (error) {
      this.outputChannel.appendLine(`Error processing query: ${error}`);
      throw error;
    }
  }

  private async handleStreamingQuery(
    userMessage: ConversationMessage,
    options: { onMessage: (message: any) => void; abortController?: AbortController }
  ): Promise<any[]> {
    try {
      const streamingResponse = await this.llmService.generateStreamingResponse(
        this.conversationHistory
      );

      let fullContent = '';
      const messages: any[] = [];

      // Process the stream
      for await (const chunk of streamingResponse.stream) {
        if (options.abortController?.signal.aborted) {
          this.outputChannel.appendLine('Query aborted by user');
          break;
        }

        fullContent += chunk;
        
        // Send chunk to callback in the format expected by SuperDesign
        const message = {
          type: 'text',
          content: chunk,
        };
        
        options.onMessage(message);
        messages.push(message);
      }

      // Add assistant response to conversation history
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      };
      this.conversationHistory.push(assistantMessage);

      this.outputChannel.appendLine(`Streaming response completed: ${fullContent.length} characters`);
      return messages;
      
    } catch (error) {
      this.outputChannel.appendLine(`Error in streaming query: ${error}`);
      throw error;
    }
  }

  private async handleRegularQuery(userMessage: ConversationMessage): Promise<any[]> {
    try {
      const response = await this.llmService.generateResponse(this.conversationHistory);

      // Add assistant response to conversation history
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };
      this.conversationHistory.push(assistantMessage);

      // Return in the format expected by SuperDesign
      const message = {
        type: 'text',
        content: response.content,
      };

      this.outputChannel.appendLine(`Regular response completed: ${response.content.length} characters`);
      return [message];
      
    } catch (error) {
      this.outputChannel.appendLine(`Error in regular query: ${error}`);
      throw error;
    }
  }

  getType(): AgentProvider {
    return 'custom';
  }

  dispose(): void {
    this.outputChannel.appendLine('CustomCodingAgent disposed');
    // Clear conversation history
    this.conversationHistory = [];
  }

  /**
   * Get conversation history for debugging
   */
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.outputChannel.appendLine('Conversation history cleared');
  }
}

/**
 * Claude Code Agent wrapper to maintain compatibility
 */
export class ClaudeCodeAgentWrapper implements CodingAgent {
  private claudeCodeService: any; // This will be the actual ClaudeCodeService
  private outputChannel: vscode.OutputChannel;

  constructor(claudeCodeService: any, outputChannel: vscode.OutputChannel) {
    this.claudeCodeService = claudeCodeService;
    this.outputChannel = outputChannel;
    
    this.outputChannel.appendLine('ClaudeCodeAgentWrapper initialized');
  }

  async query(
    prompt: string,
    options?: {
      onMessage?: (message: any) => void;
      abortController?: AbortController;
    }
  ): Promise<any[]> {
    try {
      this.outputChannel.appendLine(`Delegating query to Claude Code: ${prompt.substring(0, 100)}...`);
      
      // Delegate to the existing Claude Code service
      return await this.claudeCodeService.query(prompt, undefined, options?.abortController, options?.onMessage);
      
    } catch (error) {
      this.outputChannel.appendLine(`Error in Claude Code query: ${error}`);
      throw error;
    }
  }

  getType(): AgentProvider {
    return 'claude-code';
  }

  dispose(): void {
    this.outputChannel.appendLine('ClaudeCodeAgentWrapper disposed');
    // The actual Claude Code service disposal is handled by the service itself
  }
}

/**
 * Factory for creating coding agents based on configuration
 */
export class AgentFactory {
  private configManager: ConfigManager;
  private outputChannel: vscode.OutputChannel;
  private currentAgent: CodingAgent | null = null;

  constructor(configManager: ConfigManager, outputChannel: vscode.OutputChannel) {
    this.configManager = configManager;
    this.outputChannel = outputChannel;
  }

  /**
   * Create the appropriate coding agent based on current configuration
   */
  async createAgent(claudeCodeService?: any): Promise<CodingAgent> {
    const agentProvider = this.configManager.getActiveAgentProvider();
    
    this.outputChannel.appendLine(`Creating ${agentProvider} agent`);

    // Dispose current agent if exists
    if (this.currentAgent) {
      this.currentAgent.dispose();
    }

    switch (agentProvider) {
      case 'claude-code':
        if (!claudeCodeService) {
          throw new Error('Claude Code service is required but not provided');
        }
        this.currentAgent = new ClaudeCodeAgentWrapper(claudeCodeService, this.outputChannel);
        break;

      case 'custom':
        const llmConfig = this.configManager.getLLMServiceConfig();
        if (!llmConfig) {
          throw new Error('LLM service configuration is not available');
        }
        
        const llmService = new LLMService(llmConfig, this.outputChannel);
        this.currentAgent = new CustomCodingAgent(llmService, this.configManager, this.outputChannel);
        break;

      default:
        throw new Error(`Unsupported agent provider: ${agentProvider}`);
    }

    this.outputChannel.appendLine(`${agentProvider} agent created successfully`);
    return this.currentAgent;
  }

  /**
   * Get the current agent
   */
  getCurrentAgent(): CodingAgent | null {
    return this.currentAgent;
  }

  /**
   * Switch to a different agent provider
   */
  async switchAgent(provider: AgentProvider, claudeCodeService?: any): Promise<CodingAgent> {
    this.outputChannel.appendLine(`Switching from ${this.currentAgent?.getType() || 'none'} to ${provider}`);
    
    await this.configManager.switchAgentProvider(provider);
    return await this.createAgent(claudeCodeService);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    if (this.currentAgent) {
      this.currentAgent.dispose();
      this.currentAgent = null;
    }
    this.outputChannel.appendLine('AgentFactory disposed');
  }
} 