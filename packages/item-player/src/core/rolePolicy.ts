import { warnOnce } from '@pie-qti/qti-common';
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

/** The one role list, shared by every player element that exposes `qti-role`. */
export const QTI_ROLES: readonly QTIRole[] = [
	'candidate',
	'scorer',
	'proctor',
	'testConstructor',
	'tutor',
	'author',
];

export function isQtiRole(value: string): value is QTIRole {
	return (QTI_ROLES as readonly string[]).includes(value);
}

/** Unknown values never make the player silently read-only: they render as `candidate`. */
export function parseQtiRole(value: string | null | undefined): QTIRole {
	const role = value ?? 'candidate';
	if (isQtiRole(role)) return role;
	warnOnce(
		'pie-qti:unknown-role',
		`Unknown player role '${role}': the player renders as 'candidate'. Accepted values are ${QTI_ROLES.join(', ')}, set with the qti-role attribute or the role property.`,
	);
	return 'candidate';
}
