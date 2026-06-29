import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
	new URL('../src/routes/package-upload/[packageId]/item/[itemId]/+page.svelte', import.meta.url),
	'utf8'
);

describe('package upload item role switch', () => {
	it('offers Student and Evaluator roles and passes the selected QTI role into the player', () => {
		expect(source).toContain("type QTIRole");
		expect(source).toContain("let selectedRole = $state<QTIRole>('candidate')");
		expect(source).toContain("role: selectedRole");
		expect(source).toContain("role={selectedRole}");
		expect(source).toContain('<option value="candidate">Student</option>');
		expect(source).toContain('<option value="scorer">Evaluator</option>');
	});
});
