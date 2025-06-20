import React, { useState, useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import DesignFrame from './DesignFrame';
import { calculateGridPosition, calculateFitToView, getGridMetrics, generateResponsiveConfig } from '../utils/gridLayout';
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
    const [currentZoom, setCurrentZoom] = useState(1);
    const [currentConfig, setCurrentConfig] = useState<CanvasConfig>(CANVAS_CONFIG);
    const transformRef = useRef<ReactZoomPanPinchRef>(null);

    // Responsive config update
    useEffect(() => {
        const updateConfig = () => {
            const responsive = generateResponsiveConfig(CANVAS_CONFIG, window.innerWidth);
            setCurrentConfig(responsive);
        };

        updateConfig();
        window.addEventListener('resize', updateConfig);
        return () => window.removeEventListener('resize', updateConfig);
    }, []);

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

    // Canvas control functions
    const handleZoomIn = () => {
        if (transformRef.current) {
            transformRef.current.zoomIn(0.2);
        }
    };

    const handleZoomOut = () => {
        if (transformRef.current) {
            transformRef.current.zoomOut(0.2);
        }
    };

    const handleResetZoom = () => {
        if (transformRef.current) {
            transformRef.current.resetTransform();
        }
    };

    const handleFitToView = () => {
        if (transformRef.current && designFiles.length > 0) {
            const containerWidth = window.innerWidth - 100; // Account for controls
            const containerHeight = window.innerHeight - 150; // Account for controls and padding
            
            const { scale, x, y } = calculateFitToView(
                designFiles.length,
                currentConfig,
                containerWidth,
                containerHeight,
                50 // Padding
            );
            
            transformRef.current.setTransform(x, y, scale);
        }
    };

    const handleTransformChange = (ref: ReactZoomPanPinchRef) => {
        setCurrentZoom(ref.state.scale);
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
                <button className="control-btn" onClick={handleFitToView} title="Fit to View">
                    📐
                </button>
                <div className="zoom-indicator">
                    {Math.round(currentZoom * 100)}%
                </div>
                <div className="canvas-info">
                    {(() => {
                        const metrics = getGridMetrics(designFiles.length, currentConfig);
                        return `${metrics.totalFrames} files (${metrics.rows}×${metrics.cols}) | ${selectedFrames.length} selected`;
                    })()}
                </div>
            </div>

            {/* Infinite Canvas */}
            <TransformWrapper
                ref={transformRef}
                initialScale={1}
                minScale={currentConfig.minZoom}
                maxScale={currentConfig.maxZoom}
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
                onTransformed={(ref) => handleTransformChange(ref)}
            >
                <TransformComponent
                    wrapperClass="canvas-transform-wrapper"
                    contentClass="canvas-transform-content"
                >
                    <div className="canvas-grid">
                        {designFiles.map((file, index) => {
                            const position = calculateGridPosition(index, currentConfig);
                            
                            return (
                                <DesignFrame
                                    key={file.name}
                                    file={file}
                                    position={position}
                                    dimensions={currentConfig.frameSize}
                                    isSelected={selectedFrames.includes(file.name)}
                                    onSelect={handleFrameSelect}
                                    renderMode="placeholder" // Will change to 'iframe' in Phase 4
                                />
                            );
                        })}
                    </div>
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
};

export default CanvasView; 