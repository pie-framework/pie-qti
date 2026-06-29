import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const workflowSource = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

describe('release workflow', () => {
	test('uses publish necessity instead of version diff alone for automatic publish runs', () => {
		expect(workflowSource).toContain('should_publish');
		expect(workflowSource).toContain("steps.detect.outputs.should_publish == 'true'");
	});
});
