import { describe, expect, it } from 'bun:test';

import {
	createEnvelope,
	isQtiIframeEnvelope,
	parseQtiIframeMessage,
	QTI_IFRAME_PROTOCOL,
	QTI_IFRAME_PROTOCOL_VERSION,
} from '../../src/iframe/protocol.js';

describe('iframe protocol', () => {
	it('createEnvelope produces a versioned envelope', () => {
		const msg = createEnvelope('READY', { version: QTI_IFRAME_PROTOCOL_VERSION });
		expect(msg.protocol).toBe(QTI_IFRAME_PROTOCOL);
		expect(msg.version).toBe(QTI_IFRAME_PROTOCOL_VERSION);
		expect(msg.type).toBe('READY');
	});

	it('isQtiIframeEnvelope rejects non-matching protocol/version', () => {
		expect(isQtiIframeEnvelope({})).toBe(false);
		expect(isQtiIframeEnvelope({ protocol: QTI_IFRAME_PROTOCOL, version: 'nope', type: 'READY', payload: {} })).toBe(
			false
		);
		expect(isQtiIframeEnvelope({ protocol: 'other', version: QTI_IFRAME_PROTOCOL_VERSION, type: 'READY', payload: {} })).toBe(
			false
		);
	});

	it('parseQtiIframeMessage returns null when not matching the protocol', () => {
		expect(parseQtiIframeMessage(null)).toBe(null);
		expect(parseQtiIframeMessage({ protocol: 'x', version: 'y', type: 'READY', payload: {} })).toBe(null);
	});

	it('parseQtiIframeMessage returns the envelope for matching messages', () => {
		const msg = createEnvelope('READY', { version: QTI_IFRAME_PROTOCOL_VERSION });
		const parsed = parseQtiIframeMessage(msg);
		expect(parsed).not.toBe(null);
		expect(parsed!.type).toBe('READY');
	});
});


