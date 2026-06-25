import { PollyServerProvider } from '@pie-players/tts-server-polly';
import { json, type RequestHandler } from '@sveltejs/kit';
import { demoEnv } from '$lib/server/demo-env';

export const prerender = false;

type PollyEngine = 'neural' | 'standard';
type PollyFormat = 'mp3' | 'ogg' | 'pcm';
type PollySpeechMarkType = 'word' | 'sentence' | 'ssml';

const pollyProviders = new Map<PollyEngine, PollyServerProvider>();

function hasAwsCredentials() {
	return Boolean(demoEnv('AWS_REGION') && demoEnv('AWS_ACCESS_KEY_ID') && demoEnv('AWS_SECRET_ACCESS_KEY'));
}

function awsCredentials() {
	return {
		accessKeyId: demoEnv('AWS_ACCESS_KEY_ID') ?? '',
		secretAccessKey: demoEnv('AWS_SECRET_ACCESS_KEY') ?? '',
		...(demoEnv('AWS_SESSION_TOKEN') ? { sessionToken: demoEnv('AWS_SESSION_TOKEN') } : {}),
	};
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
		credentials: awsCredentials(),
		engine,
		defaultVoice: 'Joanna',
	});
	pollyProviders.set(engine, provider);
	return provider;
}

function pollyEngine(value: unknown): PollyEngine {
	return value === 'neural' || value === 'standard' ? value : 'standard';
}

function pollyFormat(value: unknown): PollyFormat {
	return value === 'ogg' || value === 'pcm' || value === 'mp3' ? value : 'mp3';
}

function speechMarkTypes(value: unknown): PollySpeechMarkType[] {
	if (!Array.isArray(value)) return ['word'];
	const types = value.filter((entry): entry is PollySpeechMarkType => entry === 'word' || entry === 'sentence' || entry === 'ssml');
	return types.length > 0 ? types : ['word'];
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const text = typeof body.text === 'string' ? body.text : '';

	if (!text.trim()) {
		return json({ error: 'text is required' }, { status: 400 });
	}

	if (text.length > 3000) {
		return json({ error: 'text must be 3000 characters or fewer' }, { status: 400 });
	}

	try {
		const provider = await getPollyProvider(pollyEngine(body.engine));
		const result = await provider.synthesize({
			text,
			voice: typeof body.voice === 'string' ? body.voice : 'Joanna',
			language: typeof body.language === 'string' ? body.language : 'en-US',
			rate: typeof body.rate === 'number' ? body.rate : undefined,
			format: pollyFormat(body.format),
			providerOptions: { speechMarkTypes: speechMarkTypes(body.speechMarkTypes) },
			includeSpeechMarks: body.includeSpeechMarks !== false,
		});

		return json({
			audio: result.audio instanceof Buffer ? result.audio.toString('base64') : result.audio,
			contentType: result.contentType,
			speechMarks: result.speechMarks,
			metadata: result.metadata,
		});
	} catch (error) {
		if (error instanceof Error && error.message === 'AWS_POLLY_NOT_CONFIGURED') {
			return json(
				{
					error: 'AWS Polly is not configured for this demo server.',
					fallback: 'browser',
				},
				{ status: 503 },
			);
		}

		return json(
			{
				error: error instanceof Error ? error.message : 'Text-to-speech synthesis failed',
			},
			{ status: 500 },
		);
	}
};
