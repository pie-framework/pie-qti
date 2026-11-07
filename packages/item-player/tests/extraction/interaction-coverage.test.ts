import { describe, expect, test } from 'bun:test';
import { Qti2xElementNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { findFirstDescendant, parseXml } from '@pie-qti/qti-processing';
import { createExtractionRegistry, registerFrameworkDeliveryFields } from '../../src/extraction/ExtractionRegistry.js';
import { findUnextractableInteractions } from '../../src/extraction/interactionCoverage.js';
import { getStandardInteractionModules } from '../../src/interactions/modules.js';

function standardRegistry(mapper: Qti2xElementNameMapper | Qti3ElementNameMapper) {
	const registry = createExtractionRegistry(mapper);
	for (const module of getStandardInteractionModules()) {
		registry.register(module.extractor as never);
		registerFrameworkDeliveryFields(registry, module.type, module.delivery);
	}
	return registry.seal();
}

function itemBody(xml: string, name: string): Element {
	const body = findFirstDescendant(parseXml(xml), name);
	if (!body) throw new Error('fixture has no item body');
	return body;
}

describe('findUnextractableInteractions', () => {
	test('reports response-bound elements without an extractor and interactions without a binding', () => {
		const mapper = new Qti2xElementNameMapper();
		const body = itemBody(
			`<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:v="urn:vendor">
				<itemBody>
					<choiceInteraction responseIdentifier="OK"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>
					<v:graphInteraction responseIdentifier="GRAPH"/>
					<div><sliderInteraction lowerBound="0" upperBound="10"/></div>
					<rubricBlock view="scorer"><vendorThing responseIdentifier="HIDDEN"/></rubricBlock>
				</itemBody>
			</assessmentItem>`,
			'itemBody',
		);

		expect(findUnextractableInteractions(body, { extractionRegistry: standardRegistry(mapper), elementNameMapper: mapper })).toEqual([
			{ reason: 'unregistered', element: 'v:graphInteraction', responseIdentifier: 'GRAPH' },
			{ reason: 'missing-response-identifier', element: 'sliderInteraction' },
		]);
	});

	test('reads QTI 3.0 names and kebab-case bindings', () => {
		const mapper = new Qti3ElementNameMapper();
		const body = itemBody(
			`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
				<qti-item-body>
					<qti-text-entry-interaction response-identifier="OK"/>
					<qti-graph-interaction response-identifier="GRAPH"/>
					<qti-end-attempt-interaction title="Done"/>
				</qti-item-body>
			</qti-assessment-item>`,
			'qti-item-body',
		);

		expect(findUnextractableInteractions(body, { extractionRegistry: standardRegistry(mapper), elementNameMapper: mapper })).toEqual([
			{ reason: 'unregistered', element: 'qti-graph-interaction', responseIdentifier: 'GRAPH' },
			{ reason: 'missing-response-identifier', element: 'qti-end-attempt-interaction' },
		]);
	});
});
