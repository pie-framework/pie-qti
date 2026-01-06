import type { InterpolationTableDef, MatchTableDef } from '../runtime/types.js';

export type AstNodeId = string;

export type ProcessingProgram = {
	kind: 'program';
	id: AstNodeId;
	statements: StatementNode[];
};

export type StatementNode =
	| ResponseConditionStmt
	| OutcomeConditionStmt
	| ExitTestStmt
	| ExitResponseStmt
	| ExitTemplateStmt
	| TemplateConstraintStmt
	| SetDefaultValueStmt
	| LookupOutcomeValueStmt
	| SetOutcomeValueStmt
	| SetResponseValueStmt
	| SetTemplateValueStmt
	| SetCorrectResponseStmt
	| TemplateConditionStmt;

export type ExpressionNode =
	| BaseValueExpr
	| NullExpr
	| VariableExpr
	| CorrectExpr
	| DefaultExpr
	| TestVariablesExpr
	| OutcomeMinimumExpr
	| OutcomeMaximumExpr
	| NumberCorrectExpr
	| NumberIncorrectExpr
	| NumberPresentedExpr
	| NumberRespondedExpr
	| NumberSelectedExpr
	| CustomOperatorExpr
	| PreConditionExpr
	| RandomExpr
	| MatchExpr
	| EqualExpr
	| EqualRoundedExpr
	| NotEqualExpr
	| MemberExpr
	| ContainsExpr
	| ContainerSizeExpr
	| IndexExpr
	| OrderedExpr
	| MultipleExpr
	| RepeatExpr
	| DeleteExpr
	| InsideExpr
	| DurationLTExpr
	| DurationGTEExpr
	| StatsOperatorExpr
	| RecordExpr
	| FieldValueExpr
	| SubstringExpr
	| LookupTableExpr
	| PowerExpr
	| ModExpr
	| IntegerDivideExpr
	| MeanExpr
	| SampleVarianceExpr
	| SampleSDExpr
	| PopVarianceExpr
	| PopSDExpr
	| IsTypeOfExpr
	| StringMatchExpr
	| PatternMatchExpr
	| IsNullExpr
	| IsNotNullExpr
	| LtExpr
	| LteExpr
	| GtExpr
	| GteExpr
	| AndExpr
	| OrExpr
	| NotExpr
	| AnyNExpr
	| AllNExpr
	| SumExpr
	| SubtractExpr
	| ProductExpr
	| DivideExpr
	| MaxExpr
	| MinExpr
	| RoundExpr
	| TruncateExpr
	| MapResponseExpr
	| MapOutcomeExpr
	| MapResponsePointExpr
	| RandomExpr
	| RandomIntegerExpr
	| RandomFloatExpr
	| MathConstantExpr
	| RoundToExpr
	| MathOperatorExpr
	| IntegerModulusExpr
	| IntegerToFloatExpr
	| GcdExpr
	| LcmExpr;

export type ResponseConditionStmt = {
	kind: 'stmt.responseCondition';
	id: AstNodeId;
	ifBranch?: { condition: ExpressionNode; statements: StatementNode[] };
	elseIfBranches: Array<{ condition: ExpressionNode; statements: StatementNode[] }>;
	elseBranch?: { statements: StatementNode[] };
};

export type OutcomeConditionStmt = {
	kind: 'stmt.outcomeCondition';
	id: AstNodeId;
	ifBranch?: { condition: ExpressionNode; statements: StatementNode[] };
	elseIfBranches: Array<{ condition: ExpressionNode; statements: StatementNode[] }>;
	elseBranch?: { statements: StatementNode[] };
};

export type TemplateConditionStmt = {
	kind: 'stmt.templateCondition';
	id: AstNodeId;
	ifBranch?: { condition: ExpressionNode; statements: StatementNode[] };
	elseIfBranches: Array<{ condition: ExpressionNode; statements: StatementNode[] }>;
	elseBranch?: { statements: StatementNode[] };
};

export type SetOutcomeValueStmt = {
	kind: 'stmt.setOutcomeValue';
	id: AstNodeId;
	identifier: string;
	expr: ExpressionNode;
};

export type LookupOutcomeValueStmt = {
	kind: 'stmt.lookupOutcomeValue';
	id: AstNodeId;
	identifier: string;
	expr: ExpressionNode;
};

export type SetResponseValueStmt = {
	kind: 'stmt.setResponseValue';
	id: AstNodeId;
	identifier: string;
	expr: ExpressionNode;
};

export type SetTemplateValueStmt = {
	kind: 'stmt.setTemplateValue';
	id: AstNodeId;
	identifier: string;
	expr: ExpressionNode;
};

