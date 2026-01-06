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
		d.value = value;
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


