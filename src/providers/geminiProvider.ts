import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LLMProvider, LLMProviderOptions, LLMMessage, LLMStreamCallback } from './llmProvider';
import { Logger } from '../services/logger';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';

export class GeminiProvider extends LLMProvider {
    private workingDirectory: string = '';
    private currentSessionId: string | null = null;
    private model: any = null;
    private apiKey: string = '';
    private modelName: string = 'gemini-2.0-flash-exp';

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
        this.initializationPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            Logger.info('Starting Gemini provider initialization...');
            
            // Setup working directory first
            await this.setupWorkingDirectory();

            // Check if API key is configured
            const config = vscode.workspace.getConfiguration('superdesign');
            this.apiKey = config.get<string>('geminiApiKey', '');
            this.modelName = config.get<string>('geminiModel', 'gemini-2.0-flash-exp');
            
            if (!this.apiKey) {
                Logger.warn('No Gemini API key found');
                throw new Error('Missing Gemini API key');
            }

            // Initialize Gemini model
            Logger.info(`Initializing Gemini model: ${this.modelName}`);
            const google = createGoogleGenerativeAI({
                apiKey: this.apiKey
            });
            
            this.model = google(this.modelName);

            this.isInitialized = true;
            Logger.info('Gemini provider initialized successfully');
        } catch (error) {
            Logger.error(`Failed to initialize Gemini provider: ${error}`);
            
            // Check if this is an API key related error
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!this.isAuthError(errorMessage)) {
                vscode.window.showErrorMessage(`Failed to initialize Gemini provider: ${error}`);
            }
            
            // Reset initialization promise so it can be retried
            this.initializationPromise = null;
            this.isInitialized = false;
            throw error;
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
                const tempDir = path.join(os.tmpdir(), 'superdesign-gemini');
                
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    Logger.info(`Created temporary directory: ${tempDir}`);
                }
                
                this.workingDirectory = tempDir;
                
                vscode.window.showWarningMessage(
                    'No workspace folder found. Using temporary directory for Gemini operations.'
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
        Logger.info('Starting Gemini query');
        
        await this.ensureInitialized();

        const messages: LLMMessage[] = [];

        // Default system prompt for design tasks
        const systemPrompt = options?.customSystemPrompt || this.getDefaultSystemPrompt();

        try {
            // Generate session ID
            this.currentSessionId = `gemini-${Date.now()}`;

            if (onMessage) {
                // Streaming mode
                Logger.info('Using streaming mode');
                
                const result = await streamText({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    abortSignal: abortController?.signal,
                    maxTokens: 8000,
                    temperature: 0.7
                });

                for await (const chunk of result.textStream) {
                    const message: LLMMessage = {
                        type: 'text',
                        content: chunk,
                        session_id: this.currentSessionId
                    };
                    messages.push(message);
                    onMessage(message);
                }

                // Send final completion message
                const finalMessage: LLMMessage = {
                    type: 'completion',
                    session_id: this.currentSessionId
                };
                messages.push(finalMessage);
                onMessage(finalMessage);

            } else {
                // Non-streaming mode
                Logger.info('Using non-streaming mode');
                
                const result = await generateText({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    abortSignal: abortController?.signal,
                    maxTokens: 8000,
                    temperature: 0.7
                });

                const message: LLMMessage = {
                    type: 'text',
                    content: result.text,
                    session_id: this.currentSessionId
                };
                messages.push(message);
            }

            Logger.info(`Gemini query completed with ${messages.length} messages`);
            return messages;

        } catch (error) {
            Logger.error(`Gemini query error: ${error}`);
            
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
        return this.isInitialized && this.model !== null;
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
        const apiKey = config.get<string>('geminiApiKey', '');
        return apiKey.length > 0;
    }

    async refreshConfiguration(): Promise<boolean> {
        try {
            Logger.info('Refreshing Gemini configuration');
            
            // Reset initialization state
            this.isInitialized = false;
            this.initializationPromise = null;
            this.model = null;
            
            // Re-initialize
            await this.initialize();
            
            return this.isInitialized;
        } catch (error) {
            Logger.error(`Failed to refresh Gemini configuration: ${error}`);
            return false;
        }
    }

    isAuthError(errorMessage: string): boolean {
        const authErrorPatterns = [
            'api key',
            'authentication',
            'unauthorized',
            'invalid key',
            'missing key',
            '401',
            '403'
        ];

        const lowerMessage = errorMessage.toLowerCase();
        return authErrorPatterns.some(pattern => lowerMessage.includes(pattern));
    }

    getProviderName(): string {
        return 'Google Gemini';
    }

    getProviderType(): 'api' | 'binary' {
        return 'api';
    }
}
