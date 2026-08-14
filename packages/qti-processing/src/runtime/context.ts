import type { Declaration, DeclarationMap, QtiValue } from './types.js';
import { qtiNull } from './value.js';

export class DeclarationContext {
	private decls: DeclarationMap;

	constructor(decls: DeclarationMap) {
		this.decls = decls;
	}

	getDeclaration(id: string): Declaration | undefined {
		return this.decls[id];
	}

	getValue(id: string): QtiValue {
		return this.decls[id]?.value ?? qtiNull();
	}

	getDefaultValue(id: string): QtiValue {
		return this.decls[id]?.defaultValue ?? qtiNull();
	}

	setValue(id: string, value: QtiValue): void {
		const d = this.decls[id];
		if (!d) return;
		d.value = conformNumericBaseType(value, d);
	}

	resetToDefault(id: string): void {
		const d = this.decls[id];
		if (!d) return;
		// defaultValue is optional in declarations; missing defaults reset to NULL.
		const dv = d.defaultValue ?? qtiNull(d.baseType, d.cardinality);
		d.value = cloneQtiValue(dv);
	}

	getCorrectResponse(id: string): QtiValue {
		return this.decls[id]?.correctResponse ?? qtiNull();
	}

	setCorrectResponse(id: string, value: QtiValue): void {
		const d = this.decls[id];
		if (!d) return;
		d.correctResponse = value;
	}

	getAll(): DeclarationMap {
		return this.decls;
	}
}

/**
 * A variable holds values of its declared base-type. Numeric operators are allowed to widen
 * (integer + integer may yield float), so an assignment can arrive one numeric type away from
 * the declaration — and `match` is base-type strict, so an integer variable holding a float
 * silently stops matching integers. Restamp those; leave a fractional value assigned to an
 * integer declaration alone, since that is an authoring error the item should surface, not
 * something to round away.
 */
function conformNumericBaseType(value: QtiValue, declaration: Declaration): QtiValue {
	if (value.kind !== 'value') return value;
	const declared = declaration.baseType;
	if (declared !== 'integer' && declared !== 'float') return value;
	if (value.baseType !== 'integer' && value.baseType !== 'float') return value;
	if (value.baseType === declared) return value;
	if (typeof value.value !== 'number' || !Number.isFinite(value.value)) return value;
	if (declared === 'integer' && !Number.isInteger(value.value)) return value;
	return { ...value, baseType: declared };
}

function cloneQtiValue(v: QtiValue): QtiValue {
	if (v.kind !== 'value') return v;
	if (Array.isArray(v.value)) {
		return { ...v, value: [...v.value] };
	}
	if (v.value && typeof v.value === 'object') {
		// Best-effort shallow clone; most QTI value shapes here are primitives/arrays.
		return { ...v, value: { ...(v.value as any) } };
	}
	return v;
}


