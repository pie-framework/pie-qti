import { describe, expect, it } from 'bun:test';
import { createMapperForVersion, createQtiParser, isQti2, isQti3 } from '../parser-factory.js';
import { Qti2xElementNameMapper } from '../element-mapper/Qti2xElementNameMapper.js';
import { Qti3ElementNameMapper } from '../element-mapper/Qti3ElementNameMapper.js';

describe('createQtiParser', () => {
	describe('QTI 2.x detection', () => {
		it('should detect QTI 2.2 and create Qti2xElementNameMapper', () => {
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;

			const { version, mapper } = createQtiParser(xml);

			expect(version).toBe('2.2');
			expect(mapper).toBeInstanceOf(Qti2xElementNameMapper);
			expect(mapper.version).toBe('2.x');
		});

		it('should detect QTI 2.1 and create Qti2xElementNameMapper', () => {
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;

			const { version, mapper } = createQtiParser(xml);

			expect(version).toBe('2.1');
			expect(mapper).toBeInstanceOf(Qti2xElementNameMapper);
		});

		it('should detect QTI 2.0 and create Qti2xElementNameMapper', () => {
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p0" identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;

			const { version, mapper } = createQtiParser(xml);

			expect(version).toBe('2.0');
			expect(mapper).toBeInstanceOf(Qti2xElementNameMapper);
		});
	});

	describe('QTI 3.0 detection', () => {
		it('should detect QTI 3.0 from namespace and create Qti3ElementNameMapper', () => {
			const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
				<qti-item-body></qti-item-body>
			</qti-assessment-item>`;

			const { version, mapper } = createQtiParser(xml);

			expect(version).toBe('3.0');
			expect(mapper).toBeInstanceOf(Qti3ElementNameMapper);
			expect(mapper.version).toBe('3.0');
		});

		it('should detect QTI 3.0 from element name', () => {
			const xml = `<qti-assessment-item identifier="item-1">
				<qti-item-body></qti-item-body>
			</qti-assessment-item>`;

			const { version, mapper } = createQtiParser(xml);

			expect(version).toBe('3.0');
			expect(mapper).toBeInstanceOf(Qti3ElementNameMapper);
		});
	});

	describe('version override', () => {
		it('should use specified version instead of detecting', () => {
			const xml = `<assessmentItem identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;

			const { version, mapper } = createQtiParser(xml, { version: '3.0' });

			expect(version).toBe('3.0');
			expect(mapper).toBeInstanceOf(Qti3ElementNameMapper);
		});
	});

	describe('custom mapper', () => {
		it('should use provided custom mapper', () => {
			const xml = `<assessmentItem identifier="item-1"></assessmentItem>`;
			const customMapper = new Qti3ElementNameMapper();

			const { mapper } = createQtiParser(xml, { mapper: customMapper });

			expect(mapper).toBe(customMapper);
		});
	});

	describe('unknown version', () => {
		it('should default to QTI 2.x mapper for unknown content', () => {
			const xml = `<div>Not QTI content</div>`;

			const { version, mapper } = createQtiParser(xml);

			expect(version).toBe('unknown');
			expect(mapper).toBeInstanceOf(Qti2xElementNameMapper);
		});
	});

	describe('mapper usage', () => {
		it('should provide mapper that works with QTI 2.x element names', () => {
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;

			const { mapper } = createQtiParser(xml);

			expect(mapper.toCanonical('choiceInteraction')).toBe('choiceinteraction');
			expect(mapper.toNative('itembody')).toBe('itembody');
		});

		it('should provide mapper that works with QTI 3.0 element names', () => {
			const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
				<qti-item-body></qti-item-body>
			</qti-assessment-item>`;

			const { mapper } = createQtiParser(xml);

			expect(mapper.toCanonical('qti-choice-interaction')).toBe('choiceinteraction');
			expect(mapper.toNative('itembody')).toBe('qti-item-body');
		});
	});
});

describe('createMapperForVersion', () => {
	it('should create Qti2xElementNameMapper for QTI 2.0', () => {
		const mapper = createMapperForVersion('2.0');
		expect(mapper).toBeInstanceOf(Qti2xElementNameMapper);
	});

	it('should create Qti2xElementNameMapper for QTI 2.1', () => {
		const mapper = createMapperForVersion('2.1');
		expect(mapper).toBeInstanceOf(Qti2xElementNameMapper);
	});

	it('should create Qti2xElementNameMapper for QTI 2.2', () => {
		const mapper = createMapperForVersion('2.2');
		expect(mapper).toBeInstanceOf(Qti2xElementNameMapper);
	});

	it('should create Qti3ElementNameMapper for QTI 3.0', () => {
		const mapper = createMapperForVersion('3.0');
		expect(mapper).toBeInstanceOf(Qti3ElementNameMapper);
	});

	it('should default to Qti2xElementNameMapper for unknown version', () => {
		const mapper = createMapperForVersion('unknown');
		expect(mapper).toBeInstanceOf(Qti2xElementNameMapper);
	});
});

describe('isQti3', () => {
	it('should return true for QTI 3.0 content', () => {
		const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
			<qti-item-body></qti-item-body>
		</qti-assessment-item>`;

		expect(isQti3(xml)).toBe(true);
	});

	it('should return false for QTI 2.x content', () => {
		const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1">
			<itemBody></itemBody>
		</assessmentItem>`;

		expect(isQti3(xml)).toBe(false);
	});

	it('should return false for unknown content', () => {
		const xml = `<div>Not QTI</div>`;
		expect(isQti3(xml)).toBe(false);
	});
});

describe('isQti2', () => {
	it('should return true for QTI 2.2 content', () => {
		const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1">
			<itemBody></itemBody>
		</assessmentItem>`;

		expect(isQti2(xml)).toBe(true);
	});

	it('should return true for QTI 2.1 content', () => {
		const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="item-1">
			<itemBody></itemBody>
		</assessmentItem>`;

		expect(isQti2(xml)).toBe(true);
	});

	it('should return true for QTI 2.0 content', () => {
		const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p0" identifier="item-1">
			<itemBody></itemBody>
		</assessmentItem>`;

		expect(isQti2(xml)).toBe(true);
	});

	it('should return false for QTI 3.0 content', () => {
		const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
			<qti-item-body></qti-item-body>
		</qti-assessment-item>`;

		expect(isQti2(xml)).toBe(false);
	});

	it('should return false for unknown content', () => {
		const xml = `<div>Not QTI</div>`;
		expect(isQti2(xml)).toBe(false);
	});
});
