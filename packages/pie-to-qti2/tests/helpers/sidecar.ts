import { expect } from 'bun:test';

interface TransformResultWithSidecar {
	items: Array<{ sidecar?: { sourceModel?: { extensions?: unknown } } | undefined }>;
}

/**
 * The generated QTI must carry no PIE payload: the source model (extensions
 * included) travels in the PIE source sidecar instead. Pass the transform
 * result and the original PIE item to also assert the round-tripped
 * extensions arrived intact.
 */
export function expectSidecarIsolation(
	qtiXml: string,
	result?: TransformResultWithSidecar,
	pieItem?: { extensions?: unknown },
): void {
	expect(qtiXml).not.toContain('pie:');
	expect(qtiXml).not.toContain('qti-metadata');
	if (result && pieItem) {
		expect(result.items[0]?.sidecar?.sourceModel?.extensions).toEqual(pieItem.extensions);
	}
}
