/**
 * Cache for decoded drawing image data
 * 
 * This cache stores ImageData extracted directly from canvas elements.
 * The data is cached by dataUrl so the custom operator can access it synchronously.
 */

export interface CachedImageData {
	data: Uint8ClampedArray;
	width: number;
	height: number;
}

const imageDataCache = new Map<string, CachedImageData>();

/**
 * Store ImageData for a given dataUrl
 */
export function cacheImageData(dataUrl: string, imageData: ImageData): void {
	imageDataCache.set(dataUrl, {
		data: imageData.data,
		width: imageData.width,
		height: imageData.height,
	});
}

/**
 * Retrieve cached ImageData for a given dataUrl
 */
export function getCachedImageData(dataUrl: string): CachedImageData | null {
	return imageDataCache.get(dataUrl) || null;
}

/**
 * Clear the cache (useful for testing or cleanup)
 */
export function clearImageDataCache(): void {
	imageDataCache.clear();
}

/**
 * Expose cache on window for DrawingCanvas component to access
 * This allows the default-components package to cache image data without direct dependency
 */
if (typeof window !== 'undefined') {
	(window as any).__drawingImageCache = {
		cacheImageData,
		getCachedImageData,
		clearImageDataCache,
	};
}
