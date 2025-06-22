import React, { useState } from 'react';

interface ChatPanelProps {
    vscode: any;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    chatHistory: Array<{type: 'user' | 'assistant', message: string}>;
    setChatHistory: (history: Array<{type: 'user' | 'assistant', message: string}>) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ vscode, isLoading, setIsLoading, chatHistory, setChatHistory }) => {
    const [chatMessage, setChatMessage] = useState('');

    const handleChatMessage = () => {
        if (!chatMessage.trim()) return;
        
        // Add user message to chat history
        setChatHistory([...chatHistory, { type: 'user', message: chatMessage }]);
        
        setIsLoading(true);
        vscode.postMessage({
            command: 'chatWithClaude',
            message: chatMessage
        });
        
        setChatMessage('');
    };

    return (
        <div className="chat-panel">
            <header className="chat-header">
                <h2>💬 Chat with Claude</h2>
                <p>Ask Claude anything about code, design, or development!</p>
            </header>
            
            <div className="chat-container">
                <div className="chat-history">
                    {chatHistory.length === 0 ? (
                        <div className="chat-placeholder">
                            <p>👋 Start a conversation with Claude!</p>
                            <p>You can ask about:</p>
                            <ul>
                                <li>🎨 Design and UI/UX questions</li>
                                <li>💻 Code generation and debugging</li>
                                <li>🏗️ Architecture and best practices</li>
                                <li>📚 Learning and explanations</li>
                            </ul>
                        </div>
                    ) : (
                        chatHistory.map((msg, index) => (
                            <div key={index} className={`chat-message ${msg.type}`}>
                                <div className="message-header">
                                    <strong>{msg.type === 'user' ? '👤 You' : '🤖 Claude'}</strong>
                                </div>
                                <div className="message-content">
                                    {typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message)}
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="chat-message assistant">
                            <div className="message-header">
                                <strong>🤖 Claude</strong>
                            </div>
                            <div className="message-content typing">
                                <span className="typing-indicator">●●●</span> Thinking...
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="chat-input-container">
                    <div className="quick-suggestions">
                        <button 
                            onClick={() => {
                                const message = 'List all files in the current directory';
                                setChatHistory([...chatHistory, { type: 'user', message }]);
                                setIsLoading(true);
                                vscode.postMessage({
                                    command: 'chatWithClaude',
                                    message
                                });
                            }}
                            disabled={isLoading}
                            className="suggestion-btn"
                        >
                            📁 List Files
                        </button>
                        <button 
                            onClick={() => {
                                const message = 'Create a new file called "test.txt" with the content "Hello from Claude Code tools!"';
                                setChatHistory([...chatHistory, { type: 'user', message }]);
                                setIsLoading(true);
                                vscode.postMessage({
                                    command: 'chatWithClaude',
                                    message
                                });
                            }}
                            disabled={isLoading}
                            className="suggestion-btn"
                        >
                            ✏️ Write File
                        </button>
                        <button 
                            onClick={() => {
                                const message = 'Read the contents of package.json file';
                                setChatHistory([...chatHistory, { type: 'user', message }]);
                                setIsLoading(true);
                                vscode.postMessage({
                                    command: 'chatWithClaude',
                                    message
                                });
                            }}
                            disabled={isLoading}
                            className="suggestion-btn"
                        >
                            📖 Read File
                        </button>
                        <button 
                            onClick={() => {
                                const message = 'Generate a React component and save it to a new file';
                                setChatHistory([...chatHistory, { type: 'user', message }]);
                                setIsLoading(true);
                                vscode.postMessage({
                                    command: 'chatWithClaude',
                                    message
                                });
                            }}
                            disabled={isLoading}
                            className="suggestion-btn"
                        >
                            ✨ Generate & Save Component
                        </button>
                    </div>
                    
                    <div className="chat-input">
                        <input
                            type="text"
                            placeholder="Ask Claude anything..."
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleChatMessage()}
                            disabled={isLoading}
                            className="message-input"
                        />
                        <button 
                            onClick={handleChatMessage}
                            disabled={isLoading || !chatMessage.trim()}
                            className="send-btn"
                        >
                            {isLoading ? '⏳' : '📤'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;