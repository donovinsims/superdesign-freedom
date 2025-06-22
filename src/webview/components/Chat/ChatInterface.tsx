import React, { useState, useEffect } from 'react';
import { useChat, ChatMessage } from '../../hooks/useChat';
import { WebviewLayout } from '../../../types/context';
import chatStyles from './ChatInterface.css';

interface ChatInterfaceProps {
    layout: WebviewLayout;
    vscode: any;
}



const ChatInterface: React.FC<ChatInterfaceProps> = ({ layout, vscode }) => {
    const { chatHistory, isLoading, sendMessage } = useChat(vscode);
    const [inputMessage, setInputMessage] = useState('');

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

    const renderChatMessage = (msg: ChatMessage, index: number) => (
        <div key={index} className={`chat-message chat-message--${msg.type} chat-message--${layout}`}>
            <div className="chat-message__header">
                <strong>{msg.type === 'user' ? '👤' : '🤖'}</strong>
                {layout === 'panel' && (
                    <span className="chat-message__label">
                        {msg.type === 'user' ? 'You' : 'Claude'}
                    </span>
                )}
            </div>
            <div className="chat-message__content">
                {typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message)}
            </div>
        </div>
    );



    const renderPlaceholder = () => (
        <div className={`chat-placeholder chat-placeholder--${layout}`}>
            <p>👋 {layout === 'sidebar' ? 'Chat with Claude!' : 'Start a conversation with Claude!'}</p>
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
                            {isLoading && (
                                <div className={`chat-message chat-message--assistant chat-message--${layout}`}>
                                    <div className="chat-message__header">
                                        <strong>🤖</strong>
                                        {layout === 'panel' && <span className="chat-message__label">Claude</span>}
                                    </div>
                                    <div className="chat-message__content typing">
                                        <span className="typing-indicator">●●●</span> Thinking...
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="chat-input-container">
                    <div className="chat-input">
                        <input
                            type="text"
                            placeholder={layout === 'sidebar' ? 'Ask Claude...' : 'Ask Claude anything...'}
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading}
                            className="message-input"
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={isLoading || !inputMessage.trim()}
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

export default ChatInterface; 