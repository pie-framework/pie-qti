/**
 * Namespace-based QTI version sniffing for conversion routing.
 *
 * Deliberately narrower than `@pie-qti/qti-common`'s canonical `detectQtiVersion`
 * (which also consults the root element and version attributes and can return
 * `'2.0'`): this four-value union is part of the published output shape
 * (`PieAssessment['qtiVersion']` and the transform metadata) and every routing
 * site switches on exactly these values. Widen it only together with those
 * routing sites, and prefer migrating to the canonical detector if the union is
 * ever widened.
 */
export type QtiVersion = '2.1' | '2.2' | '3.0' | 'unknown';

export function detectQtiVersion(qtiXml: string): QtiVersion {
	if (qtiXml.includes('imsqtiasi_v3p0') || qtiXml.includes('imsqti_v3p0')) return '3.0';
	if (qtiXml.includes('imsqti_v2p2')) return '2.2';
	if (qtiXml.includes('imsqti_v2p1')) return '2.1';
	return 'unknown';
}
