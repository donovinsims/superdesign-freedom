import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LLMProvider, LLMProviderOptions, LLMMessage, LLMStreamCallback } from './llmProvider';
import { Logger } from '../services/logger';

interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
}

export class OllamaProvider extends LLMProvider {
    private workingDirectory: string = '';
    private currentSessionId: string | null = null;
    private endpoint: string = 'http://localhost:11434';
    private modelName: string = 'llama3.2';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
        this.initializationPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            Logger.info('Starting Ollama provider initialization...');
            
            // Setup working directory first
            await this.setupWorkingDirectory();

            // Get configuration
            const config = vscode.workspace.getConfiguration('superdesign');
            this.endpoint = config.get<string>('ollamaEndpoint', 'http://localhost:11434');
            this.modelName = config.get<string>('ollamaModel', 'llama3.2');
            
            Logger.info(`Ollama endpoint: ${this.endpoint}`);
            Logger.info(`Ollama model: ${this.modelName}`);

            // Test connection to Ollama
            await this.testConnection();

            this.isInitialized = true;
            Logger.info('Ollama provider initialized successfully');
        } catch (error) {
            Logger.error(`Failed to initialize Ollama provider: ${error}`);
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
                vscode.window.showErrorMessage(
                    'Cannot connect to Ollama. Please make sure Ollama is running. Start it with: ollama serve',
                    'Open Ollama Setup Guide'
                ).then(selection => {
                    if (selection === 'Open Ollama Setup Guide') {
                        vscode.env.openExternal(vscode.Uri.parse('https://ollama.ai'));
                    }
                });
            } else {
                vscode.window.showErrorMessage(`Failed to initialize Ollama provider: ${error}`);
            }
            
            // Reset initialization promise so it can be retried
            this.initializationPromise = null;
            this.isInitialized = false;
            throw error;
        }
    }

    private async testConnection(): Promise<void> {
        try {
            Logger.info('Testing Ollama connection...');
            const response = await fetch(`${this.endpoint}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            if (!response.ok) {
                throw new Error(`Ollama server returned status ${response.status}`);
            }

            const data = await response.json();
            Logger.info(`Ollama connection successful. Available models: ${JSON.stringify(data.models?.map((m: any) => m.name) || [])}`);

            // Check if the configured model is available
            const models = data.models || [];
            const modelExists = models.some((m: any) => m.name === this.modelName || m.name.startsWith(this.modelName));
            
            if (!modelExists && models.length > 0) {
                Logger.warn(`Model ${this.modelName} not found. Available models: ${models.map((m: any) => m.name).join(', ')}`);
                vscode.window.showWarningMessage(
                    `Ollama model "${this.modelName}" not found. You may need to pull it first with: ollama pull ${this.modelName}`,
                    'Pull Model Now'
                ).then(selection => {
                    if (selection === 'Pull Model Now') {
                        vscode.window.showInformationMessage(
                            `Run this command in your terminal: ollama pull ${this.modelName}`
                        );
                    }
                });
            }
        } catch (error) {
            Logger.error(`Ollama connection test failed: ${error}`);
            throw new Error(`Cannot connect to Ollama at ${this.endpoint}. Make sure Ollama is running with: ollama serve`);
        }
    }

    private async setupWorkingDirectory(): Promise<void> {
        try {
            // Try to get workspace root first
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            if (workspaceRoot) {
                // Create .superdesign folder in workspace root
                const superdesignDir = path.join(workspaceRoot, '.superdesign');
                
                // Create directory if it doesn't exist
                if (!fs.existsSync(superdesignDir)) {
                    fs.mkdirSync(superdesignDir, { recursive: true });
                    Logger.info(`Created .superdesign directory: ${superdesignDir}`);
                }
                
                this.workingDirectory = superdesignDir;
            } else {
                Logger.warn('No workspace root found, using temporary directory');
                // Fallback to OS temp directory if no workspace
                const tempDir = path.join(os.tmpdir(), 'superdesign-ollama');
                
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    Logger.info(`Created temporary directory: ${tempDir}`);
                }
                
                this.workingDirectory = tempDir;
                
                vscode.window.showWarningMessage(
                    'No workspace folder found. Using temporary directory for Ollama operations.'
                );
            }
        } catch (error) {
            Logger.error(`Failed to setup working directory: ${error}`);
            // Final fallback to current working directory
            this.workingDirectory = process.cwd();
            Logger.warn(`Using current working directory as fallback: ${this.workingDirectory}`);
        }
    }

    async query(
        prompt: string, 
        options?: Partial<LLMProviderOptions>, 
        abortController?: AbortController,
        onMessage?: LLMStreamCallback
    ): Promise<LLMMessage[]> {
        Logger.info('Starting Ollama query');
        
        await this.ensureInitialized();

        const messages: LLMMessage[] = [];

        // Default system prompt for design tasks
        const systemPrompt = options?.customSystemPrompt || this.getDefaultSystemPrompt();

        // Combine system prompt and user prompt
        const fullPrompt = `${systemPrompt}\n\n${prompt}`;

        try {
            // Generate session ID
            this.currentSessionId = `ollama-${Date.now()}`;

            if (onMessage) {
                // Streaming mode
                Logger.info('Using streaming mode');
                
                const response = await fetch(`${this.endpoint}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: this.modelName,
                        prompt: fullPrompt,
                        stream: true,
                        options: {
                            temperature: 0.7,
                            num_predict: 8000
                        }
                    }),
                    signal: abortController?.signal
                });

                if (!response.ok) {
                    throw new Error(`Ollama API returned status ${response.status}: ${response.statusText}`);
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('Failed to get response reader');
                }

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const data: OllamaResponse = JSON.parse(line);
                                
                                if (data.response) {
                                    const message: LLMMessage = {
                                        type: 'text',
                                        content: data.response,
                                        session_id: this.currentSessionId
                                    };
                                    messages.push(message);
                                    onMessage(message);
                                }

                                if (data.done) {
                                    const finalMessage: LLMMessage = {
                                        type: 'completion',
                                        session_id: this.currentSessionId,
                                        duration_ms: data.total_duration ? data.total_duration / 1000000 : undefined
                                    };
                                    messages.push(finalMessage);
                                    onMessage(finalMessage);
                                }
                            } catch (parseError) {
                                Logger.warn(`Failed to parse Ollama response line: ${line}`);
                            }
                        }
                    }
                }

            } else {
                // Non-streaming mode
                Logger.info('Using non-streaming mode');
                
                const response = await fetch(`${this.endpoint}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: this.modelName,
                        prompt: fullPrompt,
                        stream: false,
                        options: {
                            temperature: 0.7,
                            num_predict: 8000
                        }
                    }),
                    signal: abortController?.signal
                });

                if (!response.ok) {
                    throw new Error(`Ollama API returned status ${response.status}: ${response.statusText}`);
                }

                const data: OllamaResponse = await response.json();

                const message: LLMMessage = {
                    type: 'text',
                    content: data.response,
                    session_id: this.currentSessionId,
                    duration_ms: data.total_duration ? data.total_duration / 1000000 : undefined
                };
                messages.push(message);
            }

            Logger.info(`Ollama query completed with ${messages.length} messages`);
            return messages;

        } catch (error) {
            Logger.error(`Ollama query error: ${error}`);
            
            const errorMessage: LLMMessage = {
                type: 'error',
                content: error instanceof Error ? error.message : String(error),
                is_error: true,
                session_id: this.currentSessionId || 'unknown'
            };
            
            messages.push(errorMessage);
            if (onMessage) {
                onMessage(errorMessage);
            }
            
            throw error;
        }
    }

    private getDefaultSystemPrompt(): string {
        return `# Role
You are a **senior front-end designer**.
You pay close attention to every pixel, spacing, font, color;
Whenever there are UI implementation task, think deeply of the design style first, and then implement UI bit by bit

# When asked to create design:
1. You ALWAYS spin up 3 parallel sub agents concurrently to implement one design with variations, so it's faster for user to iterate (Unless specifically asked to create only one version)

<task_for_each_sub_agent>
1. Build one single html page of just one screen to build a design based on users' feedback/task
2. You ALWAYS output design files in '.superdesign/design_iterations' folder as {design_name}_{n}.html (Where n needs to be unique like table_1.html, table_2.html, etc.) or svg file
3. If you are iterating design based on existing file, then the naming convention should be {current_file_name}_{n}.html, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
</task_for_each_sub_agent>

## When asked to design UI:
1. Similar process as normal design task, but refer to 'UI design & implementation guidelines' for guidelines

## When asked to update or iterate design:
1. Don't edit the existing design, just create a new html file with the same name but with _n.html appended to the end, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
2. At default you should spin up 3 parallel sub agents concurrently to try implement the design, so it's faster for user to iterate

## When asked to design logo or icon:
1. Copy/duplicate existing svg file but name it based on our naming convention in design_iterations folder, and then make edits to the copied svg file (So we can avoid lots of mistakes), like 'original_filename.svg .superdesign/design-iterations/new_filename.svg'
2. Very important sub agent copy first, and Each agent just copy & edit a single svg file with svg code
3. you should focus on the the correctness of the svg code

## When asked to design a component:
1. Similar process as normal design task, and each agent just create a single html page with component inside;
2. Focus just on just one component itself, and don't add any other elements or text
3. Each HTML just have one component with mock data inside

## When asked to design wireframes:
1. Focus on minimal line style black and white wireframes, no colors, and never include any images, just try to use css to make some placeholder images. (Don't use service like placehold.co too, we can't render it)
2. Don't add any annotation of styles, just basic wireframes like Balsamiq style
3. Focus on building out the flow of the wireframes

# UI design & implementation guidelines:
- Use modern, clean design principles
- Implement responsive layouts
- Use Tailwind CSS for styling when possible
- Focus on accessibility and usability
- Create pixel-perfect implementations`;
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        if (this.isInitialized) {
            return true;
        }

        if (this.initializationPromise) {
            try {
                await this.initializationPromise;
                return this.isInitialized;
            } catch {
                return false;
            }
        }

        return false;
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }

    hasValidConfiguration(): boolean {
        const config = vscode.workspace.getConfiguration('superdesign');
        const endpoint = config.get<string>('ollamaEndpoint', '');
        const model = config.get<string>('ollamaModel', '');
        return endpoint.length > 0 && model.length > 0;
    }

    async refreshConfiguration(): Promise<boolean> {
        try {
            Logger.info('Refreshing Ollama configuration');
            
            // Reset initialization state
            this.isInitialized = false;
            this.initializationPromise = null;
            
            // Re-initialize
            await this.initialize();
            
            return this.isInitialized;
        } catch (error) {
            Logger.error(`Failed to refresh Ollama configuration: ${error}`);
            return false;
        }
    }

    isAuthError(errorMessage: string): boolean {
        // Ollama is local, so no auth errors
        return false;
    }

    getProviderName(): string {
        return 'Ollama (Local)';
    }

    getProviderType(): 'api' | 'binary' {
        return 'api';
    }
}
