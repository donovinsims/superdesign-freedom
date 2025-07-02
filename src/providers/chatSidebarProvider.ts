import * as vscode from 'vscode';
import { ClaudeCodeService } from '../services/claudeCodeService';
import { ChatMessageService } from '../services/chatMessageService';
import { generateWebviewHtml } from '../templates/webviewTemplate';
import { WebviewContext } from '../types/context';
import { AgentService } from '../types/agent';

export class ChatSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly VIEW_TYPE = 'superdesign.chatView';
    private _view?: vscode.WebviewView;
    private messageHandler: ChatMessageService;
    private customMessageHandler?: (message: any) => void;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentService: AgentService,
        private readonly outputChannel: vscode.OutputChannel
    ) {
        this.messageHandler = new ChatMessageService(agentService, outputChannel);
    }

    public setMessageHandler(handler: (message: any) => void) {
        this.customMessageHandler = handler;
    }

    public sendMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'assets')
            ]
        };

        const webviewContext: WebviewContext = {
            layout: 'sidebar',
            extensionUri: this._extensionUri.toString()
        };

        webviewView.webview.html = generateWebviewHtml(
            webviewView.webview,
            this._extensionUri,
            webviewContext
        );

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                // First try custom message handler for auto-canvas functionality
                if (this.customMessageHandler) {
                    this.customMessageHandler(message);
                }

                // Then handle regular chat messages
                switch (message.command) {
                    case 'chatWithClaude':
                        await this.messageHandler.handleChatMessage(message, webviewView.webview);
                        break;
                    case 'stopChat':
                        await this.messageHandler.stopCurrentChat(webviewView.webview);
                        break;
                    case 'getCurrentProvider':
                        await this.handleGetCurrentProvider(webviewView.webview);
                        break;
                    case 'changeProvider':
                        await this.handleChangeProvider(message.provider, webviewView.webview);
                        break;
                }
            }
        );
    }

    private async handleGetCurrentProvider(webview: vscode.Webview) {
        const config = vscode.workspace.getConfiguration('superdesign');
        const currentProvider = config.get<string>('aiModelProvider', 'anthropic');
        
        webview.postMessage({
            command: 'currentProviderResponse',
            provider: currentProvider
        });
    }

    private async handleChangeProvider(provider: string, webview: vscode.Webview) {
        try {
            const config = vscode.workspace.getConfiguration('superdesign');
            await config.update('aiModelProvider', provider, vscode.ConfigurationTarget.Global);
            
            // Check if the API key is configured for the selected provider
            const apiKeyKey = provider === 'openai' ? 'openaiApiKey' : 'anthropicApiKey';
            const apiKey = config.get<string>(apiKeyKey);
            
            if (!apiKey) {
                const providerName = provider === 'openai' ? 'OpenAI (GPT-4o)' : 'Anthropic (Claude 3.5 Sonnet)';
                const configureCommand = provider === 'openai' ? 
                    'superdesign.configureOpenAIApiKey' : 
                    'superdesign.configureApiKey';
                
                const result = await vscode.window.showWarningMessage(
                    `${providerName} selected, but API key is not configured. Would you like to configure it now?`,
                    'Configure API Key',
                    'Later'
                );
                
                if (result === 'Configure API Key') {
                    await vscode.commands.executeCommand(configureCommand);
                }
            } else {
                const providerName = provider === 'openai' ? 'OpenAI (GPT-4o)' : 'Anthropic (Claude 3.5 Sonnet)';
                vscode.window.showInformationMessage(`✅ AI provider switched to ${providerName}`);
            }

            // Notify webview of successful change
            webview.postMessage({
                command: 'providerChanged',
                provider: provider
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update AI provider: ${error}`);
        }
    }
} 