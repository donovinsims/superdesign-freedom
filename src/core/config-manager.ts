import * as vscode from 'vscode';
import { LLMProvider, LLMServiceConfig } from './llm-service';
import { getAvailableModels, getDefaultModel } from './models';

export type AgentProvider = 'claude-code' | 'custom';

export interface SuperDesignConfig {
  agentProvider: AgentProvider;
  customAgent: {
    defaultProvider: 'openai' | 'anthropic' | 'google' | 'openrouter';
    defaultModel: string;
    maxTokens: number;
    temperature: number;
  };
  apiKeys: {
    anthropic?: string;
    openai?: string;
    openrouter?: string;
    google?: string;
  };
}

/**
 * Configuration Manager for SuperDesign extension
 * Handles VS Code settings, API keys, and model configuration
 */
export class ConfigManager {
  private outputChannel: vscode.OutputChannel;
  private readonly configSection = 'superdesign';

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Get the current configuration from VS Code settings
   */
  getConfig(): SuperDesignConfig {
    const config = vscode.workspace.getConfiguration(this.configSection);
    
    return {
      agentProvider: config.get<AgentProvider>('agentProvider', 'claude-code'),
      customAgent: {
        defaultProvider: config.get<'openai' | 'anthropic' | 'google' | 'openrouter'>('defaultProvider', 'openai'),
        defaultModel: config.get<string>('defaultModel', getDefaultModel('openai')),
        maxTokens: config.get<number>('maxTokens', 4000),
        temperature: config.get<number>('temperature', 0.7),
      },
      apiKeys: {
        anthropic: config.get<string>('anthropicApiKey'),
        openai: config.get<string>('openaiApiKey'),
        openrouter: config.get<string>('openrouterApiKey'),
        google: config.get<string>('googleApiKey'),
      },
    };
  }

  /**
   * Update a configuration value
   */
  async updateConfig<K extends keyof SuperDesignConfig>(
    key: K,
    value: SuperDesignConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configSection);
    await config.update(key, value, target);
    this.outputChannel.appendLine(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
  }

  /**
   * Get the currently active agent provider
   */
  getActiveAgentProvider(): AgentProvider {
    return this.getConfig().agentProvider;
  }

  /**
   * Switch between Claude Code and Custom agent
   */
  async switchAgentProvider(provider: AgentProvider): Promise<void> {
    await this.updateConfig('agentProvider', provider);
    this.outputChannel.appendLine(`Switched to ${provider} agent`);
  }

  /**
   * Get LLM service configuration for the custom agent
   */
  getLLMServiceConfig(): LLMServiceConfig | null {
    const config = this.getConfig();
    
    if (config.agentProvider !== 'custom') {
      return null;
    }

    const providerName = config.customAgent.defaultProvider;
    const apiKey = config.apiKeys[providerName];
    
    if (!apiKey) {
      throw new Error(`API key not configured for ${providerName} provider`);
    }

    const provider: LLMProvider = {
      name: providerName,
      model: config.customAgent.defaultModel,
      apiKey: apiKey,
    };

    return {
      provider,
      maxTokens: config.customAgent.maxTokens,
      temperature: config.customAgent.temperature,
      systemPrompt: this.getSystemPrompt(),
    };
  }

  /**
   * Validate that required API keys are configured
   */
  validateConfiguration(): { isValid: boolean; missingKeys: string[] } {
    const config = this.getConfig();
    const missingKeys: string[] = [];

    if (config.agentProvider === 'claude-code') {
      if (!config.apiKeys.anthropic) {
        missingKeys.push('anthropicApiKey');
      }
    } else if (config.agentProvider === 'custom') {
      const providerName = config.customAgent.defaultProvider;
      const apiKey = config.apiKeys[providerName];
      
      if (!apiKey) {
        missingKeys.push(`${providerName}ApiKey`);
      }
    }

    return {
      isValid: missingKeys.length === 0,
      missingKeys,
    };
  }



  /**
   * Get the system prompt for the custom coding agent
   */
  private getSystemPrompt(): string {
    return `You are a coding agent integrated into VS Code through the SuperDesign extension. You help users build and design applications.

**Your capabilities:**
- Analyze and understand codebases
- Write, modify, and refactor code
- Create files and directory structures
- Execute shell commands
- Read documentation and research latest best practices
- Help with UI/UX design and component creation

**Your personality:**
- Be direct and practical in your responses
- Focus on clean, maintainable code
- Consider performance and best practices
- Ask clarifying questions when requirements are unclear
- Provide specific, actionable solutions

**Code style:**
- Use TypeScript when possible
- Follow modern ES6+ patterns
- Include proper error handling
- Add helpful comments for complex logic
- Consider accessibility and user experience

**When working with files:**
- Always specify exact file paths
- Create necessary directory structures
- Consider the existing project structure
- Maintain consistent code style with the project

You have access to various tools to read files, write code, execute commands, and search for information. Use them effectively to help the user accomplish their goals.`;
  }

  /**
   * Set up default configuration for first-time users
   */
  async initializeDefaultConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configSection);
    
    const hasExistingConfig = 
      config.get('agentProvider') !== undefined ||
      config.get('defaultProvider') !== undefined;

    if (!hasExistingConfig) {
      this.outputChannel.appendLine('Initializing default SuperDesign configuration...');
      
      // Set default values
      await config.update('agentProvider', 'claude-code', vscode.ConfigurationTarget.Global);
      await config.update('defaultProvider', 'openai', vscode.ConfigurationTarget.Global);
      await config.update('defaultModel', getDefaultModel('openai'), vscode.ConfigurationTarget.Global);
      await config.update('maxTokens', 4000, vscode.ConfigurationTarget.Global);
      await config.update('temperature', 0.7, vscode.ConfigurationTarget.Global);
      
      this.outputChannel.appendLine('Default configuration initialized');
    }
  }

  /**
   * Show configuration status in VS Code
   */
  async showConfigStatus(): Promise<void> {
    const config = this.getConfig();
    const validation = this.validateConfiguration();
    
    let status = `**SuperDesign Configuration Status**\n\n`;
    status += `**Active Agent:** ${config.agentProvider}\n`;
    
    if (config.agentProvider === 'custom') {
      status += `**LLM Provider:** ${config.customAgent.defaultProvider}\n`;
      status += `**Model:** ${config.customAgent.defaultModel}\n`;
      status += `**Max Tokens:** ${config.customAgent.maxTokens}\n`;
      status += `**Temperature:** ${config.customAgent.temperature}\n`;
    }
    
    status += `\n**Configuration Status:** ${validation.isValid ? '✅ Valid' : '❌ Invalid'}\n`;
    
    if (!validation.isValid) {
      status += `**Missing API Keys:** ${validation.missingKeys.join(', ')}\n`;
      status += `\n**To fix:** Go to VS Code Settings → Extensions → SuperDesign and configure the missing API keys.`;
    }

    await vscode.window.showInformationMessage(status, { modal: true });
  }
} 