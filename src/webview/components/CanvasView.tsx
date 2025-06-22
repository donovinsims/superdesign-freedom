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
    FrameViewportState,
    FramePositionState,
    DragState,
    GridPosition
} from '../types/canvas.types';
import {
    ZoomInIcon,
    ZoomOutIcon,
    HomeIcon,
    ScaleIcon,
    RefreshIcon,
    GlobeIcon,
    MobileIcon,
    TabletIcon,
    DesktopIcon
} from './Icons';

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
    const [customPositions, setCustomPositions] = useState<FramePositionState>({});
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        draggedFrame: null,
        startPosition: { x: 0, y: 0 },
        currentPosition: { x: 0, y: 0 },
        offset: { x: 0, y: 0 }
    });
    const transformRef = useRef<ReactZoomPanPinchRef>(null);

    // Performance optimization: Switch render modes based on zoom level
    const getOptimalRenderMode = (_zoom: number): 'placeholder' | 'iframe' => {
        // Always render iframe as requested by the user
        return 'iframe';
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

    const handleTransformChange = (ref: ReactZoomPanPinchRef) => {
        setCurrentZoom(ref.state.scale);
    };

    // Get frame position (custom or default grid position)
    const getFramePosition = (fileName: string, index: number): GridPosition => {
        if (customPositions[fileName]) {
            return customPositions[fileName];
        }
        
        // Default grid position calculation
        const viewportMode = getFrameViewport(fileName);
        const viewportDimensions = currentConfig.viewports[viewportMode];
        const actualWidth = viewportDimensions.width;
        const actualHeight = viewportDimensions.height + 50;
        
        const col = index % currentConfig.framesPerRow;
        const row = Math.floor(index / currentConfig.framesPerRow);
        
        const x = col * (Math.max(actualWidth, currentConfig.frameSize.width) + currentConfig.gridSpacing);
        const y = row * (Math.max(actualHeight, currentConfig.frameSize.height) + currentConfig.gridSpacing);
        
        return { x, y };
    };

    // Drag handlers
    const handleDragStart = (fileName: string, startPos: GridPosition, mouseEvent: React.MouseEvent) => {
        // Get canvas grid element for proper coordinate calculation
        const canvasGrid = document.querySelector('.canvas-grid') as HTMLElement;
        if (!canvasGrid) return;
        
        const canvasRect = canvasGrid.getBoundingClientRect();
        const canvasMousePos = {
            x: mouseEvent.clientX - canvasRect.left,
            y: mouseEvent.clientY - canvasRect.top
        };
        
        // Also ensure this frame is selected
        if (!selectedFrames.includes(fileName)) {
            setSelectedFrames([fileName]);
        }
        
        setDragState({
            isDragging: true,
            draggedFrame: fileName,
            startPosition: startPos,
            currentPosition: startPos,
            offset: {
                x: canvasMousePos.x - startPos.x,
                y: canvasMousePos.y - startPos.y
            }
        });
    };

    const handleDragMove = (mousePos: GridPosition) => {
        if (!dragState.isDragging || !dragState.draggedFrame) return;
        
        const newPosition = {
            x: mousePos.x - dragState.offset.x,
            y: mousePos.y - dragState.offset.y
        };
        
        setDragState(prev => ({
            ...prev,
            currentPosition: newPosition
        }));
    };

    const handleDragEnd = () => {
        if (!dragState.isDragging || !dragState.draggedFrame) return;
        
        // Snap to grid (optional - makes positioning cleaner)
        const gridSize = 25;
        const snappedPosition = {
            x: Math.round(dragState.currentPosition.x / gridSize) * gridSize,
            y: Math.round(dragState.currentPosition.y / gridSize) * gridSize
        };
        
        // Save the new position
        setCustomPositions(prev => ({
            ...prev,
            [dragState.draggedFrame!]: snappedPosition
        }));
        
        // Reset drag state
        setDragState({
            isDragging: false,
            draggedFrame: null,
            startPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 },
            offset: { x: 0, y: 0 }
        });
    };

    // Reset positions to grid
    const handleResetPositions = () => {
        setCustomPositions({});
    };

    // Keyboard shortcuts for zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                switch (e.key) {
                    case '=':
                    case '+':
                        e.preventDefault();
                        handleZoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        handleZoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        handleResetZoom();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);



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
                    <p>Create HTML files in <code>.superdesign/ui_iterations/</code> to get started</p>
                </div>
            </div>
        );
    }

    return (
        <div className="canvas-container">
            {/* Canvas Controls */}
            <div className="canvas-controls">
                <div className="control-group">
                    <button className="control-btn" onClick={handleZoomIn} title="Zoom In (Cmd/Ctrl + +)">
                        <ZoomInIcon />
                    </button>
                    <button className="control-btn" onClick={handleZoomOut} title="Zoom Out (Cmd/Ctrl + -)">
                        <ZoomOutIcon />
                    </button>
                    <div className="zoom-indicator">
                        {Math.round(currentZoom * 100)}%
                    </div>
                </div>

                <div className="viewport-divider"></div>
                
                <div className="control-group">
                    <button className="control-btn" onClick={handleResetZoom} title="Reset Zoom (Cmd/Ctrl + 0)">
                        <HomeIcon />
                    </button>
                    <button className="control-btn" onClick={handleResetPositions} title="Reset Frame Positions">
                        <RefreshIcon />
                    </button>
                </div>

                <div className="viewport-divider"></div>
                
                {/* Global Viewport Controls */}
                <div className="control-group">
                    <button 
                        className={`control-btn viewport-toggle ${useGlobalViewport ? 'active' : ''}`}
                        onClick={toggleGlobalViewport}
                        title="Toggle Global Viewport Mode"
                    >
                        <GlobeIcon />
                    </button>
                    <div className="viewport-controls">
                        <button 
                            className={`control-btn viewport-btn ${globalViewportMode === 'mobile' && useGlobalViewport ? 'active' : ''}`}
                            onClick={() => handleGlobalViewportChange('mobile')}
                            title="Mobile View (375×667)"
                            disabled={!useGlobalViewport}
                        >
                            <MobileIcon />
                        </button>
                        <button 
                            className={`control-btn viewport-btn ${globalViewportMode === 'tablet' && useGlobalViewport ? 'active' : ''}`}
                            onClick={() => handleGlobalViewportChange('tablet')}
                            title="Tablet View (768×1024)"
                            disabled={!useGlobalViewport}
                        >
                            <TabletIcon />
                        </button>
                        <button 
                            className={`control-btn viewport-btn ${globalViewportMode === 'desktop' && useGlobalViewport ? 'active' : ''}`}
                            onClick={() => handleGlobalViewportChange('desktop')}
                            title="Desktop View (1200×800)"
                            disabled={!useGlobalViewport}
                        >
                            <DesktopIcon />
                        </button>
                    </div>
                </div>
            </div>

            {/* Infinite Canvas */}
            <TransformWrapper
                ref={transformRef}
                initialScale={1}
                minScale={0.2}                  // Reasonable min scale
                maxScale={2}                    // Reasonable max scale  
                limitToBounds={false}
                smooth={true}                   // Re-enable smoothing but keep it snappy
                doubleClick={{
                    disabled: false,
                    mode: "zoomIn",
                    step: 50                    // Moderate double-click zoom step
                }}
                wheel={{
                    wheelDisabled: true,        // Disable wheel zoom
                    touchPadDisabled: false,    // Enable trackpad pan
                    step: 0.3                   // Back to reasonable zoom button step
                }}
                panning={{
                    disabled: dragState.isDragging,
                    velocityDisabled: false,    // Enable smooth momentum
                    wheelPanning: true          // Enable trackpad panning
                }}
                pinch={{
                    disabled: false             // Keep pinch zoom enabled
                }}
                centerOnInit={true}
                onTransformed={(ref) => handleTransformChange(ref)}
            >
                <TransformComponent
                    wrapperClass="canvas-transform-wrapper"
                    contentClass="canvas-transform-content"
                >
                    <div 
                        className={`canvas-grid ${dragState.isDragging ? 'dragging' : ''}`}
                        onMouseMove={(e) => {
                            if (dragState.isDragging) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const mousePos = {
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top
                                };
                                handleDragMove(mousePos);
                            }
                        }}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onClick={(e) => {
                            // Clear selection when clicking on empty space
                            if (e.target === e.currentTarget) {
                                setSelectedFrames([]);
                            }
                        }}
                    >
                        {designFiles.map((file, index) => {
                            const frameViewport = getFrameViewport(file.name);
                            const viewportDimensions = currentConfig.viewports[frameViewport];
                            
                            // Use actual viewport dimensions (add frame border/header space)
                            const actualWidth = viewportDimensions.width;
                            const actualHeight = viewportDimensions.height + 50; // Add space for header
                            
                            // Get position (custom or default grid)
                            const position = getFramePosition(file.name, index);
                            
                            // If this frame is being dragged, use current drag position
                            const finalPosition = dragState.isDragging && dragState.draggedFrame === file.name 
                                ? dragState.currentPosition 
                                : position;
                            
                            return (
                                <DesignFrame
                                    key={file.name}
                                    file={file}
                                    position={finalPosition}
                                    dimensions={{ width: actualWidth, height: actualHeight }}
                                    isSelected={selectedFrames.includes(file.name)}
                                    onSelect={handleFrameSelect}
                                    renderMode={getOptimalRenderMode(currentZoom)}
                                    viewport={frameViewport}
                                    viewportDimensions={viewportDimensions}
                                    onViewportChange={handleFrameViewportChange}
                                    useGlobalViewport={useGlobalViewport}
                                    onDragStart={handleDragStart}
                                    isDragging={dragState.isDragging && dragState.draggedFrame === file.name}
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