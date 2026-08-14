import { sanitizeHtml } from '../core/sanitizer.js';
import { toTrustedHtml } from '../core/trustedTypes.js';
import { sanitizeResourceUrl, type UrlKind } from '../core/urlPolicy.js';
import type { BaseInteractionData } from '../interactions/shared/types.js';
import type { PlayerSecurityConfig } from '../types/index.js';
import type {
	InteractionDeliveryField,
	InteractionDeliveryPathSegment,
} from './deliveryTypes.js';

type MutableRecord = Record<string, unknown>;

/**
 * Finalize extracted data for its declared render sinks.
 *
 * InteractionModules own field classification. This module owns the common
 * enforcement implementation and is the only extraction egress that may mint
 * TrustedHTML. The returned graph is frozen so no post-egress string transform
 * can invalidate that guarantee.
 */
export function finalizeInteractionDelivery<TData extends BaseInteractionData>(
	interaction: TData,
	fields: readonly InteractionDeliveryField[],
	security?: PlayerSecurityConfig,
	authoredType: string = interaction.type,
): TData {
	const output = cloneValue(interaction) as TData;

	for (const field of fields) {
		visitField(output as unknown as MutableRecord, field.path, (value, parent, key) => {
			if (field.kind === 'html') {
				// A plugin overriding a standard extractor cannot bypass the common
				// policy by returning an object at a known HTML field. Coerce at this
				// boundary, sanitize, and mint the only render-capable value here.
				const raw = typeof value === 'string' ? value : '';
				const sanitized = sanitizeHtml(raw, { security });
				setChild(parent, key, toTrustedHtml(sanitized, security?.trustedTypesPolicyName));
				return;
			}

			// Unexpected URL shapes fail closed rather than reaching a browser sink
			// where implicit string coercion could reinterpret them.
			if (typeof value !== 'string') {
				setChild(parent, key, '');
				return;
			}
			const use = resolveUrlKind(field.use, output, authoredType);
			setChild(parent, key, sanitizeResourceUrl(value, security?.urlPolicy, use) ?? '');
		});
	}

	if (authoredType === 'mediaInteraction') {
		(output as any).allowObjectEmbeds = security?.allowObjectEmbeds === true;
	}

	return deepFreeze(output);
}
function visitField(
	value: unknown,
	path: readonly InteractionDeliveryPathSegment[],
	visit: (value: unknown, parent: MutableRecord | unknown[], key: string | number) => void,
	parent?: MutableRecord | unknown[],
	key?: string | number
): void {
	if (path.length === 0) {
		if (parent !== undefined && key !== undefined) visit(value, parent, key);
		return;
	}

	if (value === null || typeof value !== 'object') return;

	const [segment, ...rest] = path;
	if (segment === '*') {
		if (Array.isArray(value)) {
			for (let index = 0; index < value.length; index += 1) {
				visitField(value[index], rest, visit, value, index);
			}
			return;
		}
		for (const [childKey, child] of Object.entries(value)) {
			visitField(child, rest, visit, value as MutableRecord, childKey);
		}
		return;
	}

	const record = value as MutableRecord;
	if (!(segment in record)) return;
	visitField(record[segment], rest, visit, record, segment);
}

function resolveUrlKind(
	use: UrlKind | 'media-or-object',
	interaction: BaseInteractionData,
	authoredType: string,
): UrlKind {
	if (use !== 'media-or-object') return use;
	const mediaElement =
		authoredType === 'mediaInteraction' && 'mediaElement' in interaction
			? interaction.mediaElement
			: null;
	return mediaElement &&
		typeof mediaElement === 'object' &&
		'type' in mediaElement &&
		mediaElement.type === 'object'
		? 'object'
		: 'media';
}

function setChild(
	parent: MutableRecord | unknown[],
	key: string | number,
	value: unknown
): void {
	if (Array.isArray(parent) && typeof key === 'number') {
		parent[key] = value;
		return;
	}
	(parent as MutableRecord)[String(key)] = value;
}

function cloneValue<T>(value: T): T {
	if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
	if (value && typeof value === 'object') {
		// TrustedHTML and other host values are terminal leaves. Standard extractor
		// output is plain data; retaining a non-plain value avoids destroying a host
		// object's identity when a plugin supplies one deliberately.
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) return value;
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)])
		) as T;
	}
	return value;
}

function deepFreeze<T>(value: T): T {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
		// TrustedHTML and other host objects are opaque terminal values. Freezing a
		// browser-owned object can throw and adds no protection to our data graph.
		return value;
	}
	Object.freeze(value);
	for (const child of Object.values(value as MutableRecord)) deepFreeze(child);
	return value;
}
