export { commonCartridgeCsmProfile, extractCsmStandardCandidates } from './common-cartridge-csm.js';
export { savvasMyPerspectivesProfile } from './savvas-myperspectives.js';
export type {
	DetectionEvidence,
	QtiSourceProfile,
	SourceProfileMatch,
	StandardCandidate,
} from '@pie-qti/transform-types';

import { commonCartridgeCsmProfile } from './common-cartridge-csm.js';
import { savvasMyPerspectivesProfile } from './savvas-myperspectives.js';

export const defaultSourceProfiles = [
	commonCartridgeCsmProfile,
	savvasMyPerspectivesProfile,
] as const;
