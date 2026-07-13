import type { PlayerSecurityConfig } from '@pie-qti/item-player';
import { sanitizeResourceUrl } from '@pie-qti/item-player/security';
import type { ParsedAssessmentItemRef, ParsedAssessmentSection, ParsedAssessmentTest, ParsedTestPart } from './types.js';

export type QtiItemMap = Record<string, string>;
export type QtiAssessmentResourceResolver = (href: string) => Promise<string>;

export interface QtiItemFetchPolicy {
	/** Maximum number of distinct resources resolved for one assessment. */
	maxItems?: number;
	/** Maximum UTF-8 bytes accepted for one item document. */
	maxItemBytes?: number;
	/**
	 * Maximum cumulative UTF-8 bytes retained across distinct assessment resources.
	 * Set to Infinity only when the host enforces an equivalent upstream budget.
	 */
	maxTotalBytes?: number;
	/** Maximum number of concurrent item requests. */
	concurrency?: number;
	/** Per-request timeout in milliseconds. */
	timeoutMs?: number;
	/**
	 * Permit URLs outside itemBaseUrl's origin/path. This remains subject to
	 * security.urlPolicy and should only be enabled for trusted package layouts.
	 */
	allowOutsideBase?: boolean;
}

export interface ResolveItemsForAssessmentOptions {
	assessment: ParsedAssessmentTest;
	itemBaseUrl?: string;
	items?: QtiItemMap;
	security?: PlayerSecurityConfig;
	fetchPolicy?: QtiItemFetchPolicy;
	/** Injectable for tests and non-browser hosts. */
	fetch?: typeof globalThis.fetch;
	/** Cancels all pending resource requests for this assessment load. */
	signal?: AbortSignal;
	/** Shared bounded resolver, allowing callers to reuse its cache for section/assets. */
	resourceResolver?: QtiAssessmentResourceResolver;
}

export type CreateAssessmentResourceResolverOptions = Omit<
	ResolveItemsForAssessmentOptions,
	'assessment' | 'resourceResolver'
>;

type EffectiveFetchPolicy = Required<Omit<QtiItemFetchPolicy, 'allowOutsideBase'>> & {
	allowOutsideBase: boolean;
};

const DEFAULT_FETCH_POLICY: EffectiveFetchPolicy = {
	maxItems: 500,
	maxItemBytes: 10_000_000,
	maxTotalBytes: 100_000_000,
	concurrency: 6,
	timeoutMs: 15_000,
	allowOutsideBase: false,
};

function collectAssessmentItemRefsFromSections(sections: ParsedAssessmentSection[] | undefined): ParsedAssessmentItemRef[] {
	if (!sections) return [];
	const out: ParsedAssessmentItemRef[] = [];
	for (const s of sections) {
		if (s.assessmentItemRefs) out.push(...s.assessmentItemRefs);
		if (s.sections) out.push(...collectAssessmentItemRefsFromSections(s.sections));
	}
	return out;
}

function collectAssessmentItemRefs(assessment: ParsedAssessmentTest): ParsedAssessmentItemRef[] {
	const parts = assessment.testParts ?? [];
	const out: ParsedAssessmentItemRef[] = [];
	for (const p of parts) {
		out.push(...collectAssessmentItemRefsFromSections(p.sections));
	}
	return out;
}

function setAssessmentItemRefXmlInPlace(
	assessment: ParsedAssessmentTest,
	identifier: string,
	href: string | undefined,
	itemXml: string,
) {
	const parts = assessment.testParts ?? [];
	for (const p of parts) {
		const stack: ParsedAssessmentSection[] = [...(p.sections ?? [])];
		while (stack.length) {
			const s = stack.pop()!;
			if (s.assessmentItemRefs) {
				for (const q of s.assessmentItemRefs) {
					if (q.identifier === identifier || (href && q.href === href)) {
						q.itemXml = itemXml;
					}
				}
			}
			if (s.sections) stack.push(...s.sections);
		}
	}
}

