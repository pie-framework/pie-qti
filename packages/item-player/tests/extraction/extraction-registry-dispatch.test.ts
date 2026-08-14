import { describe, expect, test } from 'bun:test';
import { Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { parse } from 'node-html-parser';
import { ExtractionRegistry } from '../../src/extraction/ExtractionRegistry.js';
import { createExtractionContext } from '../../src/extraction/createContext.js';
import type { ElementExtractor } from '../../src/extraction/types.js';

describe('ExtractionRegistry dispatch', () => {
	test('honors canHandle=false even for one mapper-matched extractor', () => {
		let extractionCalls = 0;
		const extractor: ElementExtractor<{ value: string }> = {
			id: 'test:declines-qti3',
			name: 'Declining extractor',
			priority: 1,
			elementTypes: ['choiceInteraction'],
			canHandle: () => false,
			extract: () => {
				extractionCalls += 1;
				return { value: 'should-not-run' };
			},
		};
		const mapper = new Qti3ElementNameMapper();
		const registry = new ExtractionRegistry(mapper);
		registry.register(extractor);
		const element = parse('<qti-choice-interaction response-identifier="RESPONSE"/>', {
			lowerCaseTagName: false,
		}).firstChild as never;
		const context = createExtractionContext(
			element,
			'RESPONSE',
			element,
			new Map(),
			{ itemXml: '', elementNameMapper: mapper },
		);

		const result = registry.extract(element, context);
		expect(result.success).toBe(false);
		expect(extractionCalls).toBe(0);
	});
});
