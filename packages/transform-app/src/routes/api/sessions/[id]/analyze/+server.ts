/**
 * Session analysis endpoint
 * Analyzes QTI packages in a session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import { StorageZipExtractor } from '@pie-qti/storage';
import { getQtiAnalyzer } from '$lib/server/analyzer/QtiAnalyzer';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	try {
		const { storage, sessionStorage, appSessionStorage } = locals;
		const analyzer = getQtiAnalyzer();

		// Get session
		const session = await sessionStorage.readSessionMetadata(id);
		if (!session) {
			throw svelteError(404, 'Session not found');
		}

		// Check if already analyzed
		if (session.status === 'ready' && session.extractedFiles) {
			return json({
				success: true,
				message: 'Session already analyzed',
				extractedFiles: session.extractedFiles,
			});
		}

		// Update status to extracting
		session.status = 'extracting';
		session.lastAccessedAt = new Date().toISOString();
		await sessionStorage.writeSessionMetadata(id, session);

		// Extract ZIP files first if there are any
		const uploadsPath = sessionStorage.getUploadsPath(id);
		const extractedPath = sessionStorage.getExtractedPath(id);

		// List uploaded files
		const uploadedFiles = await storage.listFiles(uploadsPath);
		const zipFiles = uploadedFiles.filter(
			(f) => f.endsWith('.zip') || f.endsWith('.ZIP'),
		);

		if (zipFiles.length === 0) {
			throw svelteError(400, 'No ZIP files found in session');
		}

		// Extract each ZIP file
		const extractor = new StorageZipExtractor();
		const allExtractedFiles: string[] = [];

		for (const zipFile of zipFiles) {
			const zipPath = `${uploadsPath}/${zipFile}`;
			const result = await extractor.extract(zipPath, extractedPath, storage);

			if (!result.success) {
				throw new Error(`Failed to extract ${zipFile}`);
			}

			allExtractedFiles.push(...result.files);
		}

		// Update session with extracted files
		session.status = 'ready';
		session.extractedFiles = allExtractedFiles;
		session.lastAccessedAt = new Date().toISOString();
		await sessionStorage.writeSessionMetadata(id, session);

		// Analyze the packages
		const webAnalysisResult = await analyzer.analyzeSession(
			id,
			extractedPath,
			(progress) => {
				// Future enhancement: Emit progress updates via Server-Sent Events (SSE)
				console.log('Analysis progress:', progress);
			},
		);

		// Convert Map to Record for storage
		const analysisResult = {
			...webAnalysisResult,
			allInteractionTypes: Object.fromEntries(webAnalysisResult.allInteractionTypes),
		};

		// Save analysis results
		await appSessionStorage.saveAnalysis(id, analysisResult);

		return json({
			success: true,
			message: 'Analysis complete',
			analysis: analysisResult,
			extractedFiles: allExtractedFiles,
		});
	} catch (err) {
		console.error('Analysis error:', err);

		// Update session status to error
		try {
			const session = await locals.sessionStorage.readSessionMetadata(id);
			if (session) {
				session.status = 'error';
				session.error = err instanceof Error ? err.message : 'Analysis failed';
				session.lastAccessedAt = new Date().toISOString();
				await locals.sessionStorage.writeSessionMetadata(id, session);
			}
		} catch (updateError) {
			console.error('Failed to update session status:', updateError);
		}

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw svelteError(
			500,
			err instanceof Error ? err.message : 'Analysis failed',
		);
	}
};
