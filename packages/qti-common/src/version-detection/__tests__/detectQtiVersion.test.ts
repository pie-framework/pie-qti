import { describe, expect, it } from 'bun:test';
import { detectQtiVersion } from '../detectQtiVersion.js';

describe('detectQtiVersion', () => {
	describe('QTI 3.0 detection', () => {
		it('should detect from namespace URI', () => {
			const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
				<qti-item-body></qti-item-body>
			</qti-assessment-item>`;
			expect(detectQtiVersion(xml)).toBe('3.0');
		});

		it('should detect from root element name', () => {
			const xml = `<qti-assessment-item identifier="item-1">
				<qti-item-body></qti-item-body>
			</qti-assessment-item>`;
			expect(detectQtiVersion(xml)).toBe('3.0');
		});

		it('should detect qti-assessment-test', () => {
			const xml = `<qti-assessment-test identifier="test-1">
				<qti-test-part></qti-test-part>
			</qti-assessment-test>`;
			expect(detectQtiVersion(xml)).toBe('3.0');
		});
	});

	describe('QTI 2.2 detection', () => {
		it('should detect from namespace URI', () => {
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.2');
		});

		it('should detect from version attribute', () => {
			const xml = `<assessmentItem identifier="item-1" version="2.2.0">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.2');
		});

		it('should default to 2.2 for assessmentItem without version', () => {
			const xml = `<assessmentItem identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.2');
		});
	});

	describe('QTI 2.1 detection', () => {
		it('should detect from namespace URI', () => {
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.1');
		});

		it('should detect from version attribute', () => {
			const xml = `<assessmentItem identifier="item-1" version="2.1.0">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.1');
		});
	});

	describe('QTI 2.0 detection', () => {
		it('should detect from namespace URI', () => {
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p0" identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.0');
		});

		it('should detect from version attribute', () => {
			const xml = `<assessmentItem identifier="item-1" version="2.0.0">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.0');
		});
	});

	describe('unknown version', () => {
		it('should return unknown for invalid XML', () => {
			const xml = `not valid xml at all`;
			expect(detectQtiVersion(xml)).toBe('unknown');
		});

		it('should return unknown for non-QTI root element', () => {
			const xml = `<div><p>Some HTML</p></div>`;
			expect(detectQtiVersion(xml)).toBe('unknown');
		});

		it('should return unknown for empty string', () => {
			expect(detectQtiVersion('')).toBe('unknown');
		});
	});

	describe('string-based detection fallback', () => {
		it('should detect QTI 3.0 from element pattern', () => {
			const xml = `<?xml version="1.0"?>
			<qti-assessment-item identifier="item-1">
				<qti-item-body></qti-item-body>
			</qti-assessment-item>`;
			expect(detectQtiVersion(xml)).toBe('3.0');
		});

		it('should detect QTI 2.2 from namespace string', () => {
			const xml = `<?xml version="1.0"?>
			<!-- Some comment with imsqti_v2p2 namespace -->
			<assessmentItem>
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.2');
		});
	});

	describe('priority order', () => {
		it('should prioritize namespace over element name', () => {
			// Hypothetical case where element name doesn't match namespace
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('3.0');
		});

		it('should prioritize namespace over version attribute', () => {
			const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="item-1" version="2.2.0">
				<itemBody></itemBody>
			</assessmentItem>`;
			expect(detectQtiVersion(xml)).toBe('2.1');
		});
	});
});
