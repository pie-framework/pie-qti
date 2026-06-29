import type { QTIRole } from '../types/index.js';

/**
 * Product policy layered on top of QTI role/view semantics.
 *
 * QTI defines these roles as audience markers for view-controlled content
 * (for example rubric/outcome visibility). It does not define a universal
 * interaction UI behavior matrix. The player policy below keeps runtime
 * behavior explicit and consistent across integrations.
 */
export interface RoleCapabilities {
	isCandidate: boolean;
	isReadOnly: boolean;
	canViewCorrectResponses: boolean;
}

const ROLES_WITH_CORRECT_RESPONSE_ACCESS: ReadonlySet<QTIRole> = new Set([
	'scorer',
	'author',
	'tutor',
	'testConstructor',
]);

export function getRoleCapabilities(role: QTIRole): RoleCapabilities {
	const isCandidate = role === 'candidate';
	const canViewCorrectResponses = ROLES_WITH_CORRECT_RESPONSE_ACCESS.has(role);

	return {
		isCandidate,
		isReadOnly: !isCandidate,
		canViewCorrectResponses,
	};
}

