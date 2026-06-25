import { PollyServerProvider } from '@pie-players/tts-server-polly';
import { json, type RequestHandler } from '@sveltejs/kit';
import { demoEnv } from '$lib/server/demo-env';

export const prerender = false;

type PollyEngine = 'neural' | 'standard';

const pollyProviders = new Map<PollyEngine, PollyServerProvider>();

function hasAwsCredentials() {
	return Boolean(demoEnv('AWS_REGION') && demoEnv('AWS_ACCESS_KEY_ID') && demoEnv('AWS_SECRET_ACCESS_KEY'));
}

async function getPollyProvider(engine: PollyEngine) {
	const existing = pollyProviders.get(engine);
	if (existing) return existing;

	if (!hasAwsCredentials()) {
		throw new Error('AWS_POLLY_NOT_CONFIGURED');
	}

	const provider = new PollyServerProvider();
	await provider.initialize({
		region: demoEnv('AWS_REGION') ?? 'us-east-1',
		credentials: {
			accessKeyId: demoEnv('AWS_ACCESS_KEY_ID') ?? '',
			secretAccessKey: demoEnv('AWS_SECRET_ACCESS_KEY') ?? '',
			...(demoEnv('AWS_SESSION_TOKEN') ? { sessionToken: demoEnv('AWS_SESSION_TOKEN') } : {}),
		},
		engine,
		defaultVoice: 'Joanna',
	});
	pollyProviders.set(engine, provider);
	return provider;
}

function pollyEngine(value: string | null): PollyEngine {
	return value === 'neural' || value === 'standard' ? value : 'standard';
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const engine = pollyEngine(url.searchParams.get('engine'));
		const provider = await getPollyProvider(engine);
		const voices = await provider.getVoices({
			language: url.searchParams.get('language') ?? undefined,
			gender: (url.searchParams.get('gender') as 'male' | 'female' | 'neutral' | null) ?? undefined,
			quality: engine,
		});

		return json({ voices });
	} catch (error) {
		if (error instanceof Error && error.message === 'AWS_POLLY_NOT_CONFIGURED') {
			return json({ voices: [], configured: false }, { status: 503 });
		}

		return json(
			{
				error: error instanceof Error ? error.message : 'Unable to load Polly voices',
			},
			{ status: 500 },
		);
	}
};