export type SetCorrectResponseStmt = {
	kind: 'stmt.setCorrectResponse';
	id: AstNodeId;
	identifier: string;
	expr: ExpressionNode;
};

export type SetDefaultValueStmt = {
	kind: 'stmt.setDefaultValue';
	id: AstNodeId;
	identifier: string;
};

export type ExitResponseStmt = {
	kind: 'stmt.exitResponse';
	id: AstNodeId;
};

export type ExitTemplateStmt = {
	kind: 'stmt.exitTemplate';
	id: AstNodeId;
};

export type ExitTestStmt = {
	kind: 'stmt.exitTest';
	id: AstNodeId;
};

export type TemplateConstraintStmt = {
	kind: 'stmt.templateConstraint';
	id: AstNodeId;
	expr: ExpressionNode;
};

export type BaseValueExpr = {
	kind: 'expr.baseValue';
	id: AstNodeId;
	baseType: string;
	text: string;
};

export type NullExpr = {
	kind: 'expr.null';
	id: AstNodeId;
};

export type VariableExpr = {
	kind: 'expr.variable';
	id: AstNodeId;
	identifier: string;
};

export type CorrectExpr = {
	kind: 'expr.correct';
	id: AstNodeId;
	identifier: string;
};

export type DefaultExpr = {
	kind: 'expr.default';
	id: AstNodeId;
	identifier: string;
};

export type TestLevelFilterAttrs = {
	sectionIdentifier?: string;
	includeCategory?: string[];
	excludeCategory?: string[];
	weightIdentifier?: string;
};

/**
 * Test-level: look up an item variable across a subset of items.
 * Result is multiple cardinality; baseType is controlled by baseType attribute.
 */
export type TestVariablesExpr = {
	kind: 'expr.testVariables';
	id: AstNodeId;
	variableIdentifier: string;
	baseType?: string;
} & TestLevelFilterAttrs;

/**
 * Test-level: min/max of an outcome variable across a subset of items.
 */
export type OutcomeMinimumExpr = {
	kind: 'expr.outcomeMinimum';
	id: AstNodeId;
	outcomeIdentifier: string;
} & TestLevelFilterAttrs;

export type OutcomeMaximumExpr = {
	kind: 'expr.outcomeMaximum';
	id: AstNodeId;
	outcomeIdentifier: string;
} & TestLevelFilterAttrs;

export type NumberCorrectExpr = { kind: 'expr.numberCorrect'; id: AstNodeId } & Omit<TestLevelFilterAttrs, 'weightIdentifier'>;
export type NumberIncorrectExpr = { kind: 'expr.numberIncorrect'; id: AstNodeId } & Omit<TestLevelFilterAttrs, 'weightIdentifier'>;
export type NumberPresentedExpr = { kind: 'expr.numberPresented'; id: AstNodeId } & Omit<TestLevelFilterAttrs, 'weightIdentifier'>;
export type NumberRespondedExpr = { kind: 'expr.numberResponded'; id: AstNodeId } & Omit<TestLevelFilterAttrs, 'weightIdentifier'>;
export type NumberSelectedExpr = { kind: 'expr.numberSelected'; id: AstNodeId } & Omit<TestLevelFilterAttrs, 'weightIdentifier'>;

export type CustomOperatorExpr = {
	kind: 'expr.customOperator';
	id: AstNodeId;
	class?: string;
	definition?: string;
	values: ExpressionNode[];
};

/**
 * preCondition is a LogicSingle wrapper used by the QTI spec.
 * We treat it as a boolean-context wrapper around its child expression.
 */
export type PreConditionExpr = {
	kind: 'expr.preCondition';
	id: AstNodeId;
	expr: ExpressionNode;
};

export type RandomExpr = {
	kind: 'expr.random';
	id: AstNodeId;
	value: ExpressionNode;
};

export type MatchExpr = {
	kind: 'expr.match';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
};

export type EqualExpr = {
	kind: 'expr.equal';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
	/**
	 * QTI numeric tolerance attributes (primarily for float comparisons).
	 * If omitted, behaves like strict equality.
	 */
	toleranceMode?: 'exact' | 'absolute' | 'relative';
	/**
	 * 0..2 floatOrVariableRef values. If a single value is provided it is treated as symmetric.
	 */
	tolerance?: string[];
	includeLowerBound?: boolean;
	includeUpperBound?: boolean;
};

export type EqualRoundedExpr = {
	kind: 'expr.equalRounded';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
	/**
	 * QTI 2.2.2 roundingMode for equalRounded.
	 */
	roundingMode: 'decimalPlaces' | 'significantFigures';
	/**
	 * integerOrVariableRef as a string (we resolve at eval time).
	 */
	figures: string;
};

