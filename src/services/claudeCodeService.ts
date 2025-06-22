import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { query, type SDKMessage } from "@anthropic-ai/claude-code";

interface ClaudeCodeOptions {
    maxTurns?: number;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    outputFormat?: 'text' | 'json' | 'stream-json';
}

export class ClaudeCodeService {
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

    async query(prompt: string, options?: Partial<ClaudeCodeOptions>): Promise<SDKMessage[]> {
        this.outputChannel.appendLine('=== QUERY FUNCTION CALLED ===');
        this.outputChannel.appendLine(`Query prompt: ${prompt.substring(0, 200)}...`);
        this.outputChannel.appendLine(`Query options: ${JSON.stringify(options, null, 2)}`);

        await this.ensureInitialized();
        this.outputChannel.appendLine('Initialization check completed');

        const messages: SDKMessage[] = [];
        
        try {
            const queryParams = {
                prompt,
                abortController: new AbortController(),
                options: {
                    maxTurns: 10,
                    allowedTools: [
                        'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'LS', 'Grep', 'Glob'
                    ],
                    permissionMode: 'acceptEdits' as const,
                    cwd: this.workingDirectory,
                    customSystemPrompt: 'you always respond in ALL CAPS',
                    ...options
                }
            };
            
            this.outputChannel.appendLine(`Final query params: ${JSON.stringify({
                prompt: queryParams.prompt.substring(0, 100) + '...',
                options: queryParams.options
            }, null, 2)}`);
            
            this.outputChannel.appendLine('Starting Claude Code SDK query...');

            let messageCount = 0;
            for await (const message of query(queryParams)) {
                messageCount++;
                const subtype = 'subtype' in message ? message.subtype : undefined;
                this.outputChannel.appendLine(`Received message ${messageCount}: type=${message.type}${subtype ? `, subtype=${subtype}` : ''}`);
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