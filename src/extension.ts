// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ClaudeCodeService } from './services/claudeCodeService';
import { ChatSidebarProvider } from './providers/chatSidebarProvider';
import { ChatMessageService } from './services/chatMessageService';
import { generateWebviewHtml } from './templates/webviewTemplate';
import { WebviewContext } from './types/context';

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



	// Register API key configuration command
	const configureApiKeyDisposable = vscode.commands.registerCommand('superdesign.configureApiKey', async () => {
		await configureAnthropicApiKey();
	});

	// Register sidebar provider
	const sidebarProvider = new ChatSidebarProvider(context.extensionUri, claudeService, outputChannel);
	const sidebarDisposable = vscode.window.registerWebviewViewProvider(
		ChatSidebarProvider.VIEW_TYPE,
		sidebarProvider
	);

	// Register command to show sidebar
	const showSidebarDisposable = vscode.commands.registerCommand('superdesign.showChatSidebar', () => {
		vscode.commands.executeCommand('workbench.view.extension.superdesign-sidebar');
	});

	context.subscriptions.push(
		helloWorldDisposable, 
		configureApiKeyDisposable,
		sidebarDisposable,
		showSidebarDisposable
	);
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

