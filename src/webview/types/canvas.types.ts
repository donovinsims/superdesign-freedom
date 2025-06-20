// Canvas view type definitions

export interface DesignFile {
    name: string;
    path: string;
    content: string;
    size: number;
    modified: Date;
}

export interface CanvasState {
    designFiles: DesignFile[];
    selectedFrames: string[];
    isLoading: boolean;
    error: string | null;
    zoom: number;
    pan: { x: number; y: number };
}

// Message types for communication between extension and webview
export interface ExtensionMessage {
    command: string;
    data?: any;
}

export interface LoadDesignFilesMessage extends ExtensionMessage {
    command: 'loadDesignFiles';
}

export interface DesignFilesLoadedMessage extends ExtensionMessage {
    command: 'designFilesLoaded';
    data: {
        files: DesignFile[];
    };
}

export interface SelectFrameMessage extends ExtensionMessage {
    command: 'selectFrame';
    data: {
        fileName: string;
    };
}

export interface ErrorMessage extends ExtensionMessage {
    command: 'error';
    data: {
        error: string;
    };
}

export interface FileWatchMessage extends ExtensionMessage {
    command: 'fileChanged';
    data: {
        fileName: string;
        changeType: 'created' | 'modified' | 'deleted';
    };
}

export type WebviewMessage = 
    | LoadDesignFilesMessage 
    | SelectFrameMessage;

export type ExtensionToWebviewMessage = 
    | DesignFilesLoadedMessage 
    | ErrorMessage 
    | FileWatchMessage;

// Canvas grid layout types
export interface GridPosition {
    x: number;
    y: number;
}

export interface FrameDimensions {
    width: number;
    height: number;
}

export type ViewportMode = 'desktop' | 'mobile' | 'tablet';

export interface ViewportConfig {
    desktop: FrameDimensions;
    mobile: FrameDimensions;
    tablet: FrameDimensions;
}

export interface FrameViewportState {
    [fileName: string]: ViewportMode;
}

export interface FramePositionState {
    [fileName: string]: GridPosition;
}

export interface DragState {
    isDragging: boolean;
    draggedFrame: string | null;
    startPosition: GridPosition;
    currentPosition: GridPosition;
    offset: GridPosition;
}

export interface CanvasConfig {
    frameSize: FrameDimensions;
    gridSpacing: number;
    framesPerRow: number;
    minZoom: number;
    maxZoom: number;
    // Responsive settings
    responsive: {
        enableScaling: boolean;
        minFrameSize: FrameDimensions;
        maxFrameSize: FrameDimensions;
        scaleWithZoom: boolean;
    };
    // Viewport configurations
    viewports: ViewportConfig;
} 