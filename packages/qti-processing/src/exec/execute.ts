import type { ProcessingProgram, StatementNode } from '../ast/types.js';
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

	let i = 0;
	while (i < program.statements.length) {
		try {
			execStatement(env, program.statements[i]!);
			i++;
		} catch (e) {
			if (e instanceof QtiExit) return;

			if (e instanceof QtiTemplateConstraintRestart) {
				// Spec: if the constraint is false (including NULL), reset template variables to default and restart.
				// We cap retries to avoid endless loops; after the max is reached we keep defaults and continue
				// after the failing templateConstraint.
				const next = (constraintAttempts.get(e.constraintId) ?? 0) + 1;
				constraintAttempts.set(e.constraintId, next);

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
			const v = applyLookupTable(source, d.lookupTable);
			env.ctx.setValue(s.identifier, v);
			return;
		}
		case 'stmt.setResponseValue': {
			const v = evalExpr(env, s.expr);
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
			env.ctx.resetToDefault(s.identifier);
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


