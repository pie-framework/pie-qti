/**
 * ZIP file extraction utility for QTI packages
 */

import { mkdir } from 'node:fs/promises';
import { extractZipToDirSafe } from '@pie-qti/qti2-to-pie/ims-cp';

export interface ExtractionResult {
  success: boolean;
  extractPath: string;
  fileCount: number;
  totalSize: number;
  error?: string;
}

export class ZipExtractor {
  /**
   * Extract a ZIP file to a target directory
   */
  async extract(zipPath: string, targetDir: string): Promise<ExtractionResult> {
    return this.extractSimple(zipPath, targetDir);
  }

  /**
   * Extract ZIP file with simplified approach
   * More reliable for complex ZIP structures
   */
  async extractSimple(zipPath: string, targetDir: string): Promise<ExtractionResult> {
    try {
      await mkdir(targetDir, { recursive: true });
      const { fileCount, totalSize } = await extractZipToDirSafe(zipPath, targetDir);

      return {
        success: true,
        extractPath: targetDir,
        fileCount,
        totalSize,
      };
    } catch (error) {
      console.error('ZIP extraction error:', error);
      return {
        success: false,
        extractPath: targetDir,
        fileCount: 0,
        totalSize: 0,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
      };
    }
  }
}

// Singleton instance
let zipExtractorInstance: ZipExtractor | null = null;

export function getZipExtractor(): ZipExtractor {
  if (!zipExtractorInstance) {
    zipExtractorInstance = new ZipExtractor();
  }
  return zipExtractorInstance;
}
