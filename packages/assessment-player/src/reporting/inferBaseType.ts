import type { ResultBaseType } from './types.js';

/**
 * The base type of a report value that no declaration and no serialized field types: a boolean is
 * a QTI boolean, a whole number an integer (the base type whose value space whole numbers live in),
 * a fractional number a float, anything else a string. A list types itself by its members:
 * integer only when every member is a whole number, float when any member is fractional, else the
 * first member's type (so `[3, 4]` is integer while `[3, 3.5]` stays float and loses nothing).
 *
 * One rule shared by every report writer, so an undeclared value writes the same base type
 * whichever writer reports it — `toAssessmentResultXml` and `serializeAssessmentResult` both
 * delegate here.
 */
export function inferBaseType(value: unknown): ResultBaseType {
	if (Array.isArray(value)) {
		const members = value.filter((entry) => entry !== null && entry !== undefined);
		if (members.length > 0 && members.every((entry) => typeof entry === 'number')) {
			return members.every((entry) => Number.isInteger(entry)) ? 'integer' : 'float';
		}
		return members.length > 0 ? inferBaseType(members[0]!) : 'string';
	}
	if (typeof value === 'boolean') return 'boolean';
	if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float';
	return 'string';
}
