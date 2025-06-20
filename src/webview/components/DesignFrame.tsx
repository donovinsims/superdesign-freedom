import React from 'react';
import { DesignFile, GridPosition, FrameDimensions, ViewportMode } from '../types/canvas.types';

interface DesignFrameProps {
    file: DesignFile;
    position: GridPosition;
    dimensions: FrameDimensions;
    isSelected: boolean;
    onSelect: (fileName: string) => void;
    renderMode?: 'placeholder' | 'iframe' | 'html';
    showMetadata?: boolean;
    viewport?: ViewportMode;
    viewportDimensions?: FrameDimensions;
    onViewportChange?: (fileName: string, viewport: ViewportMode) => void;
    useGlobalViewport?: boolean;
}

const DesignFrame: React.FC<DesignFrameProps> = ({
    file,
    position,
    dimensions,
    isSelected,
    onSelect,
    renderMode = 'placeholder',
    showMetadata = true,
    viewport = 'desktop',
    viewportDimensions,
    onViewportChange,
    useGlobalViewport = false
}) => {
    const [isLoading, setIsLoading] = React.useState(renderMode === 'iframe');
    const [hasError, setHasError] = React.useState(false);

    const handleClick = () => {
        onSelect(file.name);
    };

    const handleViewportToggle = (newViewport: ViewportMode) => {
        if (onViewportChange && !useGlobalViewport) {
            onViewportChange(file.name, newViewport);
        }
    };

    const getViewportIcon = (mode: ViewportMode): string => {
        switch (mode) {
            case 'mobile': return '📱';
            case 'tablet': return '📋';
            case 'desktop': return '🖥️';
            default: return '🖥️';
        }
    };

    const getViewportLabel = (mode: ViewportMode): string => {
        switch (mode) {
            case 'mobile': return 'Mobile';
            case 'tablet': return 'Tablet';
            case 'desktop': return 'Desktop';
            default: return 'Desktop';
        }
    };

    const renderContent = () => {
        switch (renderMode) {
            case 'iframe':
                // Inject viewport meta tag if we have viewport dimensions
                let modifiedContent = file.content;
                if (viewportDimensions) {
                    const viewportMeta = `<meta name="viewport" content="width=${viewportDimensions.width}, height=${viewportDimensions.height}, initial-scale=1.0">`;
                    if (modifiedContent.includes('<head>')) {
                        modifiedContent = modifiedContent.replace('<head>', `<head>\n${viewportMeta}`);
                    } else if (modifiedContent.includes('<html>')) {
                        modifiedContent = modifiedContent.replace('<html>', `<html><head>\n${viewportMeta}\n</head>`);
                    } else {
                        modifiedContent = `<head>\n${viewportMeta}\n</head>\n${modifiedContent}`;
                    }
                }

                return (
                    <iframe
                        srcDoc={modifiedContent}
                        title={`${file.name} - ${getViewportLabel(viewport)}`}
                        style={{
                            width: viewportDimensions ? `${viewportDimensions.width}px` : '100%',
                            height: viewportDimensions ? `${viewportDimensions.height}px` : '100%',
                            border: 'none',
                            background: 'white',
                            borderRadius: '0 0 6px 6px'
                        }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onLoad={() => {
                            setIsLoading(false);
                            setHasError(false);
                            console.log(`Frame loaded: ${file.name} (${viewport})`);
                        }}
                        onError={(e) => {
                            setIsLoading(false);
                            setHasError(true);
                            console.error(`Frame error for ${file.name}:`, e);
                        }}
                    />
                );

            case 'html':
                // Direct HTML rendering - USE WITH CAUTION (security risk)
                // Only use for trusted content or when iframe fails
                return (
                    <div
                        dangerouslySetInnerHTML={{ __html: file.content }}
                        style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            background: 'white',
                            border: '1px solid var(--vscode-errorForeground)',
                            borderRadius: '0 0 6px 6px'
                        }}
                        title="⚠️ Direct HTML rendering - potential security risk"
                    />
                );

            case 'placeholder':
            default:
                return (
                    <div className="frame-placeholder">
                        <div className="placeholder-icon">🌐</div>
                        <p className="placeholder-name">{file.name}</p>
                        <div className="placeholder-meta">
                            <span>{(file.size / 1024).toFixed(1)} KB</span>
                            <span>{file.modified.toLocaleDateString()}</span>
                        </div>
                        {renderMode === 'placeholder' && (
                            <small className="placeholder-hint">Zoom in to load content</small>
                        )}
                    </div>
                );
        }
    };

    return (
        <div
            className={`design-frame ${isSelected ? 'selected' : ''}`}
            style={{
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${dimensions.width}px`,
                height: `${dimensions.height}px`
            }}
            onClick={handleClick}
            title={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
        >
            <div className="frame-header">
                <span className="frame-title">{file.name}</span>
                
                {/* Viewport Controls */}
                {onViewportChange && !useGlobalViewport && (
                    <div className="frame-viewport-controls">
                        <button
                            className={`frame-viewport-btn ${viewport === 'mobile' ? 'active' : ''}`}
                            onClick={() => handleViewportToggle('mobile')}
                            title="Mobile View"
                        >
                            📱
                        </button>
                        <button
                            className={`frame-viewport-btn ${viewport === 'tablet' ? 'active' : ''}`}
                            onClick={() => handleViewportToggle('tablet')}
                            title="Tablet View"
                        >
                            📋
                        </button>
                        <button
                            className={`frame-viewport-btn ${viewport === 'desktop' ? 'active' : ''}`}
                            onClick={() => handleViewportToggle('desktop')}
                            title="Desktop View"
                        >
                            🖥️
                        </button>
                    </div>
                )}
                
                {/* Global viewport indicator */}
                {useGlobalViewport && (
                    <div className="frame-viewport-indicator">
                        <span className="global-indicator">🌐</span>
                        <span className="viewport-icon">{getViewportIcon(viewport)}</span>
                    </div>
                )}
                
                {showMetadata && (
                    <div className="frame-meta">
                        <span className="frame-size">{(file.size / 1024).toFixed(1)} KB</span>
                        {viewportDimensions && (
                            <span className="frame-dimensions">
                                {viewportDimensions.width}×{viewportDimensions.height}
                            </span>
                        )}
                        {isLoading && <span className="frame-status loading">●</span>}
                        {hasError && <span className="frame-status error">●</span>}
                        {!isLoading && !hasError && renderMode === 'iframe' && (
                            <span className="frame-status loaded">●</span>
                        )}
                    </div>
                )}
            </div>
            <div className="frame-content">
                {renderContent()}
                
                {/* Loading overlay for iframe */}
                {isLoading && renderMode === 'iframe' && (
                    <div className="frame-loading-overlay">
                        <div className="frame-loading-spinner">
                            <div className="spinner-small"></div>
                            <span>Loading...</span>
                        </div>
                    </div>
                )}
                
                {/* Error overlay */}
                {hasError && (
                    <div className="frame-error-overlay">
                        <div className="frame-error-content">
                            <span>⚠️</span>
                            <p>Failed to load</p>
                            <small>{file.name}</small>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesignFrame; 