function normalizeBaseUrl(baseUrl: string): string {
	try {
		const runtimeBase = globalThis.location?.href ?? 'http://localhost/';
		return new URL(baseUrl, runtimeBase).toString();
	} catch {
		throw new Error(`Invalid QTI item base URL: ${baseUrl}`);
	}
}

function isWithinBase(candidate: URL, base: URL): boolean {
	if (candidate.origin !== base.origin) return false;
	const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
	return candidate.pathname === base.pathname || candidate.pathname.startsWith(basePath);
}

function hasUnsafeEncodedPathToken(href: string): boolean {
	let current = href;
	for (let depth = 0; depth < 3; depth++) {
		if (/%(?:2e|2f|5c)/i.test(current)) return true;
		try {
			const decoded = decodeURIComponent(current);
			if (decoded === current) return false;
			current = decoded;
		} catch {
			return true;
		}
	}
	return /%(?:2e|2f|5c)/i.test(current);
}

function resolveCheckedItemUrl(
	href: string,
	baseUrl: string,
	security: PlayerSecurityConfig | undefined,
	allowOutsideBase: boolean,
): string {
	if (hasUnsafeEncodedPathToken(href)) {
		throw new Error(`QTI item URL contains an unsafe encoded path token: ${href}`);
	}
	const base = new URL(baseUrl);
	const sanitized = sanitizeResourceUrl(
		href,
		{
			...(security?.urlPolicy ?? {}),
			assetBaseUrl: baseUrl,
		},
		'any',
	);
	if (!sanitized) {
		throw new Error(`Blocked QTI item URL by security policy: ${href}`);
	}

	let resolved: URL;
	try {
		resolved = new URL(sanitized, base);
	} catch {
		throw new Error(`Invalid QTI item URL: ${href}`);
	}
	const fullySanitized = sanitizeResourceUrl(resolved.toString(), security?.urlPolicy, 'any');
	if (!fullySanitized) {
		throw new Error(`Blocked resolved QTI item URL by security policy: ${resolved.toString()}`);
	}
	resolved = new URL(fullySanitized);

	if (!allowOutsideBase && !isWithinBase(resolved, base)) {
		throw new Error(`QTI item URL escapes itemBaseUrl: ${href}`);
	}
	return resolved.toString();
}

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

