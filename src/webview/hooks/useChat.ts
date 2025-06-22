import { useState, useEffect, useCallback } from 'react';

export interface ChatMessage {
    type: 'user' | 'assistant' | 'result' | 'user-input' | 'tool' | 'tool-result' | 'tool-group';
    message: string;
    timestamp?: number;
    subtype?: string;
    metadata?: {
        duration_ms?: number;
        total_cost_usd?: number;
        is_error?: boolean;
        num_turns?: number;
        tool_name?: string;
        tool_id?: string;
        tool_input?: any;
        session_id?: string;
        parent_tool_use_id?: string;
        result_type?: string;
        tool_result?: string;
        result_is_error?: boolean;
        result_received?: boolean;
        group_id?: string;
        is_loading?: boolean;
        child_tools?: ChatMessage[];
    };
}

export interface ChatHookResult {
    chatHistory: ChatMessage[];
    isLoading: boolean;
    sendMessage: (message: string) => void;
    stopResponse: () => void;
    clearHistory: () => void;
}

export function useChat(vscode: any): ChatHookResult {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Function to auto-collapse previous tool messages
    const autoCollapseTools = () => {
        // Signal to ChatInterface to collapse all but the last tool/tool-result
        window.dispatchEvent(new CustomEvent('autoCollapseTools'));
    };

    useEffect(() => {
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            console.log('Frontend received message:', message);
            
            try {
                switch (message.command) {
                    case 'chatStreamStart':
                        console.log('Starting new chat stream');
                        // Auto-collapse previous tools when starting new stream
                        autoCollapseTools();
                        // Initialize a new assistant message for streaming
                        setChatHistory(prev => [...prev, {
                            type: 'assistant',
                            message: '',
                            timestamp: Date.now()
                        }]);
                        break;
                        
                    case 'chatResponseChunk':
                        console.log('Received chunk:', message.messageType, message.content?.substring(0, 100));
                        setChatHistory(prev => {
                            if (prev.length === 0) {
                                console.warn('Received chunk but no messages in history');
                                return prev;
                            }
                            
                            const newHistory = [...prev];
                            
                            if (message.messageType === 'tool') {
                                // Add new tool message with loading state
                                console.log('Adding tool message:', message.metadata?.tool_name);
                                
                                const parentToolId = message.metadata?.parent_tool_use_id;
                                const newTool: ChatMessage = {
                                    type: 'tool',
                                    message: message.content || '',
                                    timestamp: Date.now(),
                                    subtype: message.subtype,
                                    metadata: {
                                        ...message.metadata,
                                        is_loading: true // Start in loading state
                                    }
                                };
                                
                                if (parentToolId) {
                                    // This tool has a parent - try to group it
                                    const parentGroupIndex = newHistory.findIndex(msg => 
                                        (msg.type === 'tool-group' && msg.metadata?.group_id === parentToolId) ||
                                        (msg.type === 'tool' && msg.metadata?.tool_id === parentToolId)
                                    );
                                    
                                    if (parentGroupIndex !== -1) {
                                        // Add to existing group
                                        const parentMsg = newHistory[parentGroupIndex];
                                        if (parentMsg.type === 'tool-group') {
                                            parentMsg.metadata!.child_tools = parentMsg.metadata!.child_tools || [];
                                            parentMsg.metadata!.child_tools.push(newTool);
                                        } else {
                                            // Convert parent tool to group and add this tool as child
                                            newHistory[parentGroupIndex] = {
                                                type: 'tool-group',
                                                message: parentMsg.message,
                                                timestamp: parentMsg.timestamp,
                                                subtype: parentMsg.subtype,
                                                metadata: {
                                                    ...parentMsg.metadata,
                                                    group_id: parentToolId,
                                                    child_tools: [parentMsg, newTool]
                                                }
                                            };
                                        }
                                    } else {
                                        // Parent not found, add as standalone tool
                                        newHistory.push(newTool);
                                    }
                                } else {
                                    // No parent, add as standalone tool
                                    newHistory.push(newTool);
                                }
                            } else if (message.messageType === 'tool-result') {
                                // Add new tool result message
                                console.log('Adding tool result:', message.metadata?.result_type);
                                newHistory.push({
                                    type: 'tool-result',
                                    message: message.content || '',
                                    timestamp: Date.now(),
                                    subtype: message.subtype,
                                    metadata: message.metadata || {}
                                });
                            } else {
                                // Find the last message of the same type or create new one
                                const lastIndex = newHistory.length - 1;
                                const lastMessage = newHistory[lastIndex];
                                
                                if (lastMessage && lastMessage.type === message.messageType) {
                                    // Append to existing message
                                    newHistory[lastIndex] = {
                                        ...lastMessage,
                                        message: lastMessage.message + message.content,
                                        subtype: message.subtype,
                                        metadata: { ...lastMessage.metadata, ...message.metadata }
                                    };
                                } else {
                                    // Create new message
                                    newHistory.push({
                                        type: message.messageType,
                                        message: message.content || '',
                                        timestamp: Date.now(),
                                        subtype: message.subtype,
                                        metadata: message.metadata || {}
                                    });
                                }
                            }
                            
                            return newHistory;
                        });
                        break;
                        
                    case 'chatToolResult':
                        // Update existing tool message with its result
                        console.log('Received tool result for:', message.tool_use_id);
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            
                            // Helper function to find and update tool in nested structure
                            const findAndUpdateTool = (messages: ChatMessage[], toolId: string): boolean => {
                                for (let i = 0; i < messages.length; i++) {
                                    const msg = messages[i];
                                    
                                    if (msg.type === 'tool' && msg.metadata?.tool_id === toolId) {
                                        // Found the tool - update it with result and remove loading state
                                        messages[i] = {
                                            ...msg,
                                            metadata: {
                                                ...msg.metadata,
                                                tool_result: message.content,
                                                result_is_error: message.is_error,
                                                result_received: true,
                                                is_loading: false // Remove loading state
                                            }
                                        };
                                        return true;
                                    } else if (msg.type === 'tool-group' && msg.metadata?.child_tools) {
                                        // Search in child tools
                                        if (findAndUpdateTool(msg.metadata.child_tools, toolId)) {
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            };
                            
                            const found = findAndUpdateTool(newHistory, message.tool_use_id);
                            
                            if (found) {
                                console.log('Updated tool with result');
                            } else {
                                console.warn('Could not find tool with ID:', message.tool_use_id);
                            }
                            
                            return newHistory;
                        });
                        break;
                        
                    case 'chatStreamEnd':
                        console.log('Chat stream ended');
                        setIsLoading(false);
                        break;
                        
                    case 'chatResponse':
                        console.log('Received complete chat response (legacy)');
                        // Handle legacy non-streaming responses
                        setIsLoading(false);
                        if (message.response) {
                            setChatHistory(prev => [...prev, {
                                type: 'assistant',
                                message: message.response,
                                timestamp: Date.now()
                            }]);
                        }
                        break;
                        
                    case 'chatError':
                        console.error('Chat error received:', message.error);
                        setIsLoading(false);
                        setChatHistory(prev => [...prev, {
                            type: 'result',
                            message: `Error: ${message.error}`,
                            timestamp: Date.now(),
                            subtype: 'error',
                            metadata: { is_error: true }
                        }]);
                        break;
                        
                    case 'chatStopped':
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const lastMessage = newHistory[newHistory.length - 1];
                            if (lastMessage && (lastMessage.type === 'assistant' || lastMessage.type === 'result') && !lastMessage.message.trim()) {
                                // Remove empty message if stopped immediately
                                newHistory.pop();
                            }
                            return [...newHistory, {
                                type: 'result',
                                message: 'Response stopped by user.',
                                timestamp: Date.now(),
                                subtype: 'stopped'
                            }];
                        });
                        setIsLoading(false);
                        break;
                    
                    default:
                        console.log('Unknown message command:', message.command);
                        break;
                }
            } catch (error) {
                console.error('Error handling message:', error, 'Message:', message);
                // Don't crash the UI, just log the error
            }
        };

        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, []);

    const sendMessage = useCallback((message: string) => {
        if (!message.trim() || isLoading) {
            return;
        }
        
        // Add user message to history
        setChatHistory(prev => [...prev, {
            type: 'user-input',
            message: message.trim(),
            timestamp: Date.now()
        }]);
        
        // Send to extension
        setIsLoading(true);
        vscode.postMessage({
            command: 'chatWithClaude',
            message: message.trim()
        });
    }, [vscode, isLoading]);

    const stopResponse = useCallback(() => {
        if (isLoading) {
            vscode.postMessage({
                command: 'stopChat'
            });
            setIsLoading(false);
        }
    }, [vscode, isLoading]);

    const clearHistory = useCallback(() => {
        setChatHistory([]);
    }, []);

    return {
        chatHistory,
        isLoading,
        sendMessage,
        stopResponse,
        clearHistory
    };
} 