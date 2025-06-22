import { useState, useEffect, useCallback } from 'react';

export interface ChatMessage {
    type: 'user' | 'assistant';
    message: string;
    timestamp?: number;
}

export interface ChatHookResult {
    chatHistory: ChatMessage[];
    isLoading: boolean;
    sendMessage: (message: string) => void;
    clearHistory: () => void;
}

export function useChat(vscode: any): ChatHookResult {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'chatResponse':
                    setChatHistory(prev => [...prev, {
                        type: 'assistant',
                        message: message.response,
                        timestamp: Date.now()
                    }]);
                    setIsLoading(false);
                    break;
                case 'chatError':
                    setChatHistory(prev => [...prev, {
                        type: 'assistant',
                        message: `Error: ${message.error}`,
                        timestamp: Date.now()
                    }]);
                    setIsLoading(false);
                    break;
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
            type: 'user',
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

    const clearHistory = useCallback(() => {
        setChatHistory([]);
    }, []);

    return {
        chatHistory,
        isLoading,
        sendMessage,
        clearHistory
    };
} 