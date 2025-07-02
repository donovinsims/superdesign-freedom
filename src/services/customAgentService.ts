import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentService, ExecutionContext } from '../types/agent';
import { createReadTool } from '../tools/read-tool';
import { createWriteTool } from '../tools/write-tool';
import { createBashTool } from '../tools/bash-tool';
import { createEditTool } from '../tools/edit-tool';
import { createGlobTool } from '../tools/glob-tool';
import { createGrepTool } from '../tools/grep-tool';
import { createLsTool } from '../tools/ls-tool';

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
- **write**: Write content to files in the workspace (creates parent directories automatically)
- **edit**: Replace text within files using exact string matching (requires precise text matching including whitespace and indentation)
- **glob**: Find files and directories matching glob patterns (e.g., "*.js", "src/**/*.ts") - efficient for locating files by name or path structure
- **grep**: Search for text patterns within file contents using regular expressions (can filter by file types and paths)
- **ls**: List directory contents with optional filtering, sorting, and detailed information (shows files and subdirectories)
- **bash**: Execute shell/bash commands within the workspace (secure execution with timeouts and output capture)

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
        
        // Tool call streaming state
        let currentToolCall: any = null;
        let toolCallBuffer = '';

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
                read: createReadTool(executionContext),
                write: createWriteTool(executionContext),
                edit: createEditTool(executionContext),
                glob: createGlobTool(executionContext),
                grep: createGrepTool(executionContext),
                ls: createLsTool(executionContext),
                bash: createBashTool(executionContext)
            };

            const result = streamText({
                model: this.getModel(),
                system: this.getSystemPrompt(),
                prompt: prompt,
                tools: tools,
                toolCallStreaming: true,
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

                    case 'tool-call-streaming-start':
                        // Tool call streaming started
                        const streamStart = chunk as any;
                        currentToolCall = {
                            toolCallId: streamStart.toolCallId,
                            toolName: streamStart.toolName,
                            args: {}
                        };
                        toolCallBuffer = '';
                        
                        this.outputChannel.appendLine(`Tool call streaming started: ${streamStart.toolName} (ID: ${streamStart.toolCallId})`);
                        
                        // Send initial tool call message to frontend in Claude Code format
                        const toolCallStartMessage = {
                            type: 'assistant',
                            message: {
                                content: [{
                                    type: 'tool_use',
                                    id: streamStart.toolCallId,
                                    name: streamStart.toolName,
                                    input: {} // Empty initially, will be updated with deltas
                                }]
                            },
                            session_id: sessionId,
                            parent_tool_use_id: null
                        };
                        
                        onMessage?.(toolCallStartMessage);
                        messages.push(toolCallStartMessage);
                        break;

                    case 'tool-call-delta':
                        // Streaming tool call parameters
                        const delta = chunk as any;
                        if (currentToolCall && delta.argsTextDelta) {
                            toolCallBuffer += delta.argsTextDelta;
                            this.outputChannel.appendLine(`Tool call delta: +${delta.argsTextDelta.length} chars (total: ${toolCallBuffer.length})`);
                            
                            // Try to parse current buffer as JSON and send parameter update
                            try {
                                const parsedArgs = JSON.parse(toolCallBuffer);
                                
                                // Send parameter update to frontend via ChatMessageService
                                const parameterUpdateMessage = {
                                    type: 'user',
                                    message: {
                                        content: [{
                                            type: 'tool_parameter_update',
                                            tool_use_id: currentToolCall.toolCallId,
                                            parameters: parsedArgs
                                        }]
                                    },
                                    session_id: sessionId,
                                    parent_tool_use_id: null
                                };
                                
                                onMessage?.(parameterUpdateMessage);
                                
                                this.outputChannel.appendLine(`Sent parameter update: ${JSON.stringify(parsedArgs).substring(0, 100)}...`);
                            } catch (parseError) {
                                // JSON not complete yet, continue buffering
                                // Only log every 100 characters to avoid spam
                                if (toolCallBuffer.length % 100 === 0) {
                                    this.outputChannel.appendLine(`Tool call progress: ${toolCallBuffer.length} characters received (parsing...)`);
                                }
                            }
                        }
                        break;

                    case 'tool-call':
                        // Handle final complete tool call - transform to Claude Code format
                        const toolCall = chunk as any;
                        this.outputChannel.appendLine(`Tool call complete: ${toolCall.toolName} (ID: ${toolCall.toolCallId}) with args: ${JSON.stringify(toolCall.args)}`);
                        
                        // Skip sending duplicate tool call message if we already sent streaming start
                        if (!currentToolCall) {
                            // Only send if we didn't already send a streaming start message
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
                        } else {
                            this.outputChannel.appendLine(`Skipping duplicate tool call message - already sent streaming start for ID: ${toolCall.toolCallId}`);
                        }
                        
                        // Reset tool call streaming state
                        currentToolCall = null;
                        toolCallBuffer = '';
                        break;

                    case 'tool-result':
                        // Handle tool result - transform to Claude Code format
                        const toolResult = chunk as any;
                        this.outputChannel.appendLine(`Tool result for ID: ${toolResult.toolCallId}: ${JSON.stringify(toolResult.result).substring(0, 200)}...`);
                        
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
                        // Log step start with details
                        const stepStart = chunk as any;
                        this.outputChannel.appendLine(`Step ${stepStart.step || 'unknown'} started: ${stepStart.stepType || 'reasoning'}`);
                        break;

                    case 'step-finish':
                        // Log step completion with details
                        const stepFinish = chunk as any;
                        this.outputChannel.appendLine(`Step ${stepFinish.step || 'unknown'} finished: ${stepFinish.stepType || 'reasoning'} (${stepFinish.finishReason || 'completed'})`);
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