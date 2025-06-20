import React, { useState, useEffect } from 'react';
import DesignPanel from './components/DesignPanel';

// Import CSS as string for esbuild
import styles from './App.css';

const App: React.FC = () => {
    const [vscode] = useState(() => acquireVsCodeApi());

    useEffect(() => {
        // Inject CSS styles
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);

        // Listen for messages from the extension
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'updateDesign':
                    // Handle design updates
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
                <h1>🎨 Superdesign</h1>
                <p>Design System Manager for VS Code</p>
            </header>
            <DesignPanel vscode={vscode} />
        </div>
    );
};

export default App;