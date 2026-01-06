/**
 * QTI variable declarations management
 * Ported from an earlier implementation
 */

import type { AreaMapping, Mapping, VariableDeclaration } from '../types/index.js';
import { BUILTIN_DECLARATIONS } from './constants.js';

/**
 * Declarations storage for an item or section
 */
export interface DeclarationsContext {
	declarations: Record<string, VariableDeclaration>;
}

/**
 * Initialize declarations for an element
 */
export function initializeDeclarations(declarations: Record<string, VariableDeclaration>): void {
	// Clone built-in declarations
	Object.keys(BUILTIN_DECLARATIONS).forEach((id) => {
		const builtinDecl = BUILTIN_DECLARATIONS[id];
		declarations[id] = { ...builtinDecl };
	});
}

/**
 * Add a response or outcome declaration
 */
export function addDeclaration(
	declarations: Record<string, VariableDeclaration>,
	identifier: string,
	baseType: VariableDeclaration['baseType'],
	cardinality: VariableDeclaration['cardinality'],
	defaultValue?: any
): void {
	const value = cardinality === 'multiple' ? [] : null;

	declarations[identifier] = {
		identifier,
		baseType,
		cardinality,
		value: defaultValue ?? value,
		defaultValue,
	};
}

/**
 * Add a mapping to a response declaration
 */
export function addMapping(
	declarations: Record<string, VariableDeclaration>,
	identifier: string,
	mapping: Mapping
): void {
	const decl = declarations[identifier];
	if (decl) {
		decl.mapping = mapping;
	}
}

/**
 * Add an area mapping to a response declaration
 */
export function addAreaMapping(
	declarations: Record<string, VariableDeclaration>,
	identifier: string,
	areaMapping: AreaMapping
): void {
	const decl = declarations[identifier];
	if (decl) {
		decl.areaMapping = areaMapping;
	}
}

/**
 * Get a variable value from declarations
 * @returns {any} QTI variables can hold any type
 */
export function getVariableValue(
	declarations: Record<string, VariableDeclaration>,
	identifier: string
): any {
	const decl = declarations[identifier];
	return decl ? decl.value : null;
}

/**
 * Set a variable value in declarations
 */
export function setVariableValue(
	declarations: Record<string, VariableDeclaration>,
	identifier: string,
	value: any
): void {
	const decl = declarations[identifier];
	if (decl) {
		const coerceScalar = (v: any) => {
			if (v === null || v === undefined) return v;
			const baseType = decl.baseType;
			if (baseType === 'integer' || baseType === 'float') {
				const n = Number(v);
				return Number.isNaN(n) ? v : n;
			}
			if (baseType === 'boolean') {
				if (typeof v === 'boolean') return v;
				if (typeof v === 'number') return v !== 0;
				if (typeof v === 'string') return v.trim().toLowerCase() === 'true';
				return Boolean(v);
			}
			if (
				baseType === 'string' ||
				baseType === 'identifier' ||
				baseType === 'uri' ||
				baseType === 'pair' ||
				baseType === 'directedPair' ||
				baseType === 'point'
			) {
				return typeof v === 'string' ? v.trim() : String(v);
			}
			return v;
		};

		if (decl.cardinality === 'multiple' || decl.cardinality === 'ordered') {
			if (Array.isArray(value)) {
				decl.value = value.map(coerceScalar);
			} else if (value === null || value === undefined) {
				decl.value = [];
			} else {
				decl.value = [coerceScalar(value)];
			}
		} else {
			decl.value = coerceScalar(value);
		}
	}
}

/**
 * Reset declarations to default values
 */
export function resetDeclarations(declarations: Record<string, VariableDeclaration>): void {
	Object.values(declarations).forEach((decl) => {
		if (decl.defaultValue !== undefined) {
			decl.value = decl.defaultValue;
		} else if (decl.cardinality === 'multiple') {
			decl.value = [];
		} else {
			decl.value = null;
		}
	});
}

/**
 * Clone declarations (useful for creating new sessions)
 */
export function cloneDeclarations(
	source: Record<string, VariableDeclaration>
): Record<string, VariableDeclaration> {
	const result: Record<string, VariableDeclaration> = {};

	Object.keys(source).forEach((id) => {
		const decl = source[id];
		result[id] = {
			...decl,
			value:
				decl.cardinality === 'multiple' && Array.isArray(decl.value) ? [...decl.value] : decl.value,
		};
	});

	return result;
}
