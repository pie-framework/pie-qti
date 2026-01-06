/**
 * Sessions API endpoint
 * List all sessions
 */

import { json } from '@sveltejs/kit';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const sessionManager = getSessionManager();
  const sessions = await sessionManager.listSessions();

  return json({
    success: true,
    sessions: sessions.map((s) => ({
      id: s.id,
      created: s.created.toISOString(),
      status: s.status,
      packageCount: s.packages.length,
      hasAnalysis: !!s.analysis,
      hasTransformation: !!s.transformation,
    })),
  });
};
