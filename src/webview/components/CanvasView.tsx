import React, { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { 
    DesignFile, 
    CanvasState, 
    WebviewMessage, 
    ExtensionToWebviewMessage,
    CanvasConfig
} from '../types/canvas.types';

interface CanvasViewProps {
    vscode: any;
}

const CANVAS_CONFIG: CanvasConfig = {
    frameSize: { width: 300, height: 400 },
    gridSpacing: 100,
    framesPerRow: 3,
    minZoom: 0.1,
    maxZoom: 5
};

const CanvasView: React.FC<CanvasViewProps> = ({ vscode }) => {
    const [designFiles, setDesignFiles] = useState<DesignFile[]>([]);
    const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Request design files from extension
        const loadMessage: WebviewMessage = {
            command: 'loadDesignFiles'
        };
        vscode.postMessage(loadMessage);

        // Listen for messages from extension
        const messageHandler = (event: MessageEvent) => {
            const message: ExtensionToWebviewMessage = event.data;
            
            switch (message.command) {
                case 'designFilesLoaded':
                    // Convert date strings back to Date objects
                    const filesWithDates = message.data.files.map(file => ({
                        ...file,
                        modified: new Date(file.modified)
                    }));
                    setDesignFiles(filesWithDates);
                    setIsLoading(false);
                    break;
                    
                case 'error':
                    setError(message.data.error);
                    setIsLoading(false);
                    break;

                case 'fileChanged':
                    // Handle file system changes (will implement in Task 2.3)
                    console.log('File changed:', message.data);
                    // Re-request files when changes occur
                    vscode.postMessage({ command: 'loadDesignFiles' });
                    break;
            }
        };

        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, [vscode]);

    const handleFrameSelect = (fileName: string) => {
        setSelectedFrames([fileName]); // Single selection for now
        
        const selectMessage: WebviewMessage = {
            command: 'selectFrame',
            data: { fileName }
        };
        vscode.postMessage(selectMessage);
    };

    const handleZoomIn = () => {
        // Will be implemented with TransformWrapper controls
    };

    const handleZoomOut = () => {
        // Will be implemented with TransformWrapper controls
    };

    const handleResetZoom = () => {
        // Will be implemented with TransformWrapper controls
    };

    if (isLoading) {
        return (
            <div className="canvas-loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading design files...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="canvas-error">
                <div className="error-message">
                    <h3>Error loading canvas</h3>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (designFiles.length === 0) {
        return (
            <div className="canvas-empty">
                <div className="empty-state">
                    <h3>No design files found</h3>
                    <p>Create HTML files in <code>.superdesign/design_files/</code> to get started</p>
                </div>
            </div>
        );
    }

    return (
        <div className="canvas-container">
            {/* Canvas Controls */}
            <div className="canvas-controls">
                <button className="control-btn" onClick={handleZoomIn} title="Zoom In">
                    🔍+
                </button>
                <button className="control-btn" onClick={handleZoomOut} title="Zoom Out">
                    🔍-
                </button>
                <button className="control-btn" onClick={handleResetZoom} title="Reset Zoom">
                    ⌂
                </button>
                <div className="canvas-info">
                    {designFiles.length} files | {selectedFrames.length} selected
                </div>
            </div>

            {/* Infinite Canvas */}
            <TransformWrapper
                initialScale={1}
                minScale={CANVAS_CONFIG.minZoom}
                maxScale={CANVAS_CONFIG.maxZoom}
                limitToBounds={false}
                doubleClick={{
                    disabled: false,
                    mode: "zoomIn"
                }}
                wheel={{
                    step: 0.1,
                    wheelDisabled: false
                }}
                centerOnInit={true}
            >
                <TransformComponent
                    wrapperClass="canvas-transform-wrapper"
                    contentClass="canvas-transform-content"
                >
                    <div className="canvas-grid">
                        {designFiles.map((file, index) => {
                            // Grid layout using config
                            const row = Math.floor(index / CANVAS_CONFIG.framesPerRow);
                            const col = index % CANVAS_CONFIG.framesPerRow;
                            const gridX = col * (CANVAS_CONFIG.frameSize.width + CANVAS_CONFIG.gridSpacing);
                            const gridY = row * (CANVAS_CONFIG.frameSize.height + CANVAS_CONFIG.gridSpacing);
                            
                            return (
                                <div
                                    key={file.name}
                                    className={`design-frame ${
                                        selectedFrames.includes(file.name) ? 'selected' : ''
                                    }`}
                                    style={{
                                        position: 'absolute',
                                        left: `${gridX}px`,
                                        top: `${gridY}px`,
                                        width: `${CANVAS_CONFIG.frameSize.width}px`,
                                        height: `${CANVAS_CONFIG.frameSize.height}px`
                                    }}
                                    onClick={() => handleFrameSelect(file.name)}
                                >
                                    <div className="frame-header">
                                        <span className="frame-title">{file.name}</span>
                                    </div>
                                    <div className="frame-content">
                                        {/* Placeholder - will implement HTML rendering in Phase 4 */}
                                        <div className="frame-placeholder">
                                            <p>HTML Frame</p>
                                            <p>{file.name}</p>
                                            <p>{(file.size / 1024).toFixed(1)} KB</p>
                                            <p>{file.modified.toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
};

export default CanvasView; 