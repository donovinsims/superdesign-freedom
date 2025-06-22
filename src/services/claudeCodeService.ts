import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Types for Claude Code responses
interface SDKMessage {
    type: 'assistant' | 'user' | 'result' | 'system';
    subtype?: string;
    message?: any;
    session_id?: string;
    duration_ms?: number;
    duration_api_ms?: number;
    is_error?: boolean;
    num_turns?: number;
    result?: string;
    total_cost_usd?: number;
    apiKeySource?: string;
    cwd?: string;
    tools?: string[];
    mcp_servers?: Array<{ name: string; status: string }>;
    model?: string;
    permissionMode?: string;
}

interface ClaudeCodeOptions {
    maxTurns?: number;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    outputFormat?: 'text' | 'json' | 'stream-json';
}

interface QueryParams {
    prompt: string;
    abortController?: AbortController;
    options?: ClaudeCodeOptions;
    cwd?: string;
}

export class ClaudeCodeService {
    private claudeCode: any = null;
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;
    private workingDirectory: string = '';
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.outputChannel.appendLine('ClaudeCodeService constructor called');
        // Initialize on construction
        this.initializationPromise = this.initialize();
    }

    private async initialize(): Promise<void> {
        this.outputChannel.appendLine(`ClaudeCodeService initialize() called, isInitialized: ${this.isInitialized}`);
        
        if (this.isInitialized) {
            this.outputChannel.appendLine('Already initialized, returning early');
            return;
        }

        try {
            this.outputChannel.appendLine('Starting initialization process...');
            
            // Setup working directory first
            this.outputChannel.appendLine('About to call setupWorkingDirectory()');
            await this.setupWorkingDirectory();
            this.outputChannel.appendLine('setupWorkingDirectory() completed');

            // Check if API key is configured
            this.outputChannel.appendLine('Checking API key configuration...');
            const config = vscode.workspace.getConfiguration('superdesign');
            const apiKey = config.get<string>('anthropicApiKey');
            this.outputChannel.appendLine(`API key configured: ${!!apiKey}`);
            
            if (!apiKey) {
                this.outputChannel.appendLine('No API key found, showing error message');
                const action = await vscode.window.showErrorMessage(
                    'Anthropic API key is required for Claude Code integration.',
                    'Open Settings'
                );
                if (action === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'superdesign.anthropicApiKey');
                }
                throw new Error('Missing API key');
            }

            // Set the environment variable for Claude Code SDK
            this.outputChannel.appendLine('Setting environment variable for Claude Code SDK');
            process.env.ANTHROPIC_API_KEY = apiKey;

            // Simple dynamic import - esbuild will handle this as external
            this.outputChannel.appendLine('Importing Claude Code SDK...');
            this.claudeCode = await import('@anthropic-ai/claude-code');
            this.outputChannel.appendLine('Claude Code SDK imported successfully');
            
            this.isInitialized = true;
            
            this.outputChannel.appendLine(`Claude Code SDK initialized successfully with working directory: ${this.workingDirectory}`);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to initialize Claude Code SDK: ${error}`);
            vscode.window.showErrorMessage(`Failed to initialize Claude Code: ${error}`);
            throw error;
        }
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
                const tempDir = path.join(os.tmpdir(), 'superdesign-claude');
                
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    this.outputChannel.appendLine(`Created temporary superdesign directory: ${tempDir}`);
                }
                
                this.workingDirectory = tempDir;
                this.outputChannel.appendLine(`Working directory set to (fallback): ${this.workingDirectory}`);
                
                vscode.window.showWarningMessage(
                    'No workspace folder found. Using temporary directory for Claude Code operations.'
                );
            }
        } catch (error) {
            this.outputChannel.appendLine(`Failed to setup working directory: ${error}`);
            // Final fallback to current working directory
            this.workingDirectory = process.cwd();
            this.outputChannel.appendLine(`Working directory set to (final fallback): ${this.workingDirectory}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
        if (!this.isInitialized) {
            throw new Error('Claude Code SDK not initialized');
        }
    }

    async query(params: QueryParams): Promise<SDKMessage[]> {
        this.outputChannel.appendLine('=== QUERY FUNCTION CALLED ===');
        this.outputChannel.appendLine(`Query prompt: ${params.prompt.substring(0, 200)}...`);
        this.outputChannel.appendLine(`Query options: ${JSON.stringify(params.options, null, 2)}`);
        this.outputChannel.appendLine(`Query cwd: ${params.cwd}`);

        await this.ensureInitialized();
        this.outputChannel.appendLine('Initialization check completed');

        const messages: SDKMessage[] = [];
        
        try {
            // Use .superdesign folder as the working directory
            const workingDir = params.cwd || this.workingDirectory;
            this.outputChannel.appendLine(`Resolved working directory: ${workingDir}`);

            const queryParams = {
                prompt: params.prompt,
                abortController: params.abortController || new AbortController(),
                options: {
                    maxTurns: 5,
                    // Enable file tools by default
                    allowedTools: [
                        'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'LS', 'Grep', 'Glob'
                    ],
                    permissionMode: 'acceptEdits' as const,
                    ...params.options
                },
                cwd: path.resolve("/Users/jackjack/github/playground/text-git-init"),
            };

            this.outputChannel.appendLine(`Final query params: ${JSON.stringify({
                prompt: queryParams.prompt.substring(0, 100) + '...',
                options: queryParams.options,
                cwd: queryParams.cwd
            }, null, 2)}`);

            this.outputChannel.appendLine('Starting Claude Code SDK query...');

            let messageCount = 0;
            for await (const message of this.claudeCode.query(queryParams)) {
                messageCount++;
                this.outputChannel.appendLine(`Received message ${messageCount}: type=${message.type}, subtype=${message.subtype}`);
                if (message.type === 'result') {
                    this.outputChannel.appendLine(`Result message: ${JSON.stringify(message, null, 2)}`);
                }
                messages.push(message as SDKMessage);
            }

            this.outputChannel.appendLine(`Query completed successfully. Total messages: ${messages.length}`);
            return messages;
        } catch (error) {
            this.outputChannel.appendLine(`Claude Code query failed: ${error}`);
            this.outputChannel.appendLine(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
            vscode.window.showErrorMessage(`Claude Code query failed: ${error}`);
            throw error;
        }
    }

    // Convenience method for simple text queries
    async simpleQuery(prompt: string, options?: ClaudeCodeOptions): Promise<string> {
        const messages = await this.query({ prompt, options });
        
        // Find the result message
        const resultMessage = messages.find(m => m.type === 'result');
        if (resultMessage?.result) {
            return resultMessage.result;
        }

        // Fallback to last assistant message
        const assistantMessages = messages.filter(m => m.type === 'assistant');
        if (assistantMessages.length > 0) {
            const lastMessage = assistantMessages[assistantMessages.length - 1];
            return lastMessage.message?.content?.[0]?.text || 'No response received';
        }

        throw new Error('No valid response received from Claude Code');
    }

    // Enhanced method for file operations with tools
    async queryWithFileTools(prompt: string, options?: Partial<ClaudeCodeOptions>): Promise<SDKMessage[]> {
        this.outputChannel.appendLine('=== QUERY WITH FILE TOOLS CALLED ===');
        this.outputChannel.appendLine(`File tools prompt: ${prompt.substring(0, 200)}...`);
        this.outputChannel.appendLine(`File tools options: ${JSON.stringify(options, null, 2)}`);
        
        const queryParams = {
            prompt,
            cwd: path.resolve("/Users/jackjack/github/playground/text-git-init"), // Use .superdesign folder
            options: {
                maxTurns: 10,
                allowedTools: [
                    'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'LS', 'Grep', 'Glob'
                ],
                permissionMode: 'acceptEdits' as const,
                systemPrompt: 'You are a helpful coding assistant with access to file system tools. You can read, write, and list files in the .superdesign folder. Always explain what you\'re doing and show the results.',
                ...options
            }
        };
        
        this.outputChannel.appendLine(`Calling query() with params: ${JSON.stringify({
            prompt: queryParams.prompt.substring(0, 100) + '...',
            cwd: queryParams.cwd,
            options: queryParams.options
        }, null, 2)}`);
        
        return this.query(queryParams);
    }



    get isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        try {
            await this.ensureInitialized();
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Initialization failed: ${error}`);
            return false;
        }
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }
} 