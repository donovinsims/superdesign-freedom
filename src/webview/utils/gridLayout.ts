import { GridPosition, FrameDimensions, CanvasConfig } from '../types/canvas.types';

/**
 * Calculate grid position for a frame based on its index
 */
export function calculateGridPosition(
    index: number, 
    config: CanvasConfig
): GridPosition {
    const row = Math.floor(index / config.framesPerRow);
    const col = index % config.framesPerRow;
    
    const x = col * (config.frameSize.width + config.gridSpacing);
    const y = row * (config.frameSize.height + config.gridSpacing);
    
    return { x, y };
}

/**
 * Calculate total canvas bounds based on number of items
 */
export function calculateCanvasBounds(
    itemCount: number,
    config: CanvasConfig
): { width: number; height: number } {
    if (itemCount === 0) {
        return { width: 0, height: 0 };
    }
    
    const rows = Math.ceil(itemCount / config.framesPerRow);
    const cols = Math.min(itemCount, config.framesPerRow);
    
    const width = cols * config.frameSize.width + (cols - 1) * config.gridSpacing;
    const height = rows * config.frameSize.height + (rows - 1) * config.gridSpacing;
    
    return { width, height };
}

/**
 * Calculate optimal fit-to-view scale and position
 */
export function calculateFitToView(
    itemCount: number,
    config: CanvasConfig,
    containerWidth: number,
    containerHeight: number,
    padding: number = 50
): { scale: number; x: number; y: number } {
    if (itemCount === 0) {
        return { scale: 1, x: 0, y: 0 };
    }
    
    const bounds = calculateCanvasBounds(itemCount, config);
    
    // Available space after padding
    const availableWidth = containerWidth - 2 * padding;
    const availableHeight = containerHeight - 2 * padding;
    
    // Calculate scale to fit
    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%
    
    // Calculate centering position
    const scaledWidth = bounds.width * scale;
    const scaledHeight = bounds.height * scale;
    
    const x = (containerWidth - scaledWidth) / 2;
    const y = (containerHeight - scaledHeight) / 2;
    
    return { scale, x, y };
}

/**
 * Find the nearest frame to a given position
 */
export function findNearestFrame(
    targetPosition: GridPosition,
    itemCount: number,
    config: CanvasConfig
): number | null {
    if (itemCount === 0) {
        return null;
    }
    
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < itemCount; i++) {
        const framePos = calculateGridPosition(i, config);
        const distance = Math.sqrt(
            Math.pow(framePos.x - targetPosition.x, 2) + 
            Math.pow(framePos.y - targetPosition.y, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
        }
    }
    
    return nearestIndex;
}

/**
 * Generate layout configurations for different screen sizes
 */
export function generateResponsiveConfig(
    baseConfig: CanvasConfig,
    containerWidth: number
): CanvasConfig {
    // Adjust frames per row based on container width
    let framesPerRow = baseConfig.framesPerRow;
    
    if (containerWidth < 800) {
        framesPerRow = 1;
    } else if (containerWidth < 1200) {
        framesPerRow = 2;
    } else if (containerWidth < 1600) {
        framesPerRow = 3;
    } else {
        framesPerRow = 4;
    }
    
    return {
        ...baseConfig,
        framesPerRow
    };
}

/**
 * Calculate grid metrics for display
 */
export function getGridMetrics(
    itemCount: number,
    config: CanvasConfig
): {
    rows: number;
    cols: number;
    totalFrames: number;
    bounds: { width: number; height: number };
} {
    const rows = Math.ceil(itemCount / config.framesPerRow);
    const cols = Math.min(itemCount, config.framesPerRow);
    const bounds = calculateCanvasBounds(itemCount, config);
    
    return {
        rows,
        cols,
        totalFrames: itemCount,
        bounds
    };
} 