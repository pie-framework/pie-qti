import { describe, expect, it } from 'bun:test';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toAssessmentResultXml } from '../src/reporting/index.js';
import { resultsData } from './helpers/results-fixture.js';

// Schema gate for Results Reporting output (SPEC-GAPS-PLAN G-26): the generated
// `assessmentResult` documents must validate against the official QTI result XSDs — the
// dimension unit tests cannot check, because it lives outside the browser player.
//
// The official schemas ship with the 1EdTech spec packages and are not vendored in this
// public repo. Drop them in, then this gate runs for real:
//
//   tests/schemas/results/imsqti_result_v2p2.xsd
//   tests/schemas/results/imsqti_result_v3p0.xsd
//
// (the private conformance runner's copies are the intended source). Without them the
// gate skips loudly; with them a regression fails CI.

const SCHEMA_DIR = join(import.meta.dir, 'schemas', 'results');
const SCHEMAS_PRESENT =
	existsSync(join(SCHEMA_DIR, 'imsqti_result_v2p2.xsd')) &&
	existsSync(join(SCHEMA_DIR, 'imsqti_result_v3p0.xsd'));

describe.skipIf(!SCHEMAS_PRESENT)('assessmentResult validates against the official result XSDs', () => {
	for (const [version, schema] of [
		['2.2', 'imsqti_result_v2p2.xsd'],
		['3.0', 'imsqti_result_v3p0.xsd'],
	] as const) {
		it(`QTI ${version} output validates against ${schema}`, () => {
			const xml = toAssessmentResultXml(resultsData(), { version });
			const xmlPath = join(SCHEMA_DIR, `.generated-${version}.xml`);
			writeFileSync(xmlPath, xml);
			try {
				const proc = Bun.spawnSync(['xmllint', '--noout', '--schema', join(SCHEMA_DIR, schema), xmlPath], {
					stdout: 'pipe',
					stderr: 'pipe',
				});
				expect(proc.exitCode, proc.stderr.toString().slice(0, 2000)).toBe(0);
			} finally {
				rmSync(xmlPath, { force: true });
			}
		});
	}
});

describe('assessmentResult schema gate readiness', () => {
	it('says loudly, once, whether the official schemas are vendored', () => {
		// An intentional assertion instead of a silent skip: a reader of the suite output
		// always sees whether the XSD dimension is actually being checked.
		expect([SCHEMAS_PRESENT, SCHEMA_DIR]).toEqual([SCHEMAS_PRESENT, SCHEMA_DIR]);
		console.warn(
			SCHEMAS_PRESENT
				? 'assessment-result-xsd: official result schemas found; the XSD gate is active.'
				: `assessment-result-xsd: SKIP - official result schemas not vendored under ${SCHEMA_DIR}; drop imsqti_result_v2p2.xsd and imsqti_result_v3p0.xsd there (source: the 1EdTech spec packages / the private conformance runner).`,
		);
	});
});
