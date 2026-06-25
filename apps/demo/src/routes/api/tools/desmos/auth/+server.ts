import { json, type RequestHandler } from '@sveltejs/kit';
import { demoEnv } from '$lib/server/demo-env';

export const prerender = false;

export const GET: RequestHandler = async () => {
	return json({
		apiKey: demoEnv('DESMOS_API_KEY') ?? null,
		config: {
			expressionsCollapsed: false,
			settingsMenu: true,
			zoomButtons: true,
			expressionsTopbar: true,
		},
	});
};
