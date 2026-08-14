import type { UrlKind } from '../core/urlPolicy.js';

/**
 * A segment in a path to a value produced by an InteractionModule.
 * `'*'` visits every element of an array or every value of a record.
 */
export type InteractionDeliveryPathSegment = string | '*';

export type InteractionDeliveryField =
	| {
			kind: 'html';
			path: readonly InteractionDeliveryPathSegment[];
	  }
	| {
			kind: 'url';
			path: readonly InteractionDeliveryPathSegment[];
			use: UrlKind | 'media-or-object';
	  };

/**
 * Declares which extracted fields cross an HTML or resource-URL render sink.
 *
 * Field meaning belongs beside the InteractionModule that defines the data.
 * The delivery pipeline owns the shared sanitizer, URL policy, and Trusted
 * Types implementation that enforces these declarations.
 */
export interface InteractionDeliverySchema {
	readonly fields: readonly InteractionDeliveryField[];
}

export function htmlField(
	...path: InteractionDeliveryPathSegment[]
): InteractionDeliveryField {
	return { kind: 'html', path };
}

export function urlField(
	use: UrlKind | 'media-or-object',
	...path: InteractionDeliveryPathSegment[]
): InteractionDeliveryField {
	return { kind: 'url', path, use };
}
