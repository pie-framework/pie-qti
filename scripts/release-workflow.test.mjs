import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const workflowSource = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

describe('release workflow', () => {
	test('uses publish necessity instead of version diff alone for automatic publish runs', () => {
		expect(workflowSource).toContain('should_publish');
		expect(workflowSource).toContain("steps.detect.outputs.should_publish == 'true'");
	});

	// A failed post-publish check must not skip the back-merge: 0.1.25's closure check failed on
	// replica lag after every package had published.
	test('opens the back-merge PR after any publish, whatever the checks before it did', () => {
		const step = workflowSource.slice(workflowSource.indexOf('- name: Open master -> develop back-merge PR'));
		const header = step.slice(0, step.indexOf('run: |'));
		expect(header).toContain("if: ${{ !cancelled() && steps.changesets.outputs.published == 'true' }}");
		expect(header).toContain('continue-on-error: true');
		expect(step).toContain('--base develop');
		expect(step).toContain('--head master');
	});
});
