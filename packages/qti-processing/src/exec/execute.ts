import type { ProcessingProgram, StatementNode } from '../ast/types.js';
import type { QtiValue } from '../runtime/types.js';
import type { EvalEnv } from '../eval/evaluator.js';
import { applyLookupTable, evalExpr } from '../eval/evaluator.js';
import type { DeclarationContext } from '../runtime/context.js';
import { qtiInvalid, qtiNull, qtiValue, toBoolean } from '../runtime/value.js';

export interface ExecEnv extends EvalEnv {
	ctx: DeclarationContext;
}

class QtiExit extends Error {
	constructor(
		public readonly scope: 'response' | 'template' | 'test',
	) {
		super(`QTI exit (${scope})`);
	}
}

class QtiTemplateConstraintRestart extends Error {
	constructor(public readonly constraintId: string) {
		super(`QTI templateConstraint restart (${constraintId})`);
	}
}

export function execProgram(env: ExecEnv, program: ProcessingProgram): void {
	const MAX_TEMPLATE_CONSTRAINT_ITERATIONS = 100;
	const constraintAttempts = new Map<string, number>();
	// Only template processing can restart, so only a program with a constraint pays for the
	// snapshot a restart restores.
	const beforeProcessing = containsTemplateConstraint(program.statements)
		? snapshotDeclarations(env.ctx)
		: undefined;

	let i = 0;
	while (i < program.statements.length) {
		try {
			execStatement(env, program.statements[i]!);
			i++;
		} catch (e) {
			if (e instanceof QtiExit) return;

			if (e instanceof QtiTemplateConstraintRestart) {
				// QTI ASI §10.3: a false (or NULL) constraint restarts templateProcessing. The
				// rejected pass is discarded, not built upon: every declaration returns to its
				// state before processing began — values, defaults changed by setDefaultValue,
				// correct responses changed by setCorrectResponse — and template variables to
				// their defaults. We cap retries to avoid endless loops; after the max is reached
				// we keep that state and continue after the failing templateConstraint.
				const next = (constraintAttempts.get(e.constraintId) ?? 0) + 1;
				constraintAttempts.set(e.constraintId, next);

				if (beforeProcessing) restoreDeclarations(env.ctx, beforeProcessing);
				resetTemplateVarsToDefault(env.ctx);

				if (next >= MAX_TEMPLATE_CONSTRAINT_ITERATIONS) {
					i++; // continue after the templateConstraint
				} else {
					i = 0; // restart templateProcessing from the beginning
				}
				continue;
			}

			throw e;
		}
	}
}

export function execStatement(env: ExecEnv, s: StatementNode): void {
	switch (s.kind) {
		case 'stmt.exitResponse': {
			throw new QtiExit('response');
		}
		case 'stmt.exitTemplate': {
			throw new QtiExit('template');
		}
		case 'stmt.exitTest': {
			// This is primarily meaningful at test-processing scope.
			// For the item-only player, the best approximation is to stop executing the current program.
			throw new QtiExit('test');
		}
		case 'stmt.setOutcomeValue': {
			const v = evalExpr(env, s.expr);
			env.ctx.setValue(s.identifier, v);
			return;
		}
		case 'stmt.lookupOutcomeValue': {
			const d = env.ctx.getDeclaration(s.identifier);
			if (!d?.lookupTable) {
				env.ctx.setValue(s.identifier, qtiInvalid('lookupOutcomeValue requires matchTable/interpolationTable on outcomeDeclaration'));
				return;
			}
			const source = evalExpr(env, s.expr);
			const v = applyLookupTable(source, d.lookupTable, d.baseType);
			env.ctx.setValue(s.identifier, v);
			return;
		}
		case 'stmt.setTemplateValue': {
			const v = evalExpr(env, s.expr);
			env.ctx.setValue(s.identifier, v);
			return;
		}
		case 'stmt.setCorrectResponse': {
			const v = evalExpr(env, s.expr);
			env.ctx.setCorrectResponse(s.identifier, v);
			return;
		}
		case 'stmt.setDefaultValue': {
			// QTI ASI §10.3: setDefaultValue carries an expression that CHANGES the
			// variable's default value; later resets use the new default (§5.1).
			const v = evalExpr(env, s.expr);
			env.ctx.setDefaultValue(s.identifier, v);
			return;
		}
		case 'stmt.templateConstraint': {
			const cond = evalExpr(env, s.expr);
			const ok = toBoolean(cond);
			if (ok) return;
			throw new QtiTemplateConstraintRestart(s.id);
		}
		case 'stmt.responseCondition': {
			execCondition(env, s);
			return;
		}
		case 'stmt.outcomeCondition': {
			execCondition(env, s);
			return;
		}
		case 'stmt.templateCondition': {
			execCondition(env, s);
			return;
		}
		default:
			// fail loudly for unhandled statements
			throw new Error(`Unhandled statement kind: ${(s as any).kind}`);
	}
}

