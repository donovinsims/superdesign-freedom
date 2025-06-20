import React, { useState, useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import DesignFrame from './DesignFrame';
import { calculateGridPosition, calculateFitToView, getGridMetrics, generateResponsiveConfig } from '../utils/gridLayout';
import { 
    DesignFile, 
    CanvasState, 
    WebviewMessage, 
    ExtensionToWebviewMessage,
    CanvasConfig,
    ViewportMode,
    FrameViewportState
} from '../types/canvas.types';

interface CanvasViewProps {
    vscode: any;
}

const CANVAS_CONFIG: CanvasConfig = {
    frameSize: { width: 400, height: 500 }, // Default frame size for grid spacing calculations
    gridSpacing: 150,
    framesPerRow: 3,
    minZoom: 0.1,
    maxZoom: 5,
    responsive: {
        enableScaling: true,
        minFrameSize: { width: 200, height: 250 },
        maxFrameSize: { width: 500, height: 650 },
        scaleWithZoom: false
    },
    viewports: {
        desktop: { width: 1200, height: 800 },
        tablet: { width: 768, height: 1024 },
        mobile: { width: 375, height: 667 }
    }
};

const CanvasView: React.FC<CanvasViewProps> = ({ vscode }) => {
    const [designFiles, setDesignFiles] = useState<DesignFile[]>([]);
    const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentZoom, setCurrentZoom] = useState(1);
    const [currentConfig, setCurrentConfig] = useState<CanvasConfig>(CANVAS_CONFIG);
    const [globalViewportMode, setGlobalViewportMode] = useState<ViewportMode>('desktop');
    const [frameViewports, setFrameViewports] = useState<FrameViewportState>({});
    const [useGlobalViewport, setUseGlobalViewport] = useState(false);
    const transformRef = useRef<ReactZoomPanPinchRef>(null);

    // Performance optimization: Switch render modes based on zoom level
    const getOptimalRenderMode = (zoom: number): 'placeholder' | 'iframe' => {
        // Use placeholder for very zoomed out views for better performance
        return zoom < 0.5 ? 'placeholder' : 'iframe';
    };

    // Viewport management functions
    const getFrameViewport = (fileName: string): ViewportMode => {
        if (useGlobalViewport) {
            return globalViewportMode;
        }
        return frameViewports[fileName] || 'desktop';
    };

    const handleFrameViewportChange = (fileName: string, viewport: ViewportMode) => {
        setFrameViewports(prev => ({
            ...prev,
            [fileName]: viewport
        }));
    };

    const handleGlobalViewportChange = (viewport: ViewportMode) => {
        setGlobalViewportMode(viewport);
        if (useGlobalViewport) {
            // Update all frames to the new global viewport
            const newFrameViewports: FrameViewportState = {};
            designFiles.forEach(file => {
                newFrameViewports[file.name] = viewport;
            });
            setFrameViewports(newFrameViewports);
        }
    };

    const toggleGlobalViewport = () => {
        const newUseGlobal = !useGlobalViewport;
        setUseGlobalViewport(newUseGlobal);
        
        if (newUseGlobal) {
            // Set all frames to current global viewport
            const newFrameViewports: FrameViewportState = {};
            designFiles.forEach(file => {
                newFrameViewports[file.name] = globalViewportMode;
            });
            setFrameViewports(newFrameViewports);
        }
    };

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
                
                <div className="viewport-divider"></div>
                
                {/* Global Viewport Controls */}
                <button 
                    className={`control-btn viewport-toggle ${useGlobalViewport ? 'active' : ''}`}
                    onClick={toggleGlobalViewport}
                    title="Toggle Global Viewport Mode"
                >
                    🌐
                </button>
                
                <div className="viewport-controls">
                    <button 
                        className={`viewport-btn ${globalViewportMode === 'mobile' ? 'active' : ''}`}
                        onClick={() => handleGlobalViewportChange('mobile')}
                        title="Mobile View (375×667)"
                    >
                        📱
                    </button>
                    <button 
                        className={`viewport-btn ${globalViewportMode === 'tablet' ? 'active' : ''}`}
                        onClick={() => handleGlobalViewportChange('tablet')}
                        title="Tablet View (768×1024)"
                    >
                        📋
                    </button>
                    <button 
                        className={`viewport-btn ${globalViewportMode === 'desktop' ? 'active' : ''}`}
                        onClick={() => handleGlobalViewportChange('desktop')}
                        title="Desktop View (1200×800)"
                    >
                        🖥️
                    </button>
                </div>
                
                <div className="zoom-indicator">
                    {Math.round(currentZoom * 100)}%
                </div>
                <div className="canvas-info">
                    {(() => {
                        const metrics = getGridMetrics(designFiles.length, currentConfig);
                        const renderMode = getOptimalRenderMode(currentZoom);
                        const renderIcon = renderMode === 'iframe' ? '🖼️' : '📄';
                        return `${metrics.totalFrames} files (${metrics.rows}×${metrics.cols}) | ${selectedFrames.length} selected | ${renderIcon}`;
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
                            const frameViewport = getFrameViewport(file.name);
                            const viewportDimensions = currentConfig.viewports[frameViewport];
                            
                            // Use actual viewport dimensions (add frame border/header space)
                            const actualWidth = viewportDimensions.width;
                            const actualHeight = viewportDimensions.height + 50; // Add space for header
                            
                            // Calculate position based on actual frame sizes
                            const col = index % currentConfig.framesPerRow;
                            const row = Math.floor(index / currentConfig.framesPerRow);
                            
                            const x = col * (Math.max(actualWidth, currentConfig.frameSize.width) + currentConfig.gridSpacing);
                            const y = row * (Math.max(actualHeight, currentConfig.frameSize.height) + currentConfig.gridSpacing);
                            
                            return (
                                <DesignFrame
                                    key={file.name}
                                    file={file}
                                    position={{ x, y }}
                                    dimensions={{ width: actualWidth, height: actualHeight }}
                                    isSelected={selectedFrames.includes(file.name)}
                                    onSelect={handleFrameSelect}
                                    renderMode={getOptimalRenderMode(currentZoom)}
                                    viewport={frameViewport}
                                    viewportDimensions={viewportDimensions}
                                    onViewportChange={handleFrameViewportChange}
                                    useGlobalViewport={useGlobalViewport}
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