export type NotEqualExpr = {
	kind: 'expr.notEqual';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
};

export type MemberExpr = {
	kind: 'expr.member';
	id: AstNodeId;
	value: ExpressionNode;
	container: ExpressionNode;
};

export type ContainsExpr = {
	kind: 'expr.contains';
	id: AstNodeId;
	container: ExpressionNode;
	value: ExpressionNode;
};

export type ContainerSizeExpr = {
	kind: 'expr.containerSize';
	id: AstNodeId;
	container: ExpressionNode;
};

export type IndexExpr = {
	kind: 'expr.index';
	id: AstNodeId;
	container: ExpressionNode;
	index: ExpressionNode;
};

export type OrderedExpr = {
	kind: 'expr.ordered';
	id: AstNodeId;
	values: ExpressionNode[];
};

export type MultipleExpr = {
	kind: 'expr.multiple';
	id: AstNodeId;
	values: ExpressionNode[];
};

export type RepeatExpr = {
	kind: 'expr.repeat';
	id: AstNodeId;
	numberRepeats: number | string; // xs:int or variable identifier (NCName)
	values: ExpressionNode[]; // 1..N
};

export type DeleteExpr = {
	kind: 'expr.delete';
	id: AstNodeId;
	container: ExpressionNode;
	value: ExpressionNode;
};

export type InsideExpr = {
	kind: 'expr.inside';
	id: AstNodeId;
	shape: 'circle' | 'default' | 'ellipse' | 'poly' | 'rect';
	coords: string;
	value: ExpressionNode;
};

export type DurationLTExpr = {
	kind: 'expr.durationLT';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
};

export type DurationGTEExpr = {
	kind: 'expr.durationGTE';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
};

export type StatsOperatorExpr = {
	kind: 'expr.statsOperator';
	id: AstNodeId;
	name: 'mean' | 'sampleVariance' | 'sampleSD' | 'popVariance' | 'popSD';
	values: ExpressionNode;
};

export type RecordExpr = {
	kind: 'expr.record';
	id: AstNodeId;
	fields: Array<{ fieldIdentifier: string; value: ExpressionNode }>;
};

export type FieldValueExpr = {
	kind: 'expr.fieldValue';
	id: AstNodeId;
	fieldIdentifier: string;
	record: ExpressionNode;
};

export type SubstringExpr = {
	kind: 'expr.substring';
	id: AstNodeId;
	value: ExpressionNode;
	start: ExpressionNode;
	length?: ExpressionNode;
};

export type LookupTableExpr = {
	kind: 'expr.lookupTable';
	id: AstNodeId;
	source: ExpressionNode;
	table: MatchTableDef | InterpolationTableDef;
};

export type PowerExpr = {
	kind: 'expr.power';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
};

export type ModExpr = {
	kind: 'expr.mod';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
};

export type IntegerDivideExpr = {
	kind: 'expr.integerDivide';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
};

export type MeanExpr = {
	kind: 'expr.mean';
	id: AstNodeId;
	values: ExpressionNode;
};

export type SampleVarianceExpr = {
	kind: 'expr.sampleVariance';
	id: AstNodeId;
	values: ExpressionNode;
};

export type SampleSDExpr = {
	kind: 'expr.sampleSD';
	id: AstNodeId;
	values: ExpressionNode;
};

export type PopVarianceExpr = {
	kind: 'expr.popVariance';
	id: AstNodeId;
	values: ExpressionNode;
};

export type PopSDExpr = {
	kind: 'expr.popSD';
	id: AstNodeId;
	values: ExpressionNode;
};

export type IsTypeOfExpr = {
	kind: 'expr.isTypeOf';
	id: AstNodeId;
	value: ExpressionNode;
	baseType: ExpressionNode;
};

export type StringMatchExpr = {
	kind: 'expr.stringMatch';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
	caseSensitive: boolean;
	substring: boolean;
};

export type PatternMatchExpr = {
	kind: 'expr.patternMatch';
	id: AstNodeId;
	value: ExpressionNode;
	pattern: ExpressionNode;
	caseSensitive: boolean;
};

export type IsNullExpr = {
	kind: 'expr.isNull';
	id: AstNodeId;
	expr: ExpressionNode;
};

export type IsNotNullExpr = {
	kind: 'expr.isNotNull';
	id: AstNodeId;
	expr: ExpressionNode;
};

