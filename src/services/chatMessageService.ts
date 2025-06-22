import * as vscode from 'vscode';
import { ClaudeCodeService } from './claudeCodeService';

export class ChatMessageService {
    private currentRequestController?: AbortController;

    constructor(
        private claudeService: ClaudeCodeService,
        private outputChannel: vscode.OutputChannel
    ) {}

    async handleChatMessage(message: any, webview: vscode.Webview): Promise<void> {
        try {
            this.outputChannel.appendLine(`Chat message received: ${message.message}`);
            
            // Create new AbortController for this request
            this.currentRequestController = new AbortController();
            
            // Use the enhanced file tools method
            const response = await this.claudeService.query(message.message, undefined, this.currentRequestController);

            // Check if request was aborted
            if (this.currentRequestController.signal.aborted) {
                this.outputChannel.appendLine('Request was aborted');
                return;
            }

            this.outputChannel.appendLine(`Claude response with tools: ${JSON.stringify(response, null, 2)}`);

            // Build comprehensive response including tool usage
            const fullResponse = this.processClaudeResponse(response);

            this.outputChannel.appendLine(`Final response: ${fullResponse}`);

            // Send response back to webview
            webview.postMessage({
                command: 'chatResponse',
                response: fullResponse
            });

        } catch (error) {
            // Check if the error is due to abort
            if (this.currentRequestController?.signal.aborted) {
                this.outputChannel.appendLine('Request was stopped by user');
                webview.postMessage({
                    command: 'chatStopped'
                });
                return;
            }

            this.outputChannel.appendLine(`Chat message failed: ${error}`);
            vscode.window.showErrorMessage(`Chat failed: ${error}`);
            
            // Send error response back to webview
            webview.postMessage({
                command: 'chatError',
                error: error instanceof Error ? error.message : String(error)
            });
        } finally {
            // Clear the controller when done
            this.currentRequestController = undefined;
        }
    }

    async stopCurrentChat(webview: vscode.Webview): Promise<void> {
        if (this.currentRequestController) {
            this.outputChannel.appendLine('Stopping current chat request');
            this.currentRequestController.abort();
            
            // Send stopped message back to webview
            webview.postMessage({
                command: 'chatStopped'
            });
        } else {
            this.outputChannel.appendLine('No active chat request to stop');
        }
    }

    private processClaudeResponse(response: any[]): string {
        let fullResponse = '';
        let assistantMessages: string[] = [];
        let toolResults: string[] = [];
        
        for (const msg of response) {
            const subtype = 'subtype' in msg ? msg.subtype : undefined;
            this.outputChannel.appendLine(`Processing message type: ${msg.type}${subtype ? `, subtype: ${subtype}` : ''}`);
            
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
                this.outputChannel.appendLine(`Tool activity detected: ${msg.subtype}`);
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

        return fullResponse;
    }
} 