export type Cardinality = 'single' | 'multiple' | 'ordered';

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
	| 'file'
	| 'record';

export type QtiValue =
	| {
			kind: 'null';
			baseType?: BaseType;
			cardinality?: Cardinality;
	  }
	| {
			kind: 'value';
			baseType: BaseType;
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
	/**
	 * QTI attribute on <mapping>. When "false", string mappings are case-insensitive by default.
	 */
	caseSensitive?: string;
}

export interface Declaration {
	identifier: string;
	baseType: BaseType;
	cardinality: Cardinality;
	/**
	 * Parsed <defaultValue> from the declaration. Used by <setDefaultValue> to reset the variable.
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
}

export type DeclarationMap = Record<string, Declaration>;

export type LookupTableTable = MatchTableDef | InterpolationTableDef;

export interface MatchTableDef {
	kind: 'table.matchTable';
	defaultValue?: number;
	entries: Array<{ sourceValue: string; targetValue: string }>;
}

export interface InterpolationTableDef {
	kind: 'table.interpolationTable';
	defaultValue?: number;
	interpolationMethod?: string;
	entries: Array<{ sourceValue: number; targetValue: number }>;
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


