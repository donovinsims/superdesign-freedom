// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ClaudeCodeService } from './services/claudeCodeService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
// Create output channel for logging
const outputChannel = vscode.window.createOutputChannel('Superdesign');

export function activate(context: vscode.ExtensionContext) {
	outputChannel.appendLine('Superdesign extension is now active!');
	outputChannel.show(); // Show the output channel

	// Initialize Claude Code service
	outputChannel.appendLine('Creating ClaudeCodeService...');
	const claudeService = new ClaudeCodeService(outputChannel);
	outputChannel.appendLine('ClaudeCodeService created');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const helloWorldDisposable = vscode.commands.registerCommand('superdesign.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from superdesign!');
	});

	// Register new design panel command with Claude integration
    const openPanelDisposable = vscode.commands.registerCommand('superdesign.openDesignPanel', () => {
        SuperdesignPanel.createOrShow(context.extensionUri, claudeService);
    });

	// Register API key configuration command
	const configureApiKeyDisposable = vscode.commands.registerCommand('superdesign.configureApiKey', async () => {
		await configureAnthropicApiKey();
	});

	context.subscriptions.push(helloWorldDisposable, openPanelDisposable, configureApiKeyDisposable);
}

class SuperdesignPanel {
    public static currentPanel: SuperdesignPanel | undefined;
    public static readonly viewType = 'superdesignPanel';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, claudeService: ClaudeCodeService) {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (SuperdesignPanel.currentPanel) {
            SuperdesignPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SuperdesignPanel.viewType,
            'Superdesign',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')]
            }
        );

        SuperdesignPanel.currentPanel = new SuperdesignPanel(panel, extensionUri, claudeService);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private claudeService: ClaudeCodeService) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'chatWithClaude':
                        await this.handleChatMessage(message);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        SuperdesignPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }



    private async handleChatMessage(message: any) {
        try {
            outputChannel.appendLine(`Chat message received: ${message.message}`);
            
            // Use the enhanced file tools method
            const response = await this.claudeService.queryWithFileTools(message.message);

            outputChannel.appendLine(`Claude response with tools: ${JSON.stringify(response, null, 2)}`);

            // Build comprehensive response including tool usage
            let fullResponse = '';
            let assistantMessages: string[] = [];
            let toolResults: string[] = [];
            
            for (const msg of response) {
                const subtype = 'subtype' in msg ? msg.subtype : undefined;
                outputChannel.appendLine(`Processing message type: ${msg.type}${subtype ? `, subtype: ${subtype}` : ''}`);
                
                // Collect assistant messages
                if (msg.type === 'assistant' && msg.message) {
                    let content = '';
                    
                    if (typeof msg.message === 'string') {
                        content = msg.message;
                    } else if (msg.message.content && Array.isArray(msg.message.content)) {
                        content = msg.message.content
                            .filter((item: any) => item.type === 'text')
                            .map((item: any) => item.text)
                            .join('\n');
                    } else if (msg.message.content && typeof msg.message.content === 'string') {
                        content = msg.message.content;
                    }
                    
                    if (content.trim()) {
                        assistantMessages.push(content);
                    }
                }
                
                // Collect tool results
                if (msg.type === 'result' && msg.subtype === 'success' && msg.result) {
                    const result = typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result, null, 2);
                    toolResults.push(result);
                }
                
                // Handle tool usage messages
                if ((msg.type === 'assistant' || msg.type === 'user') && ('subtype' in msg) && (msg.subtype === 'tool_use' || msg.subtype === 'tool_result')) {
                    outputChannel.appendLine(`Tool activity detected: ${msg.subtype}`);
                }
            }

            // Combine all responses
            if (assistantMessages.length > 0) {
                fullResponse = assistantMessages.join('\n\n');
            }
            
            if (toolResults.length > 0 && !fullResponse.includes(toolResults[0])) {
                if (fullResponse) {
                    fullResponse += '\n\n--- Tool Results ---\n' + toolResults.join('\n\n');
                } else {
                    fullResponse = toolResults.join('\n\n');
                }
            }

            if (!fullResponse) {
                fullResponse = 'I processed your request but didn\'t generate a visible response. Check the console for details.';
            }

            outputChannel.appendLine(`Final response: ${fullResponse}`);

            // Send response back to webview
            this._panel.webview.postMessage({
                command: 'chatResponse',
                response: fullResponse
            });

        } catch (error) {
            outputChannel.appendLine(`Chat message failed: ${error}`);
            vscode.window.showErrorMessage(`Chat failed: ${error}`);
            
            // Send error response back to webview
            this._panel.webview.postMessage({
                command: 'chatResponse',
                response: `Sorry, I encountered an error: ${error}`
            });
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Superdesign</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


// Function to configure Anthropic API key
async function configureAnthropicApiKey() {
	const currentKey = vscode.workspace.getConfiguration('superdesign').get<string>('anthropicApiKey');
	
	const input = await vscode.window.showInputBox({
		title: 'Configure Anthropic API Key',
		prompt: 'Enter your Anthropic API key (get one from https://console.anthropic.com/)',
		value: currentKey ? '••••••••••••••••' : '',
		password: true,
		placeHolder: 'sk-ant-...',
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return 'API key cannot be empty';
			}
			if (value === '••••••••••••••••') {
				return null; // User didn't change the masked value, that's OK
			}
			if (!value.startsWith('sk-ant-')) {
				return 'Anthropic API keys should start with "sk-ant-"';
			}
			return null;
		}
	});

	if (input !== undefined) {
		// Only update if user didn't just keep the masked value
		if (input !== '••••••••••••••••') {
			try {
				await vscode.workspace.getConfiguration('superdesign').update(
					'anthropicApiKey', 
					input.trim(), 
					vscode.ConfigurationTarget.Global
				);
				vscode.window.showInformationMessage('✅ Anthropic API key configured successfully!');
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
			}
		} else if (currentKey) {
			vscode.window.showInformationMessage('API key unchanged (already configured)');
		} else {
			vscode.window.showWarningMessage('No API key was set');
		}
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}

