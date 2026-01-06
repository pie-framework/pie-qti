import { describe, expect, test } from 'bun:test';
import { basename, join } from 'node:path';
import {
	listFixtureDirs,
	loadFixture,
	normalizeOutcomes,
	runItemCase,
} from './harness.js';

const FIXTURES_ROOT = join(import.meta.dir, 'fixtures');

describe('conformance fixtures', async () => {
	const fixtureDirs = await listFixtureDirs(FIXTURES_ROOT);
	const coverage = new Map<string, Set<string>>();

	test('should discover at least one fixture', () => {
		expect(fixtureDirs.length).toBeGreaterThan(0);
	});

	for (const fixtureDir of fixtureDirs) {
		const fixtureId = basename(fixtureDir);

		describe(fixtureId, async () => {
			let fixture: Awaited<ReturnType<typeof loadFixture>>;
			try {
				fixture = await loadFixture(fixtureDir);
			} catch (err) {
				const code = err && typeof err === 'object' && 'code' in err ? (err as any).code : undefined;
				// In constrained environments (e.g. sandboxed tooling), fixture folders may be unreadable.
				// Only skip for permission-related errors; other errors should fail the suite.
				if (code === 'EACCES' || code === 'EPERM') {
					// eslint-disable-next-line no-console
					console.warn(`[conformance] skipping fixture "${fixtureId}" (${code})`);
					test.skip('fixture load skipped due to filesystem permissions', () => {});
					return;
				}
				throw err;
			}

			// Collect coverage tags (best-effort)
			const covers = fixture.manifest?.covers || [];
			for (const tag of covers) {
				if (!coverage.has(tag)) coverage.set(tag, new Set());
				coverage.get(tag)?.add(fixtureId);
			}

			test('cases.json id should match folder name', () => {
				expect(fixture.caseFile.id).toBe(fixtureId);
			});

			for (const c of fixture.caseFile.cases) {
				test(c.name, () => {
					const runAndAssert = () => {
						const { result, itemBodyHtml } = runItemCase({
							itemXml: fixture.itemXml,
							responses: c.responses,
							seed: fixture.caseFile.seed,
							useSubmitAttempt: c.useSubmitAttempt,
							countAttempt: c.countAttempt,
						});

						if (c.expect.score !== undefined) {
							expect(result.score).toBe(c.expect.score);
						}
						if (c.expect.maxScore !== undefined) {
							expect(result.maxScore).toBe(c.expect.maxScore);
						}

						if (c.expect.outcomes) {
							const actual = normalizeOutcomes(result.outcomeValues || {});
							const expected = normalizeOutcomes(c.expect.outcomes);
							for (const [k, v] of Object.entries(expected)) {
								expect(actual[k]).toEqual(v);
							}
						}

						if (c.expect.modalFeedbackIdentifiers) {
							const actualIds = (result.modalFeedback || [])
								.map((f) => f.identifier)
								.sort();
							const expectedIds = [...c.expect.modalFeedbackIdentifiers].sort();
							expect(actualIds).toEqual(expectedIds);
						}

						if (c.expect.itemBodyContains) {
							for (const s of c.expect.itemBodyContains) {
								expect(itemBodyHtml).toContain(s);
							}
						}
					};

					if (c.xfail) {
						let failedAsExpected = false;
						try {
							runAndAssert();
						} catch {
							failedAsExpected = true;
						}
						if (!failedAsExpected) {
							throw new Error(
								`xfail case unexpectedly passed${c.xfailReason ? `: ${c.xfailReason}` : ''}`
							);
						}
						return;
					}

					runAndAssert();
				});
			}
		});
	}

	test('coverage report (operator/statement -> fixtures)', () => {
		// This is intentionally a lightweight report: it gives visibility into what
		// we *think* we cover, based on fixture manifests.
		const lines: string[] = [];
		for (const tag of [...coverage.keys()].sort()) {
			const fixtures = [...(coverage.get(tag) || [])].sort();
			lines.push(`${tag}: ${fixtures.join(', ')}`);
		}
		// eslint-disable-next-line no-console
		console.log(lines.length ? `\n[conformance coverage]\n${lines.join('\n')}\n` : '\n[conformance coverage]\n(none)\n');
		expect(true).toBe(true);
	});
});