async function readBoundedXml(response: Response, url: string, maxBytes: number): Promise<string> {
	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		throw new Error(`QTI item exceeds maxItemBytes: ${url} (${contentLength} > ${maxBytes})`);
	}

	const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
	if (
		contentType &&
		contentType !== 'application/xml' &&
		contentType !== 'text/xml' &&
		contentType !== 'text/plain' &&
		contentType !== 'text/css' &&
		!contentType.endsWith('+xml')
	) {
		throw new Error(`Unexpected QTI item content type "${contentType}" for ${url}`);
	}

	if (!response.body) {
		const xml = await response.text();
		const bytes = byteLength(xml);
		if (bytes > maxBytes) {
			throw new Error(`QTI item exceeds maxItemBytes: ${url} (${bytes} > ${maxBytes})`);
		}
		return xml;
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let bytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			bytes += value.byteLength;
			if (bytes > maxBytes) {
				await reader.cancel();
				throw new Error(`QTI item exceeds maxItemBytes: ${url} (${bytes} > ${maxBytes})`);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const combined = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(combined);
}

async function fetchItemXml(
	url: string,
	fetcher: typeof globalThis.fetch,
	policy: EffectiveFetchPolicy,
	externalSignal?: AbortSignal,
): Promise<string> {
	if (externalSignal?.aborted) throw new Error(`Cancelled QTI resource request: ${url}`);
	const controller = new AbortController();
	const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
	externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
	const timer = globalThis.setTimeout(() => controller.abort(), policy.timeoutMs);
	try {
		const response = await fetcher(url, {
			signal: controller.signal,
			credentials: 'same-origin',
			redirect: 'error',
		});
		if (!response.ok) throw new Error(`Failed to fetch QTI item: ${url} (${response.status})`);
		return await readBoundedXml(response, url, policy.maxItemBytes);
	} catch (error) {
		if (externalSignal?.aborted) {
			throw new Error(`Cancelled QTI resource request: ${url}`);
		}
		if (controller.signal.aborted) {
			throw new Error(`Timed out fetching QTI item after ${policy.timeoutMs}ms: ${url}`);
		}
		throw error;
	} finally {
		globalThis.clearTimeout(timer);
		externalSignal?.removeEventListener('abort', abortFromExternalSignal);
	}
}

function normalizeFetchPolicy(requestedPolicy: QtiItemFetchPolicy = {}): EffectiveFetchPolicy {
	const policy: EffectiveFetchPolicy = {
		maxItems: requestedPolicy.maxItems ?? DEFAULT_FETCH_POLICY.maxItems,
		maxItemBytes: requestedPolicy.maxItemBytes ?? DEFAULT_FETCH_POLICY.maxItemBytes,
		maxTotalBytes: requestedPolicy.maxTotalBytes ?? DEFAULT_FETCH_POLICY.maxTotalBytes,
		concurrency: requestedPolicy.concurrency ?? DEFAULT_FETCH_POLICY.concurrency,
		timeoutMs: requestedPolicy.timeoutMs ?? DEFAULT_FETCH_POLICY.timeoutMs,
		allowOutsideBase: requestedPolicy.allowOutsideBase ?? DEFAULT_FETCH_POLICY.allowOutsideBase,
	};
	if (!Number.isInteger(policy.maxItems) || policy.maxItems < 0) {
		throw new Error('fetchPolicy.maxItems must be a non-negative integer');
	}
	if (!Number.isInteger(policy.maxItemBytes) || policy.maxItemBytes < 1) {
		throw new Error('fetchPolicy.maxItemBytes must be a positive integer');
	}
	if (policy.maxTotalBytes !== Infinity && (!Number.isInteger(policy.maxTotalBytes) || policy.maxTotalBytes < 1)) {
		throw new Error('fetchPolicy.maxTotalBytes must be a positive integer or Infinity');
	}
	if (!Number.isInteger(policy.concurrency) || policy.concurrency < 1) {
		throw new Error('fetchPolicy.concurrency must be a positive integer');
	}
	if (!Number.isFinite(policy.timeoutMs) || policy.timeoutMs < 1) {
		throw new Error('fetchPolicy.timeoutMs must be positive');
	}
	return policy;
}

/**
 * Create a cache-backed resolver for assessment-adjacent package text.
 *
 * The same URL policy, base containment, timeout, count, and byte limits used for
 * item refs also apply to assessmentSectionRef, stylesheets, stimuli, and catalogs.
 */
export function createAssessmentResourceResolver(
	options: CreateAssessmentResourceResolverOptions,
): QtiAssessmentResourceResolver {
	const policy = normalizeFetchPolicy(options.fetchPolicy);
	const baseUrl = options.itemBaseUrl ? normalizeBaseUrl(options.itemBaseUrl) : undefined;
	const fetcher = options.fetch ?? globalThis.fetch;
	const cache = new Map<string, Promise<string>>();
	let resolvedResources = 0;
	let totalBytes = 0;
	let activeRequests = 0;
	const permitWaiters: Array<() => void> = [];

	const withRequestPermit = async <T>(operation: () => Promise<T>): Promise<T> => {
		if (activeRequests >= policy.concurrency) {
			await new Promise<void>((resolve) => permitWaiters.push(resolve));
		}
		activeRequests++;
		try {
			return await operation();
		} finally {
			activeRequests--;
			permitWaiters.shift()?.();
		}
	};

	const accountResource = (key: string, content: string): string => {
		const bytes = byteLength(content);
		if (bytes > policy.maxItemBytes) {
			throw new Error(`QTI resource exceeds maxItemBytes: ${key} (${bytes} > ${policy.maxItemBytes})`);
		}
		if (totalBytes + bytes > policy.maxTotalBytes) {
			throw new Error(
				`Assessment resources exceed maxTotalBytes (${totalBytes + bytes} > ${policy.maxTotalBytes})`,
			);
		}
		totalBytes += bytes;
		return content;
	};

	return async (href: string): Promise<string> => {
		if (options.signal?.aborted) throw new Error(`Cancelled QTI resource request: ${href}`);
		const supplied = options.items?.[href];
		const resolvedUrl = baseUrl
			? resolveCheckedItemUrl(href, baseUrl, options.security, policy.allowOutsideBase)
			: undefined;
		const cacheKey = resolvedUrl ?? `supplied:${href}`;
		const cached = cache.get(cacheKey);
		if (cached) return cached;
		if (resolvedResources >= policy.maxItems) {
			throw new Error(`Assessment references too many distinct QTI resources (limit ${policy.maxItems})`);
		}
		resolvedResources++;

		if (supplied !== undefined) {
			const request = Promise.resolve().then(() => accountResource(cacheKey, supplied));
			cache.set(cacheKey, request);
			try {
				return await request;
			} catch (error) {
				cache.delete(cacheKey);
				throw error;
			}
		}

		if (!baseUrl || !resolvedUrl) throw new Error(`No itemBaseUrl or supplied resource for QTI href: ${href}`);
		if (typeof fetcher !== 'function') {
			throw new Error('No fetch implementation is available to resolve QTI resources');
		}
		const request = withRequestPermit(async () => {
			const content = await fetchItemXml(resolvedUrl, fetcher, policy, options.signal);
			return accountResource(cacheKey, content);
		});
		cache.set(cacheKey, request);
		try {
			return await request;
		} catch (error) {
			cache.delete(cacheKey);
			throw error;
		}
	};
}

async function runBounded(tasks: Array<() => Promise<void>>, concurrency: number): Promise<void> {
	let cursor = 0;
	const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
		while (cursor < tasks.length) {
			const task = tasks[cursor++];
			await task();
		}
	});
	await Promise.all(workers);
}

