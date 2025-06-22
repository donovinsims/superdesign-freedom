import React, { useState, useEffect } from 'react';
import { useChat, ChatMessage } from '../../hooks/useChat';
import { WebviewLayout } from '../../../types/context';
import chatStyles from './ChatInterface.css';

interface ChatInterfaceProps {
    layout: WebviewLayout;
    vscode: any;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ layout, vscode }) => {
    const { chatHistory, isLoading, sendMessage, stopResponse } = useChat(vscode);
    const [inputMessage, setInputMessage] = useState('');
    const [selectedAgent, setSelectedAgent] = useState('Agent #1');
    const [selectedModel, setSelectedModel] = useState('claude-4-sonnet');

    useEffect(() => {
        // Inject ChatInterface CSS styles
        const styleId = 'chat-interface-styles';
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            styleElement.textContent = chatStyles;
            document.head.appendChild(styleElement);
        }

        return () => {
            // Clean up on unmount
            const existingStyle = document.getElementById(styleId);
            if (existingStyle) {
                document.head.removeChild(existingStyle);
            }
        };
    }, []);

    const handleSendMessage = () => {
        if (inputMessage.trim()) {
            sendMessage(inputMessage);
            setInputMessage('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleAddContext = () => {
        // TODO: Implement context addition functionality
        console.log('Add Context clicked');
    };

    const renderChatMessage = (msg: ChatMessage, index: number) => {
        const isLastUserMessage = msg.type === 'user' && index === chatHistory.length - 1 && isLoading;
        
        return (
            <div key={index} className={`chat-message chat-message--${msg.type} chat-message--${layout}`}>
                {layout === 'panel' && (
                    <div className="chat-message__header">
                        <span className="chat-message__label">
                            {msg.type === 'user' ? 'You' : 'Claude'}
                        </span>
                    </div>
                )}
                <div className="chat-message__content">
                    {typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message)}
                </div>
                {isLastUserMessage && (
                    <div className="generating-content">
                        <span className="generating-text">Generating</span>
                        <button 
                            onClick={stopResponse}
                            className="generating-stop-btn"
                            title="Stop response"
                        >
                            Stop
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderPlaceholder = () => (
        <div className={`chat-placeholder chat-placeholder--${layout}`}>
            {layout === 'panel' && (
                <div className="chat-placeholder__features">
                    <p>You can ask about:</p>
                    <ul>
                        <li>🎨 Design and UI/UX questions</li>
                        <li>💻 Code generation and debugging</li>
                        <li>🏗️ Architecture and best practices</li>
                        <li>📚 Learning and explanations</li>
                    </ul>
                </div>
            )}
        </div>
    );

    return (
        <div className={`chat-interface chat-interface--${layout}`}>
            {layout === 'panel' && (
                <header className="chat-header">
                    <h2>💬 Chat with Claude</h2>
                    <p>Ask Claude anything about code, design, or development!</p>
                </header>
            )}

            <div className="chat-container">
                <div className="chat-history">
                    {chatHistory.length === 0 ? renderPlaceholder() : (
                        <>
                            {chatHistory.map(renderChatMessage)}
                        </>
                    )}
                </div>

                <div className="chat-input-container">
                    {/* Main Input Area */}
                    <div className="chat-input-wrapper">
                        {/* Add Context Button */}
                        <button 
                            className="add-context-btn"
                            onClick={handleAddContext}
                            disabled={isLoading}
                        >
                            <span className="add-context-icon">@</span>
                            Add Context
                        </button>

                        {/* Input Area */}
                        <div className="chat-input">
                            <textarea
                                placeholder="Plan, search, build anything"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={isLoading}
                                className="message-input"
                                rows={1}
                            />
                        </div>

                        {/* Agent and Model Selectors with Actions */}
                        <div className="input-controls">
                            <div className="selectors-group">
                                <div className="selector-wrapper">
                                    <select 
                                        className="agent-selector"
                                        value={selectedAgent}
                                        onChange={(e) => setSelectedAgent(e.target.value)}
                                        disabled={isLoading}
                                    >
                                        <option value="Agent #1">Agent #1</option>
                                        <option value="Agent #2">Agent #2</option>
                                    </select>
                                    <svg className="selector-icon agent-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M5.68 5.792 7.345 7.75 5.681 9.708a2.75 2.75 0 1 1 0-3.916ZM8 6.978 6.416 5.113a2.75 2.75 0 1 1 3.168 0L8 6.978ZM9.598 7.75 8 6.022l1.598 1.728a2.75 2.75 0 1 1-1.598 0Z"/>
                                    </svg>
                                </div>

                                <div className="selector-wrapper">
                                    <select 
                                        className="model-selector"
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        disabled={isLoading}
                                    >
                                        <option value="claude-4-sonnet">claude-4-sonnet</option>
                                        <option value="claude-3-haiku">claude-3-haiku</option>
                                        <option value="claude-3-opus">claude-3-opus</option>
                                    </select>
                                    <svg className="selector-icon model-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M9.5 2A1.5 1.5 0 0 1 11 3.5v1.75l1.85 1.85a.5.5 0 0 1 0 .7L11 9.65V11.5A1.5 1.5 0 0 1 9.5 13h-3A1.5 1.5 0 0 1 5 11.5V9.65L3.15 7.8a.5.5 0 0 1 0-.7L5 5.25V3.5A1.5 1.5 0 0 1 6.5 2h3ZM6 3.5v1.75a.5.5 0 0 1-.146.354L4.207 7.5l1.647 1.396A.5.5 0 0 1 6 9.25V11.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5V9.25a.5.5 0 0 1 .146-.354L11.793 7.5l-1.647-1.396A.5.5 0 0 1 10 5.75V3.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z"/>
                                    </svg>
                                </div>
                            </div>
                            
                            <div className="input-actions">
                                <button 
                                    className="attach-btn"
                                    disabled={isLoading}
                                    title="Attach file"
                                >
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                                        <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                                    </svg>
                                </button>
                                {isLoading ? (
                                    <button 
                                        onClick={stopResponse}
                                        className="send-btn stop-btn"
                                        title="Stop response"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 9 14H7a1.5 1.5 0 0 1-1.5-1.5v-9z"/>
                                        </svg>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleSendMessage}
                                        disabled={!inputMessage.trim()}
                                        className="send-btn"
                                        title="Send message"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"/>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface; 