export type LtExpr = { kind: 'expr.lt'; id: AstNodeId; a: ExpressionNode; b: ExpressionNode };
export type LteExpr = { kind: 'expr.lte'; id: AstNodeId; a: ExpressionNode; b: ExpressionNode };
export type GtExpr = { kind: 'expr.gt'; id: AstNodeId; a: ExpressionNode; b: ExpressionNode };
export type GteExpr = { kind: 'expr.gte'; id: AstNodeId; a: ExpressionNode; b: ExpressionNode };

export type AndExpr = { kind: 'expr.and'; id: AstNodeId; ops: ExpressionNode[] };
export type OrExpr = { kind: 'expr.or'; id: AstNodeId; ops: ExpressionNode[] };
export type NotExpr = { kind: 'expr.not'; id: AstNodeId; expr: ExpressionNode };

export type AnyNExpr = {
	kind: 'expr.anyN';
	id: AstNodeId;
	min: number;
	max: number;
	ops: ExpressionNode[];
};

// Historical/non-standard helper used in some older QTI engines:
// "at most max operands are true" (equivalent to anyN with min=0 and a max bound).
export type AllNExpr = { kind: 'expr.allN'; id: AstNodeId; max: number; ops: ExpressionNode[] };

export type SumExpr = { kind: 'expr.sum'; id: AstNodeId; values: ExpressionNode[] };
export type SubtractExpr = { kind: 'expr.subtract'; id: AstNodeId; a: ExpressionNode; b: ExpressionNode };
export type ProductExpr = { kind: 'expr.product'; id: AstNodeId; values: ExpressionNode[] };
export type DivideExpr = { kind: 'expr.divide'; id: AstNodeId; a: ExpressionNode; b: ExpressionNode };

export type MaxExpr = { kind: 'expr.max'; id: AstNodeId; values: ExpressionNode[] };
export type MinExpr = { kind: 'expr.min'; id: AstNodeId; values: ExpressionNode[] };
export type RoundExpr = { kind: 'expr.round'; id: AstNodeId; value: ExpressionNode };
export type TruncateExpr = { kind: 'expr.truncate'; id: AstNodeId; value: ExpressionNode };

export type MapResponseExpr = { kind: 'expr.mapResponse'; id: AstNodeId; identifier: string };

export type MapOutcomeExpr = { kind: 'expr.mapOutcome'; id: AstNodeId; identifier: string };

export type MapResponsePointExpr = { kind: 'expr.mapResponsePoint'; id: AstNodeId; identifier: string };

export type RandomIntegerExpr = {
	kind: 'expr.randomInteger';
	id: AstNodeId;
	min: ExpressionNode;
	max: ExpressionNode;
	step?: ExpressionNode; // QTI 2.2.2: optional, defaults to 1
};

export type RandomFloatExpr = {
	kind: 'expr.randomFloat';
	id: AstNodeId;
	min: ExpressionNode;
	max: ExpressionNode;
};

export type MathConstantExpr = {
	kind: 'expr.mathConstant';
	id: AstNodeId;
	name: 'pi' | 'e';
};

export type RoundToExpr = {
	kind: 'expr.roundTo';
	id: AstNodeId;
	value: ExpressionNode;
	roundingMode: 'decimalPlaces' | 'significantFigures';
	figures: ExpressionNode; // integer or variable reference
};

export type MathOperatorName =
	| 'sin'
	| 'cos'
	| 'tan'
	| 'sec'
	| 'csc'
	| 'cot'
	| 'asin'
	| 'acos'
	| 'atan'
	| 'atan2'
	| 'asec'
	| 'acsc'
	| 'acot'
	| 'sinh'
	| 'cosh'
	| 'tanh'
	| 'sech'
	| 'csch'
	| 'coth'
	| 'log'
	| 'ln'
	| 'exp'
	| 'abs'
	| 'signum'
	| 'floor'
	| 'ceil'
	| 'toDegrees'
	| 'toRadians';

export type MathOperatorExpr = {
	kind: 'expr.mathOperator';
	id: AstNodeId;
	name: MathOperatorName;
	values: ExpressionNode[]; // 1..N (atan2 uses 2)
};

export type IntegerModulusExpr = {
	kind: 'expr.integerModulus';
	id: AstNodeId;
	a: ExpressionNode;
	b: ExpressionNode;
};

export type IntegerToFloatExpr = {
	kind: 'expr.integerToFloat';
	id: AstNodeId;
	value: ExpressionNode;
};

export type GcdExpr = {
	kind: 'expr.gcd';
	id: AstNodeId;
	values: ExpressionNode[]; // 1..N
};

export type LcmExpr = {
	kind: 'expr.lcm';
	id: AstNodeId;
	values: ExpressionNode[]; // 1..N
};


