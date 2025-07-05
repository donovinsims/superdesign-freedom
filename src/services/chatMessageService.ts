import * as vscode from 'vscode';
import { ClaudeCodeService } from './claudeCodeService';
import { AgentService } from '../types/agent';
import { convertChatHistoryToAISDK, debugConversion } from './messageConverter';
import { ChatMessage } from '../webview/hooks/useChat';
import { CoreMessage } from 'ai';
import { Logger } from './logger';

export class ChatMessageService {
    private currentRequestController?: AbortController;

    constructor(
        private agentService: AgentService,
        private outputChannel: vscode.OutputChannel
    ) {}

    async handleChatMessage(message: any, webview: vscode.Webview): Promise<void> {
        try {
            const chatHistory: ChatMessage[] = message.chatHistory || [];
            const latestMessage = message.message || '';
            const messageContent = message.messageContent || latestMessage; // New structured content field
            
            Logger.info(`Chat message received with ${chatHistory.length} history messages`);
            Logger.info(`Latest message: ${latestMessage}`);
            
            // Debug structured content
            if (typeof messageContent !== 'string' && Array.isArray(messageContent)) {
                Logger.info(`Structured content: ${messageContent.length} parts`);
                messageContent.forEach((part, index) => {
                    if (part.type === 'text') {
                        Logger.info(`  [${index}] text: "${part.text?.substring(0, 100)}..."`);
                    } else if (part.type === 'image') {
                        Logger.info(`  [${index}] image: ${part.mimeType || 'unknown type'} (${part.image?.length || 0} chars)`);
                    }
                });
            } else {
                Logger.info(`Simple text content: ${String(messageContent).substring(0, 100)}...`);
            }
            
            // Create new AbortController for this request
            this.currentRequestController = new AbortController();
            
            // Send initial streaming start message
            webview.postMessage({
                command: 'chatStreamStart'
            });
            
            // Convert chat history to AI SDK format
            const convertedMessages = convertChatHistoryToAISDK(chatHistory);
            
            // Debug log conversion with VS Code output channel
            this.outputChannel.appendLine('=== MESSAGE CONVERSION DEBUG ===');
            this.outputChannel.appendLine(`📥 Input: ${chatHistory.length} frontend messages`);
            this.outputChannel.appendLine(`📤 Output: ${convertedMessages.length} AI SDK messages`);
            
            // Log each original message
            this.outputChannel.appendLine('📋 Original messages:');
            chatHistory.forEach((msg, index) => {
                this.outputChannel.appendLine(`  [${index}] ${msg.type}: "${msg.message.substring(0, 100)}..." (timestamp: ${msg.timestamp})`);
            });
            
            // Log each converted message  
            this.outputChannel.appendLine('🔄 Converted messages:');
            convertedMessages.forEach((msg, index) => {
                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                this.outputChannel.appendLine(`  [${index}] ${msg.role}: "${content.substring(0, 100)}..."`);
            });
            
            this.outputChannel.appendLine('=== END CONVERSION DEBUG ===');
            
            // Keep original debug for console
            debugConversion(chatHistory, convertedMessages);
            
            // Decide whether to use conversation history or single prompt
            let response: any[];
            if (convertedMessages.length > 0) {
                // Use conversation history
                this.outputChannel.appendLine(`Using conversation history with ${convertedMessages.length} messages`);
                response = await this.agentService.query(
                    undefined, // no prompt 
                    convertedMessages, // use messages array
                    undefined, 
                    this.currentRequestController,
                    (streamMessage: any) => {
                        // Process and send each message as it arrives
                        this.handleStreamMessage(streamMessage, webview);
                    }
                );
            } else {
                // Fallback to single prompt for first message
                this.outputChannel.appendLine('No conversation history, using single prompt');
                response = await this.agentService.query(
                    latestMessage, // use latest message as prompt
                    undefined, // no messages array
                    undefined, 
                    this.currentRequestController,
                    (streamMessage: any) => {
                        // Process and send each message as it arrives
                        this.handleStreamMessage(streamMessage, webview);
                    }
                );
            }

            // Check if request was aborted
            if (this.currentRequestController.signal.aborted) {
                Logger.warn('Request was aborted');
                return;
            }

            Logger.info(`Agent response completed with ${response.length} total messages`);

            // Send stream end message
            webview.postMessage({
                command: 'chatStreamEnd'
            });

        } catch (error) {
            // Check if the error is due to abort
            if (this.currentRequestController?.signal.aborted) {
                Logger.info('Request was stopped by user');
                webview.postMessage({
                    command: 'chatStopped'
                });
                return;
            }

            Logger.error(`Chat message failed: ${error}`);
            Logger.error(`Error type: ${typeof error}, constructor: ${error?.constructor?.name}`);
            
            // Check if this is an API key authentication error or process failure
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.error(`Processing error message: "${errorMessage}"`);
            if (this.agentService.isApiKeyAuthError(errorMessage) || !this.agentService.hasApiKey()) {
                // Send API key error with action buttons
                const displayMessage = this.agentService.hasApiKey() ? 
                    'Invalid AI API key · Fix AI API key' : 
                    'AI API key required · Configure AI API key';
                    
                webview.postMessage({
                    command: 'chatErrorWithActions',
                    error: displayMessage,
                    actions: [
                        { text: 'Configure API Key', command: 'superdesign.configureApiKey' },
                        { text: 'Open Settings', command: 'workbench.action.openSettings', args: '@ext:iganbold.superdesign' }
                    ]
                });
            } else {
                // Regular error - show standard error message
                vscode.window.showErrorMessage(`Chat failed: ${error}`);
                webview.postMessage({
                    command: 'chatError',
                    error: errorMessage
                });
            }
        } finally {
            // Clear the controller when done
            this.currentRequestController = undefined;
        }
    }

