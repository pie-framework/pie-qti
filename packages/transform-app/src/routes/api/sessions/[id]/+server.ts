/**
 * Single session API endpoint
 * Get or delete a specific session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;
  const sessionManager = getSessionManager();

  const session = await sessionManager.getSession(id);
  if (!session) {
    throw svelteError(404, 'Session not found');
  }

  return json({
    success: true,
    session,
  });
};

export const DELETE: RequestHandler = async ({ params }) => {
  const { id } = params;
  const sessionManager = getSessionManager();

  const exists = await sessionManager.sessionExists(id);
  if (!exists) {
    throw svelteError(404, 'Session not found');
  }

  await sessionManager.deleteSession(id);

  return json({
    success: true,
    message: 'Session deleted',
  });
};
