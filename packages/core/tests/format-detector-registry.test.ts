/**
 * Format Detector Registry Tests
 */

import { describe, expect, test } from 'bun:test';
import {
	FormatDetectorRegistry,
	type FormatDetector,
} from '../src/registry/format-detector-registry';
import { Qti22Detector } from '../src/detectors/qti22-detector';
import { PieDetector } from '../src/detectors/pie-detector';

describe('FormatDetectorRegistry', () => {
	test('should register a format detector', () => {
		const registry = new FormatDetectorRegistry();
		const detector = new Qti22Detector();

		registry.register(detector);

		const detectors = registry.getDetectors();
		expect(detectors).toHaveLength(1);
		expect(detectors[0].id).toBe('qti22-detector');
	});

	test('should sort detectors by priority (highest first)', () => {
		const registry = new FormatDetectorRegistry();

		const lowPriority: FormatDetector = {
			id: 'low',
			formatId: 'low-format',
			priority: 10,
			detect: () => false,
		};

		const highPriority: FormatDetector = {
			id: 'high',
			formatId: 'high-format',
			priority: 100,
			detect: () => false,
		};

		const mediumPriority: FormatDetector = {
			id: 'medium',
			formatId: 'medium-format',
			priority: 50,
			detect: () => false,
		};

		// Register in random order
		registry.register(mediumPriority);
		registry.register(lowPriority);
		registry.register(highPriority);

		const detectors = registry.getDetectors();
		expect(detectors[0].priority).toBe(100);
		expect(detectors[1].priority).toBe(50);
		expect(detectors[2].priority).toBe(10);
	});

	test('should detect QTI 2.2 format', async () => {
		const registry = new FormatDetectorRegistry();
		registry.register(new Qti22Detector());
		registry.register(new PieDetector());

		const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
  </responseDeclaration>
</assessmentItem>`;

		const format = await registry.detectFormat(qtiXml);
		expect(format).toBe('qti22');
	});

	test('should detect PIE format (object)', async () => {
		const registry = new FormatDetectorRegistry();
		registry.register(new Qti22Detector());
		registry.register(new PieDetector());

		const pieObject = {
			id: '1',
			element: 'multiple-choice',
			prompt: 'What is 2+2?',
		};

		const format = await registry.detectFormat(pieObject);
		expect(format).toBe('pie');
	});

	test('should detect PIE format (JSON string)', async () => {
		const registry = new FormatDetectorRegistry();
		registry.register(new Qti22Detector());
		registry.register(new PieDetector());

		const pieJson = JSON.stringify({
			id: '1',
			element: 'multiple-choice',
			prompt: 'What is 2+2?',
		});

		const format = await registry.detectFormat(pieJson);
		expect(format).toBe('pie');
	});

	test('should return null if no detector matches', async () => {
		const registry = new FormatDetectorRegistry();
		// Don't register any detectors

		const unknownContent = 'this is unknown content';

		const format = await registry.detectFormat(unknownContent);
		expect(format).toBeNull();
	});

	test('should use highest priority detector when multiple match', async () => {
		const registry = new FormatDetectorRegistry();

		const lowPriority: FormatDetector = {
			id: 'low',
			formatId: 'low-format',
			priority: 10,
			detect: () => true, // Always matches
		};

		const highPriority: FormatDetector = {
			id: 'high',
			formatId: 'high-format',
			priority: 100,
			detect: () => true, // Always matches
		};

		registry.register(lowPriority);
		registry.register(highPriority);

		const format = await registry.detectFormat('test');
		expect(format).toBe('high-format'); // Higher priority wins
	});

	test('should handle detector errors gracefully', async () => {
		const registry = new FormatDetectorRegistry();

		const errorDetector: FormatDetector = {
			id: 'error',
			formatId: 'error-format',
			priority: 100,
			detect: () => {
				throw new Error('Detector error');
			},
		};

		const workingDetector: FormatDetector = {
			id: 'working',
			formatId: 'working-format',
			priority: 50,
			detect: () => true,
		};

		registry.register(errorDetector);
		registry.register(workingDetector);

		// Should skip error detector and use working one
		const format = await registry.detectFormat('test');
		expect(format).toBe('working-format');
	});

	test('should clear all detectors', () => {
		const registry = new FormatDetectorRegistry();
		registry.register(new Qti22Detector());
		registry.register(new PieDetector());

		expect(registry.getDetectors()).toHaveLength(2);

		registry.clear();

		expect(registry.getDetectors()).toHaveLength(0);
	});
});