export async function resolveItemsForAssessment(options: ResolveItemsForAssessmentOptions): Promise<ParsedAssessmentTest> {
	const { assessment, items } = options;
	const policy = normalizeFetchPolicy(options.fetchPolicy);

	// Mutate in-place (assessmentItemRefs are nested); return same reference.
	const refs = collectAssessmentItemRefs(assessment);
	const resolverItems = items ? { ...items } : undefined;
	for (const ref of refs) {
		if (resolverItems && ref.href && resolverItems[ref.href] === undefined && resolverItems[ref.identifier] !== undefined) {
			resolverItems[ref.href] = resolverItems[ref.identifier]!;
		}
	}
	const unresolved = refs.filter(
		(q) => !q.itemXml && !(resolverItems && (resolverItems[q.href ?? ''] ?? resolverItems[q.identifier])),
	);
	if (unresolved.length > policy.maxItems) {
		throw new Error(`Assessment references too many remote QTI items (${unresolved.length} > ${policy.maxItems})`);
	}
	const resourceResolver =
		options.resourceResolver ??
		createAssessmentResourceResolver({
			itemBaseUrl: options.itemBaseUrl,
			items: resolverItems,
			security: options.security,
			fetchPolicy: options.fetchPolicy,
			fetch: options.fetch,
			signal: options.signal,
		});

	const work = refs.map((q) => async () => {
		if (q.itemXml) return;

		// Resolve supplied and fetched XML through the same aggregate budget/cache.
		if (q.href) {
			const xml = await resourceResolver(q.href);
			setAssessmentItemRefXmlInPlace(assessment, q.identifier, q.href, xml);
			return;
		}
		const byIdentifier = items?.[q.identifier];
		if (byIdentifier !== undefined) {
			if (byteLength(byIdentifier) > policy.maxItemBytes) {
				throw new Error(`QTI resource exceeds maxItemBytes: ${q.identifier}`);
			}
			q.itemXml = byIdentifier;
		}
	});

	await runBounded(work, policy.concurrency);
	return assessment;
}
