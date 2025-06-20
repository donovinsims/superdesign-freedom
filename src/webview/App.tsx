import React, { useState, useEffect } from 'react';
import DesignPanel from './components/DesignPanel';
import CanvasView from './components/CanvasView';

// Import CSS as string for esbuild
import styles from './App.css';

const App: React.FC = () => {
    const [vscode] = useState(() => acquireVsCodeApi());
    const [currentView, setCurrentView] = useState<'design' | 'canvas'>('design');

    useEffect(() => {
        // Detect which view to render based on data-view attribute
        const rootElement = document.getElementById('root');
        const viewType = rootElement?.getAttribute('data-view');
        
        if (viewType === 'canvas') {
            setCurrentView('canvas');
        } else {
            setCurrentView('design');
        }

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

    const renderView = () => {
        switch (currentView) {
            case 'canvas':
                return <CanvasView vscode={vscode} />;
            case 'design':
            default:
                return (
                    <>
                        <header className="app-header">
                            <h1>🎨 Superdesign</h1>
                            <p>Design System Manager for VS Code</p>
                        </header>
                        <DesignPanel vscode={vscode} />
                    </>
                );
        }
    };

    return (
        <div className={`superdesign-app ${currentView}-view`}>
            {renderView()}
        </div>
    );
};

export default App;