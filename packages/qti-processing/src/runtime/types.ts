export type Cardinality = 'single' | 'multiple' | 'ordered' | 'record';

export type BaseType =
	| 'boolean'
	| 'integer'
	| 'float'
	| 'string'
	| 'identifier'
	| 'uri'
	| 'pair'
	| 'directedPair'
	| 'point'
	| 'duration'
	| 'file';

export type QtiValue =
	| {
			kind: 'null';
			baseType?: BaseType;
			cardinality?: Cardinality;
	  }
	| {
			kind: 'value';
			baseType?: BaseType;
			cardinality: Cardinality;
			value: unknown;
	  }
	| {
			kind: 'invalid';
			message: string;
			baseType?: BaseType;
			cardinality?: Cardinality;
	  };

export interface MappingEntry {
	mapKey: string;
	mappedValue: number;
	caseSensitive?: string;
}

export interface Mapping {
	defaultValue: number;
	entries: Record<string, MappingEntry>;
	lowerBound?: number;
	upperBound?: number;
}

export interface Declaration {
	identifier: string;
	/** Omitted for record cardinality, as required by QTI. */
	baseType?: BaseType;
	cardinality: Cardinality;
	/**
	 * The variable's default value: parsed from the declaration's <defaultValue>, and changed by
	 * the <setDefaultValue> template rule (QTI ASI §10.3). Resets of the variable use it (§5.1).
	 */
	defaultValue: QtiValue;
	value: QtiValue;
	correctResponse?: QtiValue;
	mapping?: Mapping;
	/**
	 * QTI "lookup table" attached to an outcomeDeclaration (matchTable or interpolationTable).
	 * Used by the lookupOutcomeValue rule.
	 */
	lookupTable?: LookupTableTable;
	areaMapping?: AreaMapping;
	isTemplate?: boolean;
	/**
	 * True when `defaultValue` is the 0 that QTI implies for a numeric outcome with no declared
	 * `<defaultValue>`, rather than a value the author wrote. Lets callers tell "the author chose 0"
	 * apart from "nothing was declared" when reporting on under-specified content.
	 */
	impliedNumericDefault?: boolean;
}

export type DeclarationMap = Record<string, Declaration>;

export type LookupTableTable = MatchTableDef | InterpolationTableDef;

/** Target and default values keep their lexical form; lookup coerces them to the outcome's base type. */
export interface MatchTableDef {
	kind: 'table.matchTable';
	defaultValue?: string;
	entries: Array<{ sourceValue: string; targetValue: string }>;
}

/** Entries in document order; `includeBoundary` (default true) decides whether an exact match hits. */
export interface InterpolationTableDef {
	kind: 'table.interpolationTable';
	defaultValue?: string;
	entries: Array<{ sourceValue: number; targetValue: string; includeBoundary?: boolean }>;
}

export interface AreaMapEntry {
	shape: 'circle' | 'rect' | 'poly' | 'ellipse' | 'default';
	coords: string;
	mappedValue: number;
}

export interface AreaMapping {
	defaultValue: number;
	entries: AreaMapEntry[];
	lowerBound?: number;
	upperBound?: number;
}

