/**
 * Session analysis endpoint
 * Analyzes QTI packages in a session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import { getQtiAnalyzer } from '$lib/server/analyzer/QtiAnalyzer';
import { getStorage } from '$lib/server/storage/FileStorage';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
  const { id } = params;

  try {
    const storage = getStorage();
    const sessionManager = getSessionManager();
    const analyzer = getQtiAnalyzer();

    // Get session
    const session = await sessionManager.getSession(id);
    if (!session) {
      throw svelteError(404, 'Session not found');
    }

    // Check if already analyzed
    if (session.analysis) {
      return json({
        success: true,
        message: 'Session already analyzed',
        analysis: session.analysis,
      });
    }

    // Update status to analyzing
    await sessionManager.updateStatus(id, 'analyzing');

    // Extract ZIP files first if there are any
    const extractResult = await storage.extractZipPackages(id);
    if (!extractResult.success) {
      await sessionManager.updateStatus(id, 'error');
      throw svelteError(500, extractResult.error || 'Failed to extract ZIP files');
    }

    // Analyze the packages
    const extractedPath = storage.getExtractedPath(id);
    const analysisResult = await analyzer.analyzeSession(id, extractedPath, (progress) => {
      // Future enhancement: Emit progress updates via Server-Sent Events (SSE)
      // Would require: 1) SSE endpoint (GET /api/sessions/[id]/progress)
      //                2) Progress storage (Redis or in-memory)
      //                3) Client-side EventSource connection
      console.log('Analysis progress:', progress);
    });

    // Save analysis results
    await storage.saveAnalysis(id, analysisResult as any);

    return json({
      success: true,
      message: 'Analysis complete',
      analysis: analysisResult,
    });
  } catch (err) {
    console.error('Analysis error:', err);

    // Update session status to error
    try {
      const sessionManager = getSessionManager();
      await sessionManager.updateStatus(id, 'error');
    } catch (updateError) {
      console.error('Failed to update session status:', updateError);
    }

    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    throw svelteError(500, err instanceof Error ? err.message : 'Analysis failed');
  }
};
