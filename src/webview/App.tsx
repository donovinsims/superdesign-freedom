import React, { useState, useEffect } from 'react';
import ChatInterface from './components/Chat/ChatInterface';
import { WebviewContext } from '../types/context';

// Import CSS as string for esbuild
import styles from './App.css';

const App: React.FC = () => {
    const [vscode] = useState(() => acquireVsCodeApi());
    const [context, setContext] = useState<WebviewContext | null>(null);

    useEffect(() => {
        // Inject CSS styles
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);

        // Get context from window
        const webviewContext = (window as any).__WEBVIEW_CONTEXT__;
        if (webviewContext) {
            setContext(webviewContext);
        }

        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

    if (!context) {
        return <div>Loading...</div>;
    }

    return (
        <div className="superdesign-app">
            <ChatInterface 
                layout={context.layout}
                vscode={vscode}
            />
        </div>
    );
};

export default App;