function execCondition(env: ExecEnv, s: { ifBranch?: any; elseIfBranches: any[]; elseBranch?: any }): void {
	const testBranch = (branch: { condition: any; statements: StatementNode[] }) => {
		const cond = evalExpr(env, branch.condition);
		const ok = toBoolean(cond);
		if (!ok) return false;
		for (const st of branch.statements) execStatement(env, st);
		return true;
	};

	if (s.ifBranch && testBranch(s.ifBranch)) return;
	for (const b of s.elseIfBranches || []) {
		if (testBranch(b)) return;
	}
	if (s.elseBranch) {
		for (const st of s.elseBranch.statements) execStatement(env, st);
	}
}

function resetTemplateVarsToDefault(ctx: DeclarationContext): void {
	const decls = ctx.getAll();
	for (const d of Object.values(decls)) {
		if (!d?.isTemplate) continue;
		ctx.resetToDefault(d.identifier);
	}
}

/** The declaration fields template rules write, as one declaration held them. */
interface DeclarationFields {
	value: QtiValue;
	defaultValue?: QtiValue;
	correctResponse?: QtiValue;
}

function containsTemplateConstraint(statements: readonly StatementNode[]): boolean {
	return statements.some((s) => {
		if (s.kind === 'stmt.templateConstraint') return true;
		if (s.kind !== 'stmt.templateCondition') return false;
		return [s.ifBranch, ...s.elseIfBranches, s.elseBranch].some(
			(branch) => branch !== undefined && containsTemplateConstraint(branch.statements),
		);
	});
}

function snapshotDeclarations(ctx: DeclarationContext): Map<string, DeclarationFields> {
	const snapshot = new Map<string, DeclarationFields>();
	for (const [id, d] of Object.entries(ctx.getAll())) {
		if (!d) continue;
		const fields = d as DeclarationFields;
		snapshot.set(id, {
			value: cloneValue(fields.value),
			defaultValue: fields.defaultValue && cloneValue(fields.defaultValue),
			correctResponse: fields.correctResponse && cloneValue(fields.correctResponse),
		});
	}
	return snapshot;
}

function restoreDeclarations(ctx: DeclarationContext, snapshot: ReadonlyMap<string, DeclarationFields>): void {
	const decls = ctx.getAll();
	for (const [id, saved] of snapshot) {
		const d = decls[id] as DeclarationFields | undefined;
		if (!d) continue;
		d.value = cloneValue(saved.value);
		if (saved.defaultValue) d.defaultValue = cloneValue(saved.defaultValue);
		else delete d.defaultValue;
		if (saved.correctResponse) d.correctResponse = cloneValue(saved.correctResponse);
		else delete d.correctResponse;
	}
}

/** Detach a value from the declaration that held it: containers and records copy, files stay shared. */
function cloneValue(value: QtiValue): QtiValue {
	return cloneData(value) as QtiValue;
}

function cloneData(data: unknown): unknown {
	if (Array.isArray(data)) return data.map(cloneData);
	if (data !== null && typeof data === 'object' && Object.getPrototypeOf(data) === Object.prototype) {
		return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, cloneData(item)]));
	}
	return data;
}


