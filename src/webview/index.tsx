import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatInterface from './components/Chat/ChatInterface';
import { WebviewContext } from '../types/context';

// Import main App styles for panel layout
import App from './App';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    
    // Get context from window (set by the HTML template)
    const context: WebviewContext = (window as any).__WEBVIEW_CONTEXT__;
    
    if (!context) {
        root.render(<div>Error: No context provided</div>);
    } else if (context.layout === 'panel') {
        // Use full App component for panel (includes header and styling)
        root.render(<App />);
    } else {
        // Use ChatInterface directly for sidebar (compact layout)
        const vscode = acquireVsCodeApi();
        root.render(<ChatInterface layout="sidebar" vscode={vscode} />);
    }
}