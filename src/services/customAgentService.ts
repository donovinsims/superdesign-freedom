import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentService, ExecutionContext } from '../types/agent';
import { createReadTool } from '../tools/read-tool';

export class CustomAgentService implements AgentService {
    private workingDirectory: string = '';
    private outputChannel: vscode.OutputChannel;
    private isInitialized = false;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.outputChannel.appendLine('CustomAgentService constructor called');
        this.setupWorkingDirectory();
    }

    private async setupWorkingDirectory(): Promise<void> {
        try {
            // Try to get workspace root first
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            this.outputChannel.appendLine(`Workspace root detected: ${workspaceRoot}`);
            
            if (workspaceRoot) {
                // Create .superdesign folder in workspace root
                const superdesignDir = path.join(workspaceRoot, '.superdesign');
                this.outputChannel.appendLine(`Setting up .superdesign directory at: ${superdesignDir}`);
                
                // Create directory if it doesn't exist
                if (!fs.existsSync(superdesignDir)) {
                    fs.mkdirSync(superdesignDir, { recursive: true });
                    this.outputChannel.appendLine(`Created .superdesign directory: ${superdesignDir}`);
                } else {
                    this.outputChannel.appendLine(`.superdesign directory already exists: ${superdesignDir}`);
                }
                
                this.workingDirectory = superdesignDir;
                this.outputChannel.appendLine(`Working directory set to: ${this.workingDirectory}`);
            } else {
                this.outputChannel.appendLine('No workspace root found, using fallback');
                // Fallback to OS temp directory if no workspace
                const tempDir = path.join(os.tmpdir(), 'superdesign-custom');
                
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    this.outputChannel.appendLine(`Created temporary superdesign directory: ${tempDir}`);
                }
                
                this.workingDirectory = tempDir;
                this.outputChannel.appendLine(`Working directory set to (fallback): ${this.workingDirectory}`);
                
                vscode.window.showWarningMessage(
                    'No workspace folder found. Using temporary directory for Custom Agent operations.'
                );
            }
            
            this.isInitialized = true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to setup working directory: ${error}`);
            // Final fallback to current working directory
            this.workingDirectory = process.cwd();
            this.outputChannel.appendLine(`Working directory set to (final fallback): ${this.workingDirectory}`);
            this.isInitialized = true;
        }
    }

    private getModel() {
        const config = vscode.workspace.getConfiguration('superdesign');
        const provider = config.get<string>('aiModelProvider', 'openai');
        
        this.outputChannel.appendLine(`Using AI provider: ${provider}`);
        
        switch (provider) {
            case 'anthropic':
                const anthropicKey = config.get<string>('anthropicApiKey');
                if (!anthropicKey) {
                    throw new Error('Anthropic API key not configured. Please run "Configure Anthropic API Key" command.');
                }
                
                this.outputChannel.appendLine(`Anthropic API key found: ${anthropicKey.substring(0, 12)}...`);
                
                const anthropic = createAnthropic({
                    apiKey: anthropicKey
                });
                
                return anthropic('claude-3-5-sonnet-20241022');
                
            case 'openai':
            default:
                const openaiKey = config.get<string>('openaiApiKey');
                if (!openaiKey) {
                    throw new Error('OpenAI API key not configured. Please run "Configure OpenAI API Key" command.');
                }
                
                this.outputChannel.appendLine(`OpenAI API key found: ${openaiKey.substring(0, 7)}...`);
                
                const openai = createOpenAI({
                    apiKey: openaiKey
                });
                
                return openai('gpt-4o');
        }
    }

    private getSystemPrompt(): string {
        const config = vscode.workspace.getConfiguration('superdesign');
        const provider = config.get<string>('aiModelProvider', 'openai');
        
        return `# Role
You are a helpful AI assistant integrated into VS Code as part of the Super Design extension.

# Current Context
- Extension: Super Design (Design Agent for VS Code)
- AI Provider: ${provider}
- Working directory: ${this.workingDirectory}
- You can help with general questions, conversations, and coding assistance

# Available Tools
- **read**: Read file contents within the workspace (supports text files, images, with line range options)

# Instructions
- Be helpful, friendly, and concise
- Provide relevant and practical advice
- Use the available tools when needed to help with file operations and code analysis
- Focus on being a useful coding assistant`;
    }

    async query(
        prompt: string, 
        options?: any, 
        abortController?: AbortController,
        onMessage?: (message: any) => void
    ): Promise<any[]> {
        this.outputChannel.appendLine('=== CUSTOM AGENT QUERY CALLED ===');
        this.outputChannel.appendLine(`Query prompt: ${prompt.substring(0, 200)}...`);
        this.outputChannel.appendLine(`Query options: ${JSON.stringify(options, null, 2)}`);
        this.outputChannel.appendLine(`Streaming enabled: ${!!onMessage}`);

        if (!this.isInitialized) {
            await this.setupWorkingDirectory();
        }

        const messages: any[] = [];
        const sessionId = `session_${Date.now()}`;
        let messageBuffer = '';

        try {
            this.outputChannel.appendLine('Starting AI SDK streamText...');

            // Create execution context for tools
            const executionContext: ExecutionContext = {
                workingDirectory: this.workingDirectory,
                sessionId: sessionId,
                outputChannel: this.outputChannel,
                abortController: abortController
            };

            // Create tools with context
            const tools = {
                read: createReadTool(executionContext)
            };

            const result = streamText({
                model: this.getModel(),
                system: this.getSystemPrompt(),
                prompt: prompt,
                tools: tools,
                maxSteps: 5 // Enable multi-step reasoning with tools
            });

            this.outputChannel.appendLine('AI SDK streamText created, starting to process chunks...');

            for await (const chunk of result.fullStream) {
                // Check for abort signal
                if (abortController?.signal.aborted) {
                    this.outputChannel.appendLine('Operation aborted by user');
                    throw new Error('Operation cancelled');
                }

                this.outputChannel.appendLine(`Received chunk type: ${chunk.type}`);

                switch (chunk.type) {
                    case 'text-delta':
                        // Handle streaming text (assistant message chunks)
                        messageBuffer += chunk.textDelta;
                        
                        const textMessage = {
                            type: 'assistant',
                            message: chunk.textDelta,
                            session_id: sessionId,
                            parent_tool_use_id: null
                        };
                        
                        this.outputChannel.appendLine(`Sending text chunk: "${chunk.textDelta}"`);
                        onMessage?.(textMessage);
                        messages.push(textMessage);
                        break;

                    case 'finish':
                        // Final result message
                        this.outputChannel.appendLine(`Stream finished with reason: ${chunk.finishReason}`);
                        
                        const resultMessage = {
                            type: 'result',
                            subtype: 'success',
                            result: chunk.finishReason === 'stop' ? 'Response completed successfully' : 'Response completed',
                            session_id: sessionId,
                            duration_ms: Date.now() - parseInt(sessionId.split('_')[1]),
                            total_cost_usd: chunk.usage?.totalTokens ? chunk.usage.totalTokens * 0.00001 : 0,
                            usage: chunk.usage || {}
                        };
                        
                        onMessage?.(resultMessage);
                        messages.push(resultMessage);
                        break;

                    case 'error':
                        // Error handling
                        const errorMsg = (chunk as any).error?.message || 'Unknown error occurred';
                        this.outputChannel.appendLine(`Stream error: ${errorMsg}`);
                        
                        const errorMessage = {
                            type: 'result',
                            subtype: 'error',
                            result: errorMsg,
                            session_id: sessionId,
                            is_error: true
                        };
                        
                        onMessage?.(errorMessage);
                        messages.push(errorMessage);
                        break;

                    case 'tool-call':
                        // Handle tool call - transform to Claude Code format
                        const toolCall = chunk as any;
                        this.outputChannel.appendLine(`Tool call: ${toolCall.toolName} with args: ${JSON.stringify(toolCall.args)}`);
                        
                        const toolCallMessage = {
                            type: 'assistant',
                            message: {
                                content: [{
                                    type: 'tool_use',
                                    id: toolCall.toolCallId,
                                    name: toolCall.toolName,
                                    input: toolCall.args
                                }]
                            },
                            session_id: sessionId,
                            parent_tool_use_id: null
                        };
                        
                        onMessage?.(toolCallMessage);
                        messages.push(toolCallMessage);
                        break;

                    case 'tool-result':
                        // Handle tool result - transform to Claude Code format
                        const toolResult = chunk as any;
                        this.outputChannel.appendLine(`Tool result for ${toolResult.toolCallId}: ${JSON.stringify(toolResult.result).substring(0, 200)}...`);
                        
                        const toolResultMessage = {
                            type: 'user',
                            message: {
                                content: [{
                                    type: 'tool_result',
                                    tool_use_id: toolResult.toolCallId,
                                    content: JSON.stringify(toolResult.result, null, 2),
                                    is_error: false
                                }]
                            },
                            session_id: sessionId,
                            parent_tool_use_id: null
                        };
                        
                        onMessage?.(toolResultMessage);
                        messages.push(toolResultMessage);
                        break;

                    case 'step-start':
                    case 'step-finish':
                        // Log step boundaries but don't send to frontend
                        this.outputChannel.appendLine(`Step ${chunk.type}: step ${(chunk as any).stepType || 'unknown'}`);
                        break;

                    default:
                        this.outputChannel.appendLine(`Unknown chunk type: ${chunk.type}`);
                        break;
                }
            }

            this.outputChannel.appendLine(`Query completed successfully. Total messages: ${messages.length}`);
            this.outputChannel.appendLine(`Complete response: "${messageBuffer}"`);
            
            return messages;

        } catch (error) {
            this.outputChannel.appendLine(`Custom Agent query failed: ${error}`);
            this.outputChannel.appendLine(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
            
            // Send error message if streaming callback is available
            if (onMessage) {
                const errorMessage = {
                    type: 'result',
                    subtype: 'error',
                    result: error instanceof Error ? error.message : String(error),
                    session_id: sessionId,
                    is_error: true
                };
                onMessage(errorMessage);
            }
            
            throw error;
        }
    }

    get isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        if (!this.isInitialized) {
            await this.setupWorkingDirectory();
        }
        return this.isInitialized;
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }
} 