/**
 * PIE Model Type Definitions
 *
 * Specific model types for different PIE elements
 */

import type { PieModel } from './item';

/**
 * Multiple Choice Model
 */
export interface PieMultipleChoiceModel extends PieModel {
  element: '@pie-element/multiple-choice';
  prompt?: string;
  choices: PieChoice[];
  correctResponse?: string[];
  partialScoring?: boolean;
  shuffle?: boolean;
  choiceMode?: 'radio' | 'checkbox';
}

/**
 * Choice option
 */
export interface PieChoice {
  label: string;
  value: string;
  correct?: boolean;
}

/**
 * Extended Text Response Model (Extended Response)
 */
export interface PieExtendedTextModel extends PieModel {
  element: '@pie-element/extended-text-entry';
  prompt?: string;
  expectedLines?: number;
  maxLength?: number;
  height?: string;
  width?: string;
  mathInput?: boolean;
  equationEditor?: string;
  customKeys?: string[];
  teacherInstructions?: string;
  rationale?: string;
}

/**
 * Match Model
 */
export interface PieMatchModel extends PieModel {
  element: '@pie-element/match';
  prompt?: string;
  rows: PieMatchRow[];
  columns: PieMatchColumn[];
  correctResponse?: PieMatchPair[];
}

export interface PieMatchRow {
  id: string;
  label: string;
}

export interface PieMatchColumn {
  id: string;
  label: string;
}

export interface PieMatchPair {
  row: string;
  column: string;
}

/**
 * Rubric Model
 */
export interface PieRubricModel extends PieModel {
  element: '@pie-element/rubric' | '@pie-element/complex-rubric';
  points?: number;
  maxPoints?: number;
  sampleAnswers?: string[];
  rubric?: string;
}