    private handleStreamMessage(message: any, webview: vscode.Webview): void {
        const subtype = 'subtype' in message ? message.subtype : undefined;
        // Logger.info(`Processing stream message type: ${message.type}${subtype ? `, subtype: ${subtype}` : ''}`);
        // Logger.info(`Full message structure: ${JSON.stringify(message, null, 2)}`);
        
        // Skip system messages
        if (message.type === 'system') {
            Logger.debug('Skipping system message');
            return;
        }
        
        // Handle user messages (which can contain tool results)
        if (message.type === 'user' && message.message) {
            Logger.debug(`User message structure: ${JSON.stringify(message.message, null, 2)}`);
            
            if (typeof message.message === 'string') {
                const content = message.message;
                Logger.debug(`Extracted user content: "${content}"`);
                
                if (content.trim()) {
                    webview.postMessage({
                        command: 'chatResponseChunk',
                        messageType: 'user',
                        content: content,
                        subtype: subtype,
                        metadata: {
                            session_id: message.session_id,
                            parent_tool_use_id: message.parent_tool_use_id
                        }
                    });
                }
            } else if (message.message.content && Array.isArray(message.message.content)) {
                // Handle tool results within user messages
                for (const item of message.message.content) {
                    if (item.type === 'tool_result' && item.tool_use_id) {
                        // This is a tool result - send it as an update to the corresponding tool
                        const resultContent = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
                        
                        Logger.debug(`Tool result for ${item.tool_use_id}: "${resultContent.substring(0, 200)}..."`);
                        
                        webview.postMessage({
                            command: 'chatToolResult',
                            tool_use_id: item.tool_use_id,
                            content: resultContent,
                            is_error: item.is_error || false,
                            metadata: {
                                session_id: message.session_id,
                                parent_tool_use_id: message.parent_tool_use_id
                            }
                        });
                    } else if (item.type === 'tool_parameter_update' && item.tool_use_id) {
                        // This is a tool parameter update - send it to update the tool's parameters
                        this.outputChannel.appendLine(`Tool parameter update for ${item.tool_use_id}: ${JSON.stringify(item.parameters).substring(0, 200)}...`);
                        
                        webview.postMessage({
                            command: 'chatToolUpdate',
                            tool_use_id: item.tool_use_id,
                            tool_input: item.parameters
                        });
                    } else if (item.type === 'text' && item.text) {
                        // Regular text content in user message
                        webview.postMessage({
                            command: 'chatResponseChunk',
                            messageType: 'user',
                            content: item.text,
                            subtype: subtype,
                            metadata: {
                                session_id: message.session_id,
                                parent_tool_use_id: message.parent_tool_use_id
                            }
                        });
                    }
                }
            } else if (message.message.content && typeof message.message.content === 'string') {
                const content = message.message.content;
                Logger.debug(`Extracted user content: "${content}"`);
                
                if (content.trim()) {
                    webview.postMessage({
                        command: 'chatResponseChunk',
                        messageType: 'user',
                        content: content,
                        subtype: subtype,
                        metadata: {
                            session_id: message.session_id,
                            parent_tool_use_id: message.parent_tool_use_id
                        }
                    });
                }
            } else if (message.message.text) {
                const content = message.message.text;
                Logger.debug(`Extracted user content: "${content}"`);
                
                if (content.trim()) {
                    webview.postMessage({
                        command: 'chatResponseChunk',
                        messageType: 'user',
                        content: content,
                        subtype: subtype,
                        metadata: {
                            session_id: message.session_id,
                            parent_tool_use_id: message.parent_tool_use_id
                        }
                    });
                }
            } else {
                Logger.debug('No content found in user message');
            }
        }
        
        // Handle assistant messages
        if (message.type === 'assistant' && message.message) {
            // Logger.info(`Assistant message structure: ${JSON.stringify(message.message, null, 2)}`);
            
            if (typeof message.message === 'string') {
                const content = message.message;
                // Logger.info(`Extracted assistant content: "${content}"`);
                
                if (content.trim()) {
                    webview.postMessage({
                        command: 'chatResponseChunk',
                        messageType: 'assistant',
                        content: content,
                        subtype: subtype,
                        metadata: {
                            session_id: message.session_id,
                            parent_tool_use_id: message.parent_tool_use_id
                        }
                    });
                }
            } else if (message.message.content && Array.isArray(message.message.content)) {
                // Handle each content item separately
                for (const item of message.message.content) {
                    if (item.type === 'text' && item.text) {
                        // Send text content as assistant message
                        webview.postMessage({
                            command: 'chatResponseChunk',
                            messageType: 'assistant',
                            content: item.text,
                            subtype: subtype,
                            metadata: {
                                session_id: message.session_id,
                                parent_tool_use_id: message.parent_tool_use_id
                            }
                        });
                    } else if (item.type === 'tool_use') {
                        // Send each tool use as a separate tool message
                        webview.postMessage({
                            command: 'chatResponseChunk',
                            messageType: 'tool',
                            content: '',
                            subtype: 'tool_use',
                            metadata: {
                                session_id: message.session_id,
                                parent_tool_use_id: message.parent_tool_use_id,
                                tool_name: item.name || 'Unknown Tool',
                                tool_id: item.id,
                                tool_input: item.input || {}
                            }
                        });
                    }
                }
            } else if (message.message.content && typeof message.message.content === 'string') {
                const content = message.message.content;
                // Logger.info(`Extracted assistant content: "${content}"`);
                
                if (content.trim()) {
                    webview.postMessage({
                        command: 'chatResponseChunk',
                        messageType: 'assistant',
                        content: content,
                        subtype: subtype,
                        metadata: {
                            session_id: message.session_id,
                            parent_tool_use_id: message.parent_tool_use_id
                        }
                    });
                }
            } else if (message.message.text) {
                const content = message.message.text;
                // Logger.info(`Extracted assistant content: "${content}"`);
                
                if (content.trim()) {
                    webview.postMessage({
                        command: 'chatResponseChunk',
                        messageType: 'assistant',
                        content: content,
                        subtype: subtype,
                        metadata: {
                            session_id: message.session_id,
                            parent_tool_use_id: message.parent_tool_use_id
                        }
                    });
                }
            } else {
                Logger.debug('No content found in assistant message');
            }
        }
        
        // Handle result messages (tool results)
        if (message.type === 'result') {
            Logger.debug(`Result message structure: ${JSON.stringify(message, null, 2)}`);
            
            // Skip error result messages that contain raw API key errors - these are handled by our custom error handler
            if (message.is_error) {
                // Check if this is an API key related error in any field
                const messageStr = JSON.stringify(message).toLowerCase();
                if (messageStr.includes('api key') || messageStr.includes('authentication') || 
                    messageStr.includes('unauthorized') || messageStr.includes('anthropic') ||
                    messageStr.includes('process exited') || messageStr.includes('exit code')) {
                    Logger.debug('Skipping raw API key error result message - handled by custom error handler');
                    return;
                }
            }
            
            // Skip final success result messages that are just summaries
            if (message.subtype === 'success' && message.result && typeof message.result === 'string') {
                const resultText = message.result.toLowerCase();
                // Skip if it looks like a final summary (contains phrases like "successfully created", "perfect", etc.)
                if (resultText.includes('successfully') || resultText.includes('perfect') || 
                    resultText.includes('created') || resultText.includes('variations')) {
                    Logger.debug('Skipping final summary result message');
                    return;
                }
            }
            
            let content = '';
            let resultType = 'result';
            let isError = false;
            
            if (typeof message.message === 'string') {
                content = message.message;
            } else if (message.content) {
                content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
            } else if (message.text) {
                content = message.text;
            } else if (message.result && typeof message.result === 'string') {
                content = message.result;
            } else {
                // Skip messages that would result in raw JSON dump
                Logger.debug('Skipping result message with no readable content');
                return;
            }
            
            // Determine result type and error status
            if (message.subtype) {
                if (message.subtype.includes('error')) {
                    isError = true;
                    resultType = 'error';
                } else if (message.subtype === 'success') {
                    resultType = 'success';
                }
            }
            
            Logger.debug(`Extracted result content: "${content.substring(0, 200)}..."`);
            
            if (content.trim()) {
                webview.postMessage({
                    command: 'chatResponseChunk',
                    messageType: 'tool-result',
                    content: content,
                    subtype: subtype,
                    metadata: {
                        session_id: message.session_id,
                        parent_tool_use_id: message.parent_tool_use_id,
                        result_type: resultType,
                        is_error: isError,
                        duration_ms: message.duration_ms,
                        total_cost_usd: message.total_cost_usd
                    }
                });
            }
        }
        
        // Log tool activity
        if ((message.type === 'assistant' || message.type === 'user') && ('subtype' in message) && (message.subtype === 'tool_use' || message.subtype === 'tool_result')) {
            Logger.debug(`Tool activity detected: ${message.subtype}`);
        }
    }

    async stopCurrentChat(webview: vscode.Webview): Promise<void> {
        if (this.currentRequestController) {
            Logger.info('Stopping current chat request');
            this.currentRequestController.abort();
            
            // Send stopped message back to webview
            webview.postMessage({
                command: 'chatStopped'
            });
        } else {
            Logger.info('No active chat request to stop');
        }
    }

    private processClaudeResponse(response: any[]): string {
        let fullResponse = '';
        let assistantMessages: string[] = [];
        let toolResults: string[] = [];
        
        for (const msg of response) {
            const subtype = 'subtype' in msg ? msg.subtype : undefined;
            Logger.debug(`Processing message type: ${msg.type}${subtype ? `, subtype: ${subtype}` : ''}`);
            
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
                Logger.debug(`Tool activity detected: ${msg.subtype}`);
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