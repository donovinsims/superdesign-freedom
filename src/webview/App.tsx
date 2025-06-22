import React, { useState, useEffect } from 'react';
import ChatPanel from './components/DesignPanel';

// Import CSS as string for esbuild
import styles from './App.css';

const App: React.FC = () => {
    const [vscode] = useState(() => acquireVsCodeApi());
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'assistant', message: string}>>([]);

    useEffect(() => {
        // Inject CSS styles
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);

        // Listen for messages from the extension
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'chatResponse':
                    setChatHistory(prev => [...prev, {
                        type: 'assistant',
                        message: message.response
                    }]);
                    setIsLoading(false);
                    break;
            }
        };

        window.addEventListener('message', messageHandler);

        return () => {
            document.head.removeChild(styleElement);
            window.removeEventListener('message', messageHandler);
        };
    }, []);

    return (
        <div className="superdesign-app">
            <header className="app-header">
                <h1>🤖 Superdesign Chat</h1>
                <p>AI-Powered Development Assistant</p>
            </header>
            <ChatPanel 
                vscode={vscode} 
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                chatHistory={chatHistory}
                setChatHistory={setChatHistory}
            />
        </div>
    );
};

export default App;