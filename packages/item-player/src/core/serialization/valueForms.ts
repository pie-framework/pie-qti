/**
 * The value forms a session's variables take outside the engine: the serialized snapshot
 * form (records keep each field's base type and cardinality), the public form (records as
 * plain nested values), and the PCI form (the public value, except records, which keep
 * their serialized form so a host can write them into QTI variable JSON).
 */
import type { QtiValue } from '@pie-qti/qti-processing';
import { cloneValue } from '../../utils/cloneFreeze.js';

export function qtiValueToSerializable(value: QtiValue | undefined): any {
	if (!value || value.kind !== 'value') return null;
	if (value.cardinality !== 'record') return cloneValue(value.value);

	const serialized: Record<string, unknown> = {};
	for (const [fieldIdentifier, fieldValue] of Object.entries(value.value as Record<string, QtiValue>)) {
		serialized[fieldIdentifier] = {
			...(fieldValue.baseType ? { baseType: fieldValue.baseType } : {}),
			cardinality: fieldValue.cardinality ?? 'single',
			value: qtiValueToSerializable(fieldValue),
		};
	}
	return serialized;
}

/**
 * A value as a PCI host receives it: the public value, except that a record keeps each field's
 * base type and cardinality (its serialized form). A record declaration types none of its
 * fields, so the host could not write them into QTI variable JSON otherwise.
 */
export function qtiValueToPci(value: QtiValue | undefined): unknown {
	return value?.kind === 'value' && value.cardinality === 'record'
		? qtiValueToSerializable(value)
		: qtiValueToPublic(value);
}

export function qtiValueToPublic(value: QtiValue | undefined): any {
	if (!value || value.kind !== 'value') return null;
	if (value.cardinality !== 'record') return cloneValue(value.value);

	const record: Record<string, unknown> = {};
	for (const [fieldIdentifier, fieldValue] of Object.entries(value.value as Record<string, QtiValue>)) {
		record[fieldIdentifier] = qtiValueToPublic(fieldValue);
	}
	return record;
}
