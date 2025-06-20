import React from 'react';
import { DesignFile, GridPosition, FrameDimensions } from '../types/canvas.types';

interface DesignFrameProps {
    file: DesignFile;
    position: GridPosition;
    dimensions: FrameDimensions;
    isSelected: boolean;
    onSelect: (fileName: string) => void;
    renderMode?: 'placeholder' | 'iframe' | 'html';
}

const DesignFrame: React.FC<DesignFrameProps> = ({
    file,
    position,
    dimensions,
    isSelected,
    onSelect,
    renderMode = 'placeholder'
}) => {
    const handleClick = () => {
        onSelect(file.name);
    };

    const renderContent = () => {
        switch (renderMode) {
            case 'iframe':
                // Will implement iframe rendering in Phase 4
                return (
                    <iframe
                        srcDoc={file.content}
                        title={file.name}
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            background: 'white'
                        }}
                        sandbox="allow-scripts allow-same-origin"
                    />
                );

            case 'html':
                // Will implement direct HTML rendering in Phase 4 (security considerations)
                return (
                    <div
                        dangerouslySetInnerHTML={{ __html: file.content }}
                        style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            background: 'white'
                        }}
                    />
                );

            case 'placeholder':
            default:
                return (
                    <div className="frame-placeholder">
                        <p>HTML Frame</p>
                        <p>{file.name}</p>
                        <p>{(file.size / 1024).toFixed(1)} KB</p>
                        <p>{file.modified.toLocaleDateString()}</p>
                        <small>{file.modified.toLocaleTimeString()}</small>
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
                <div className="frame-meta">
                    <span className="frame-size">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
            </div>
            <div className="frame-content">
                {renderContent()}
            </div>
        </div>
    );
};

export default DesignFrame; 