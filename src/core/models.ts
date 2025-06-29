/**
 * Shared model registry for all AI providers
 * Single source of truth for available models
 */

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

export interface ProviderModels {
  models: string[];
  defaultModel: string;
  description: string;
}

/**
 * Available models for each provider
 */
export const AVAILABLE_MODELS: Record<string, ProviderModels> = {
  openai: {
    models: [
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ],
    defaultModel: 'gpt-4.1',
    description: 'OpenAI GPT models with excellent reasoning and code generation',
  },
  anthropic: {
    models: [
      'claude-4-sonnet-20250514',
      'claude-4-opus-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
    defaultModel: 'claude-4-opus-20250514',
    description: 'Anthropic Claude models known for safety and thoughtful responses',
  },
  google: {
    models: [
      'gemini-2.5-pro-preview-05-06',
      'gemini-2.5-flash-preview-04-17',
      'gemini-2.5-pro-exp-03-25',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.0-pro',
    ],
    defaultModel: 'gemini-2.0-flash',
    description: 'Google Gemini models with strong multimodal capabilities',
  },
  openrouter: {
    models: [
      // Popular models available through OpenRouter
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.1-405b-instruct',
      'microsoft/wizardlm-2-8x22b',
      'qwen/qwen-2.5-72b-instruct',
      'deepseek/deepseek-coder',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    description: 'OpenRouter provides access to 100+ models from multiple providers',
  },
};

/**
 * Get available models for all providers
 */
export function getAvailableModels(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  
  for (const [provider, config] of Object.entries(AVAILABLE_MODELS)) {
    result[provider] = config.models;
  }
  
  return result;
}

/**
 * Get models for a specific provider
 */
export function getProviderModels(provider: string): string[] {
  const providerConfig = AVAILABLE_MODELS[provider];
  return providerConfig ? providerConfig.models : [];
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: string): string {
  const providerConfig = AVAILABLE_MODELS[provider];
  return providerConfig ? providerConfig.defaultModel : '';
}

/**
 * Get provider description
 */
export function getProviderDescription(provider: string): string {
  const providerConfig = AVAILABLE_MODELS[provider];
  return providerConfig ? providerConfig.description : '';
}

/**
 * Check if a model exists for a provider
 */
export function isValidModel(provider: string, model: string): boolean {
  const models = getProviderModels(provider);
  return models.includes(model);
}

/**
 * Get all provider names
 */
export function getProviderNames(): string[] {
  return Object.keys(AVAILABLE_MODELS);
} 