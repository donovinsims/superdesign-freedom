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
    const [expandedTools, setExpandedTools] = useState<{[key: number]: boolean}>({});
    const [showFullContent, setShowFullContent] = useState<{[key: string | number]: boolean}>({});

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

    // Auto-collapse tools when new messages arrive
    useEffect(() => {
        const handleAutoCollapse = () => {
            setExpandedTools(prev => {
                const newState = { ...prev };
                const toolIndices = chatHistory
                    .map((msg, index) => ({ msg, index }))
                    .filter(({ msg }) => msg.type === 'tool' || msg.type === 'tool-result')
                    .map(({ index }) => index);
                
                // Keep only the last tool/tool-result expanded
                if (toolIndices.length > 1) {
                    const lastToolIndex = toolIndices[toolIndices.length - 1];
                    toolIndices.forEach(index => {
                        if (index !== lastToolIndex) {
                            newState[index] = false;
                        }
                    });
                }
                
                return newState;
            });
        };

        window.addEventListener('autoCollapseTools', handleAutoCollapse);
        return () => window.removeEventListener('autoCollapseTools', handleAutoCollapse);
    }, [chatHistory]);

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

    const handleCopyMessage = (message: string) => {
        navigator.clipboard.writeText(message).then(() => {
            // Could add a toast notification here
            console.log('Message copied to clipboard');
        });
    };

    const handleLikeMessage = (index: number) => {
        // TODO: Implement like functionality
        console.log('Liked message:', index);
    };

    const handleDislikeMessage = (index: number) => {
        // TODO: Implement dislike functionality
        console.log('Disliked message:', index);
    };

    const renderChatMessage = (msg: ChatMessage, index: number) => {
        const isLastUserMessage = msg.type === 'user-input' && index === chatHistory.length - 1 && isLoading;
        const isLastStreamingMessage = (msg.type === 'assistant' || msg.type === 'result') && index === chatHistory.length - 1;
        const isStreaming = isLastStreamingMessage && isLoading;
        const messageText = typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message);
        
        // Handle tool messages specially
        if (msg.type === 'tool') {
            return renderToolMessage(msg, index);
        }
        
        // Handle tool groups specially
        if (msg.type === 'tool-group') {
            return renderToolGroup(msg, index);
        }
        
        // Determine message label and styling
        let messageLabel = '';
        let messageClass = '';
        
        switch (msg.type) {
            case 'user-input':
                messageLabel = 'You';
                messageClass = 'user';
                break;
            case 'user':
                messageLabel = 'Claude (User Message)';
                messageClass = 'user-sdk';
                break;
            case 'assistant':
                messageLabel = 'Claude';
                messageClass = 'assistant';
                break;
            case 'result':
                if (msg.subtype === 'success') {
                    messageLabel = 'Result';
                } else if (msg.subtype === 'error_max_turns') {
                    messageLabel = 'Error (Max Turns)';
                } else if (msg.subtype === 'error_during_execution') {
                    messageLabel = 'Error (Execution)';
                } else if (msg.subtype === 'stopped') {
                    messageLabel = 'Stopped';
                } else if (msg.subtype === 'error') {
                    messageLabel = 'Error';
                } else {
                    messageLabel = 'Result';
                }
                messageClass = msg.metadata?.is_error ? 'result-error' : 'result';
                break;
        }
        
        return (
            <div key={index} className={`chat-message chat-message--${messageClass} chat-message--${layout}`}>
                {layout === 'panel' && (
                    <div className="chat-message__header">
                        <span className="chat-message__label">
                            {messageLabel}
                        </span>
                        {msg.metadata && (
                            <span className="chat-message__metadata">
                                {msg.metadata.duration_ms && (
                                    <span className="metadata-item">{msg.metadata.duration_ms}ms</span>
                                )}
                                {msg.metadata.total_cost_usd && (
                                    <span className="metadata-item">${msg.metadata.total_cost_usd.toFixed(4)}</span>
                                )}
                                {msg.metadata.num_turns && (
                                    <span className="metadata-item">{msg.metadata.num_turns} turns</span>
                                )}
                            </span>
                        )}
                    </div>
                )}
                <div className="chat-message__content">
                    {messageText}
                    {isStreaming && <span className="streaming-cursor">▋</span>}
                </div>
                {(msg.type === 'assistant' || msg.type === 'result') && !isStreaming && (
                    <div className="message-actions">
                        <button 
                            onClick={() => handleLikeMessage(index)}
                            className="action-btn like-btn"
                            title="Like response"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8.864.046C7.908-.193 7.02.53 6.956 1.466c-.072 1.051-.23 2.016-.428 2.59-.125.36-.479 1.013-1.04 1.639-.557.623-1.282 1.178-2.131 1.41C2.685 7.288 2 7.87 2 8.72v4.001c0 .845.682 1.464 1.448 1.545 1.07.114 1.564.415 2.068.723l.048.03c.272.165.578.348.97.484.397.136.861.217 1.466.217h3.5c.937 0 1.599-.477 1.934-1.064a1.86 1.86 0 0 0 .254-.912c0-.152-.023-.312-.077-.464.201-.263.38-.578.488-.901.11-.33.172-.762.004-1.149.069-.13.12-.269.159-.403.077-.27.113-.568.113-.857 0-.288-.036-.585-.113-.856a2.144 2.144 0 0 0-.138-.362 1.9 1.9 0 0 0 .234-1.734c-.206-.592-.682-1.1-1.2-1.272-.847-.282-1.803-.276-2.516-.211a9.84 9.84 0 0 0-.443.05 9.365 9.365 0 0 0-.062-4.509A1.38 1.38 0 0 0 9.125.111L8.864.046zM11.5 14.721H8c-.51 0-.863-.069-1.14-.164-.281-.097-.506-.228-.776-.393l-.04-.024c-.555-.339-1.198-.731-2.49-.868-.333-.036-.554-.29-.554-.55V8.72c0-.254.226-.543.62-.65 1.095-.3 1.977-.996 2.614-1.708.635-.71 1.064-1.475 1.238-1.978.243-.7.407-1.768.482-2.85.025-.362.36-.594.667-.518l.262.066c.16.04.258.143.288.255a8.34 8.34 0 0 1-.145 4.725.5.5 0 0 0 .595.644l.003-.001.014-.003.058-.014a8.908 8.908 0 0 1 1.036-.157c.663-.06 1.457-.054 2.11.164.175.058.45.3.57.65.107.308.087.67-.266 1.022l-.353.353.353.354c.043.043.105.141.154.315.048.167.075.37.075.581 0 .212-.027.414-.075.582-.05.174-.111.272-.154.315l-.353.353.353.354c.047.047.109.177.005.488a2.224 2.224 0 0 1-.505.805l-.353.353.353.354c.006.005.041.05.041.17a.866.866 0 0 1-.121.416c-.165.288-.503.56-1.066.56z"/>
                            </svg>
                        </button>
                        <button 
                            onClick={() => handleDislikeMessage(index)}
                            className="action-btn dislike-btn"
                            title="Dislike response"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8.864 15.674c-.956.24-1.843-.484-1.908-1.42-.072-1.05-.23-2.015-.428-2.59-.125-.36-.479-1.012-1.04-1.638-.557-.624-1.282-1.179-2.131-1.41C2.685 8.432 2 7.85 2 7V3c0-.845.682-1.464 1.448-1.546 1.07-.113 1.564-.415 2.068-.723l.048-.029c.272-.166.578-.349.97-.484C6.931.082 7.395 0 8 0h3.5c.937 0 1.599.478 1.934 1.064.164.287.254.607.254.913 0 .152-.023.312-.077.464.201.262.38.577.488.9.11.33.172.762.004 1.15.069.129.12.268.159.403.077.27.113.567.113.856 0 .289-.036.586-.113.856-.035.12-.08.244-.138.363.394.571.418 1.2.234 1.733-.206.592-.682 1.1-1.2 1.272-.847.283-1.803.276-2.516.211a9.877 9.877 0 0 1-.443-.05 9.364 9.364 0 0 1-.062 4.51c-.138.508-.55.848-1.012.964l-.261.065zM11.5 1H8c-.51 0-.863.068-1.14.163-.281.097-.506.229-.776.393l-.04.025c-.555.338-1.198.73-2.49.868-.333.035-.554.29-.554.55V7c0 .255.226.543.62.65 1.095.3 1.977.997 2.614 1.709.635.71 1.064 1.475 1.238 1.977.243.7.407 1.768.482 2.85.025.362.36.595.667.518l.262-.065c.16-.04.258-.144.288-.255a8.34 8.34 0 0 0-.145-4.726.5.5 0 0 1 .595-.643h.003l.014.004.058.013a8.912 8.912 0 0 0 1.036.157c.663.06 1.457.054 2.11-.164.175-.058.45-.3.57-.65.107-.308.087-.67-.266-1.021L12.793 6l.353-.354c.043-.042.105-.14.154-.315.048-.167.075-.37.075-.581 0-.211-.027-.414-.075-.581-.05-.174-.111-.273-.154-.315L12.793 4l.353-.354c.047-.047.109-.176.005-.488a2.224 2.224 0 0 0-.505-.804L12.293 2l.353-.354c.006-.005.041-.05.041-.17a.866.866 0 0 0-.121-.415C12.4 1.272 12.063 1 11.5 1z"/>
                            </svg>
                        </button>
                        <button 
                            onClick={() => handleCopyMessage(messageText)}
                            className="action-btn copy-btn"
                            title="Copy response"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                            </svg>
                        </button>
                    </div>
                )}
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

    const renderToolMessage = (msg: ChatMessage, index: number) => {
        try {
            const isExpanded = expandedTools[index] || false;
            const showFullResult = showFullContent[index] || false;
            const showFullInput = showFullContent[`${index}_input`] || false;
            const showFullPrompt = showFullContent[`${index}_prompt`] || false;
            
            const toolName = msg.metadata?.tool_name || 'Unknown Tool';
            const toolInput = msg.metadata?.tool_input || {};
            const description = toolInput.description || '';
            const command = toolInput.command || '';
            const prompt = toolInput.prompt || '';
            
            // Tool result data
            const hasResult = msg.metadata?.result_received || false;
            const isLoading = msg.metadata?.is_loading || false;
            const toolResult = msg.metadata?.tool_result || '';
            const resultIsError = msg.metadata?.result_is_error || false;
            
            console.log('Rendering tool message:', { toolName, hasResult, isLoading, resultLength: toolResult.length });
            
            const toggleExpanded = () => {
                setExpandedTools(prev => ({
                    ...prev,
                    [index]: !prev[index]
                }));
            };
            
            const toggleShowFullResult = () => {
                setShowFullContent(prev => ({
                    ...prev,
                    [index]: !prev[index]
                }));
            };
            
            const toggleShowFullInput = () => {
                setShowFullContent(prev => ({
                    ...prev,
                    [`${index}_input`]: !prev[`${index}_input`]
                }));
            };
            
            const toggleShowFullPrompt = () => {
                setShowFullContent(prev => ({
                    ...prev,
                    [`${index}_prompt`]: !prev[`${index}_prompt`]
                }));
            };
            
            // Determine if content needs truncation
            const MAX_PREVIEW = 300;
            
            // Result truncation
            const resultNeedsTruncation = toolResult.length > MAX_PREVIEW;
            const displayResult = resultNeedsTruncation && !showFullResult 
                ? toolResult.substring(0, MAX_PREVIEW) + '...'
                : toolResult;
            
            // Input truncation
            const inputString = JSON.stringify(toolInput, null, 2);
            const inputNeedsTruncation = inputString.length > MAX_PREVIEW;
            const displayInput = inputNeedsTruncation && !showFullInput 
                ? inputString.substring(0, MAX_PREVIEW) + '...'
                : inputString;
            
            // Prompt truncation
            const promptNeedsTruncation = prompt.length > MAX_PREVIEW;
            const displayPrompt = promptNeedsTruncation && !showFullPrompt 
                ? prompt.substring(0, MAX_PREVIEW) + '...'
                : prompt;
            
            return (
                <div key={index} className={`tool-message tool-message--${layout} ${hasResult ? (resultIsError ? 'tool-message--error' : 'tool-message--success') : ''} ${isLoading ? 'tool-message--loading' : ''}`}>
                    <div 
                        className="tool-message__header"
                        onClick={toggleExpanded}
                    >
                        <div className="tool-message__main">
                            <span className="tool-icon">🔧</span>
                            <span className="tool-name">{toolName}</span>
                            {description && (
                                <span className="tool-description">{description}</span>
                            )}
                            {isLoading && (
                                <span className="tool-status tool-status--loading">
                                    <svg width="12" height="12" viewBox="0 0 24 24" className="loading-spinner">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.416" strokeDashoffset="31.416">
                                            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                                        </circle>
                                    </svg>
                                </span>
                            )}
                            {hasResult && !isLoading && (
                                <span className={`tool-status ${resultIsError ? 'tool-status--error' : 'tool-status--success'}`}>
                                    {resultIsError ? '❌' : '✅'}
                                </span>
                            )}
                        </div>
                        <button className={`tool-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                            </svg>
                        </button>
                    </div>
                    {isExpanded && (
                        <div className="tool-message__details">
                            {command && (
                                <div className="tool-detail">
                                    <span className="tool-detail__label">Command:</span>
                                    <code className="tool-detail__value">{command}</code>
                                </div>
                            )}
                            {Object.keys(toolInput).length > 0 && (
                                <div className="tool-detail">
                                    <span className="tool-detail__label">Input:</span>
                                    <div className="tool-detail__value tool-detail__value--result">
                                        <pre className="tool-result-content">
                                            {displayInput}
                                        </pre>
                                        {inputNeedsTruncation && (
                                            <button 
                                                className="tool-result__show-more"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleShowFullInput();
                                                }}
                                            >
                                                {showFullInput ? 'Show Less' : 'Show More'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {prompt && (
                                <div className="tool-detail">
                                    <span className="tool-detail__label">Prompt:</span>
                                    <div className="tool-detail__value tool-detail__value--result">
                                        <pre className="tool-result-content">
                                            {displayPrompt}
                                        </pre>
                                        {promptNeedsTruncation && (
                                            <button 
                                                className="tool-result__show-more"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleShowFullPrompt();
                                                }}
                                            >
                                                {showFullPrompt ? 'Show Less' : 'Show More'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {hasResult && (
                                <div className="tool-detail">
                                    <span className="tool-detail__label">
                                        {resultIsError ? 'Error Result:' : 'Result:'}
                                    </span>
                                    <div className={`tool-detail__value tool-detail__value--result ${resultIsError ? 'tool-detail__value--error' : ''}`}>
                                        <pre className="tool-result-content">
                                            {displayResult}
                                        </pre>
                                        {resultNeedsTruncation && (
                                            <button 
                                                className="tool-result__show-more"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleShowFullResult();
                                                }}
                                            >
                                                {showFullResult ? 'Show Less' : 'Show More'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        } catch (error) {
            console.error('Error rendering tool message:', error, msg);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return (
                <div key={index} className={`tool-message tool-message--${layout}`} style={{background: 'red', color: 'white', padding: '8px'}}>
                    Error rendering tool: {msg.metadata?.tool_name || 'Unknown'} - {errorMessage}
                </div>
            );
        }
    };

    const renderToolGroup = (msg: ChatMessage, index: number) => {
        try {
            const isExpanded = expandedTools[index] || false;
            const childTools = msg.metadata?.child_tools || [];
            const groupName = msg.metadata?.tool_name || 'Tool Group';
            const hasResults = childTools.some(tool => tool.metadata?.result_received);
            const hasErrors = childTools.some(tool => tool.metadata?.result_is_error);
            const isLoading = childTools.some(tool => tool.metadata?.is_loading);
            
            console.log('Rendering tool group:', { groupName, childCount: childTools.length, hasResults, isLoading });
            
            const toggleExpanded = () => {
                setExpandedTools(prev => ({
                    ...prev,
                    [index]: !prev[index]
                }));
            };
            
            return (
                <div key={index} className={`tool-group tool-group--${layout} ${hasResults ? (hasErrors ? 'tool-group--error' : 'tool-group--success') : ''} ${isLoading ? 'tool-group--loading' : ''}`}>
                    <div 
                        className="tool-group__header"
                        onClick={toggleExpanded}
                    >
                        <div className="tool-group__main">
                            <span className="tool-group-icon">📋</span>
                            <span className="tool-group-name">{groupName}</span>
                            <span className="tool-group-count">{childTools.length} steps</span>
                            {isLoading && (
                                <span className="tool-status tool-status--loading">
                                    <svg width="12" height="12" viewBox="0 0 24 24" className="loading-spinner">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.416" strokeDashoffset="31.416">
                                            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                                        </circle>
                                    </svg>
                                </span>
                            )}
                            {hasResults && !isLoading && (
                                <span className={`tool-status ${hasErrors ? 'tool-status--error' : 'tool-status--success'}`}>
                                    {hasErrors ? '❌' : '✅'}
                                </span>
                            )}
                        </div>
                        <button className={`tool-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                            </svg>
                        </button>
                    </div>
                    {isExpanded && (
                        <div className="tool-group__children">
                            {childTools.map((childTool, childIndex) => 
                                renderToolMessage(childTool, `${index}_${childIndex}` as any)
                            )}
                        </div>
                    )}
                </div>
            );
        } catch (error) {
            console.error('Error rendering tool group:', error, msg);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return (
                <div key={index} className={`tool-group tool-group--${layout}`} style={{background: 'red', color: 'white', padding: '8px'}}>
                    Error rendering tool group - {errorMessage}
                </div>
            );
        }
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