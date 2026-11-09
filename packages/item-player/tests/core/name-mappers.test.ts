import { describe, expect, test } from 'bun:test';
import {
	Qti2xAttributeNameMapper,
	Qti2xElementNameMapper,
	Qti3AttributeNameMapper,
	Qti3ElementNameMapper,
} from '@pie-qti/qti-common';
import {
	attributeNameMapperForVersion,
	defaultExtractionMappers,
	elementNameMapperForVersion,
	resolveNameMappers,
} from '../../src/core/nameMappers.js';

describe('elementNameMapperForVersion / attributeNameMapperForVersion', () => {
	test("an unknown version maps to QTI 2.x, '3.0' to QTI 3.0", () => {
		for (const version of ['unknown', '2.0', '2.1', '2.2', '', 'banana']) {
			expect(elementNameMapperForVersion(version)).toBeInstanceOf(Qti2xElementNameMapper);
			expect(attributeNameMapperForVersion(version)).toBeInstanceOf(Qti2xAttributeNameMapper);
		}
		expect(elementNameMapperForVersion('3.0')).toBeInstanceOf(Qti3ElementNameMapper);
		expect(attributeNameMapperForVersion('3.0')).toBeInstanceOf(Qti3AttributeNameMapper);
	});
});

describe('resolveNameMappers', () => {
	test('explicitly passed mappers win', () => {
		const element = new Qti3ElementNameMapper();
		const attribute = new Qti2xAttributeNameMapper();
		const resolved = resolveNameMappers({
			itemXml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"/>`,
			elementNameMapper: element,
			attributeNameMapper: attribute,
		});
		expect(resolved.elementNameMapper).toBe(element);
		expect(resolved.attributeNameMapper).toBe(attribute);
	});

	test('a missing attribute mapper comes from the detected version of the item XML', () => {
		const element = new Qti2xElementNameMapper();
		const qti3Resolved = resolveNameMappers({
			itemXml: `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"/>`,
			elementNameMapper: element,
		});
		expect(qti3Resolved.attributeNameMapper).toBeInstanceOf(Qti3AttributeNameMapper);

		const qti2Resolved = resolveNameMappers({
			itemXml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"/>`,
			elementNameMapper: element,
		});
		expect(qti2Resolved.attributeNameMapper).toBeInstanceOf(Qti2xAttributeNameMapper);
	});

	test('an item without a detectable version maps to QTI 2.x', () => {
		const resolved = resolveNameMappers({ itemXml: '<div>not qti</div>' });
		expect(resolved.elementNameMapper).toBeInstanceOf(Qti2xElementNameMapper);
		expect(resolved.attributeNameMapper).toBeInstanceOf(Qti2xAttributeNameMapper);
	});
});

describe('defaultExtractionMappers', () => {
	test('createExtractionUtils defaults stay QTI 2.x regardless of the markup', () => {
		const defaults = defaultExtractionMappers();
		expect(defaults.elementMapper).toBeInstanceOf(Qti2xElementNameMapper);
		expect(defaults.attrMapper).toBeInstanceOf(Qti2xAttributeNameMapper);
		const explicit = defaultExtractionMappers(
			new Qti3ElementNameMapper(),
			new Qti3AttributeNameMapper(),
		);
		expect(explicit.elementMapper).toBeInstanceOf(Qti3ElementNameMapper);
		expect(explicit.attrMapper).toBeInstanceOf(Qti3AttributeNameMapper);
	});
});
