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

/**
 * Structural equality of two variable values, for change detection on reads that may write
 * (a PCI-bound response adopting the mounted module's current response). Primitives compare
 * with Object.is — so File, Blob and Trusted Types payloads compare by identity, which can
 * only over-report a change, never miss one.
 */
export function qtiValueEquals(a: QtiValue | undefined, b: QtiValue | undefined): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	if (a.kind !== b.kind || a.baseType !== b.baseType || a.cardinality !== b.cardinality) return false;
	if (a.kind !== 'value' || b.kind !== 'value') return true;
	return payloadEquals(a.value, b.value);
}

function payloadEquals(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, index) => payloadEquals(item, b[index]));
	}
	if (a && b && typeof a === 'object' && typeof b === 'object') {
		const ka = Object.keys(a as Record<string, unknown>);
		const kb = Object.keys(b as Record<string, unknown>);
		if (ka.length !== kb.length) return false;
		return ka.every((key) =>
			payloadEquals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
		);
	}
	return false;
}

/** Typed arrays up to this many bytes diff bytewise; larger ones read as changed. */
const TYPED_ARRAY_DIFF_LIMIT = 4096;

/**
 * Structural equality of two public variable values (whatever qtiValueToPublic produced:
 * null, primitives, arrays, plain records, and the occasional non-plain leaf such as a File
 * or a drawing's typed arrays). Like payloadEquals for QtiValues, non-plain leaves compare
 * by identity, which can only over-report a change, never miss one. A typed array diffs
 * bytewise only while it is small; a large one (a canvas snapshot) reads as changed, because
 * diffing one per keystroke would cost what the comparison exists to save, and re-rendering
 * is always the safe reading.
 */
export function plainValueEquals(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		return (
			Array.isArray(a) &&
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((item, index) => plainValueEquals(item, b[index]))
		);
	}
	if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
		const viewA = a as ArrayBufferView;
		const viewB = b as ArrayBufferView;
		if (viewA.byteLength !== viewB.byteLength || viewA.byteLength > TYPED_ARRAY_DIFF_LIMIT) return false;
		const bytesA = new Uint8Array(viewA.buffer, viewA.byteOffset, viewA.byteLength);
		const bytesB = new Uint8Array(viewB.buffer, viewB.byteOffset, viewB.byteLength);
		for (let index = 0; index < bytesA.length; index++) {
			if (bytesA[index] !== bytesB[index]) return false;
		}
		return true;
	}
	if (a && b && typeof a === 'object' && typeof b === 'object') {
		const keysA = Object.keys(a as Record<string, unknown>);
		const keysB = Object.keys(b as Record<string, unknown>);
		if (keysA.length !== keysB.length) return false;
		return keysA.every((key) =>
			plainValueEquals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
		);
	}
	return false;
}
