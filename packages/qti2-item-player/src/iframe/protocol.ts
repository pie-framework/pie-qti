/**
 * qti2-item-player iframe mode protocol (reference)
 *
 * This module defines a versioned postMessage envelope and minimal runtime validators.
 * It intentionally contains NO DOM globals, so it can be imported in any environment.
 *
 * IMPORTANT: This protocol is a contract between:
 * - a host application (embedding an iframe)
 * - a player runtime hosted inside that iframe
 *
 * The project ships a host helper to reduce mistakes, and qti2-example provides a
 * reference runtime implementation. Production runtimes are integrator-owned.
 */

import type { PlayerSecurityConfig, QTIRole } from '../types/index.js';

export const QTI_IFRAME_PROTOCOL = 'pie-qti-iframe' as const;
export const QTI_IFRAME_PROTOCOL_VERSION = '0.1.0' as const;

export type QtiIframeProtocol = typeof QTI_IFRAME_PROTOCOL;
export type QtiIframeProtocolVersion = typeof QTI_IFRAME_PROTOCOL_VERSION;

export type QtiIframeMessageType =
	| 'READY'
	| 'INIT'
	| 'SET_RESPONSES'
	| 'SUBMIT'
	| 'RESET'
	| 'RESIZE'
	| 'RESPONSE_CHANGE'
	| 'SUBMIT_RESULT'
	| 'ERROR';

export interface QtiIframeEnvelope<TType extends QtiIframeMessageType = QtiIframeMessageType, TPayload = unknown> {
	protocol: QtiIframeProtocol;
	version: QtiIframeProtocolVersion;
	/** Correlates request/response pairs. Optional for one-way notifications. */
	requestId?: string;
	type: TType;
	payload: TPayload;
}

export interface QtiIframeReadyPayload {
	/** Optional human-readable runtime identifier (for debugging) */
	runtime?: string;
	/** Runtime protocol version (echo) */
	version: QtiIframeProtocolVersion;
}

export interface QtiIframeInitPayload {
	itemXml: string;
	role?: QTIRole;
	seed?: number;
	security?: PlayerSecurityConfig;
	/** Optional initial responses */
	responses?: Record<string, unknown>;
	/**
	 * Optional opaque config for the runtime (integrator-defined).
	 * Must be structured-cloneable.
	 */
	runtimeConfig?: Record<string, unknown>;
}

export interface QtiIframeSetResponsesPayload {
	responses: Record<string, unknown>;
}

export interface QtiIframeResizePayload {
	height: number;
}

export interface QtiIframeResponseChangePayload {
	responses: Record<string, unknown>;
}

export interface QtiIframeSubmitResultPayload {
	result: unknown;
}

export interface QtiIframeErrorPayload {
	message: string;
	code?: string;
	details?: unknown;
}

export type QtiIframeMessage =
	| QtiIframeEnvelope<'READY', QtiIframeReadyPayload>
	| QtiIframeEnvelope<'INIT', QtiIframeInitPayload>
	| QtiIframeEnvelope<'SET_RESPONSES', QtiIframeSetResponsesPayload>
	| QtiIframeEnvelope<'SUBMIT', Record<string, never>>
	| QtiIframeEnvelope<'RESET', Record<string, never>>
	| QtiIframeEnvelope<'RESIZE', QtiIframeResizePayload>
	| QtiIframeEnvelope<'RESPONSE_CHANGE', QtiIframeResponseChangePayload>
	| QtiIframeEnvelope<'SUBMIT_RESULT', QtiIframeSubmitResultPayload>
	| QtiIframeEnvelope<'ERROR', QtiIframeErrorPayload>;

export function createEnvelope<TType extends QtiIframeMessageType, TPayload>(
	type: TType,
	payload: TPayload,
	opts?: { requestId?: string; version?: QtiIframeProtocolVersion }
): QtiIframeEnvelope<TType, TPayload> {
	return {
		protocol: QTI_IFRAME_PROTOCOL,
		version: opts?.version ?? QTI_IFRAME_PROTOCOL_VERSION,
		requestId: opts?.requestId,
		type,
		payload,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isQtiIframeEnvelope(value: unknown): value is QtiIframeEnvelope {
	if (!isRecord(value)) return false;
	if (value.protocol !== QTI_IFRAME_PROTOCOL) return false;
	if (value.version !== QTI_IFRAME_PROTOCOL_VERSION) return false;
	if (typeof value.type !== 'string') return false;
	if (!('payload' in value)) return false;
	if ('requestId' in value && value.requestId !== undefined && typeof value.requestId !== 'string') return false;
	return true;
}

/**
 * Parse and validate an incoming postMessage `event.data`.
 * Returns `null` if the message is not for this protocol/version.
 */
export function parseQtiIframeMessage(value: unknown): QtiIframeMessage | null {
	if (!isQtiIframeEnvelope(value)) return null;

	// We intentionally do only shallow validation here to keep the protocol evolvable.
	// Runtimes/hosts should still validate payload fields for safety.
	return value as QtiIframeMessage;
}


