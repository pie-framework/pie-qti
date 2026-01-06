/**
 * QTI constants and configuration
 */

import type { VariableDeclaration } from '../types/index.js';

// Prefix for data attributes and CSS classes
export const PREFIX = 'pie-qti';

// Data attributes
export const ID = `data-${PREFIX}-identifier`;
export const RESPONSE_ID = `data-${PREFIX}-response-identifier`;
export const TAG = `data-${PREFIX}-tag`;
export const NAVMODE = `data-${PREFIX}-navigation-mode`;
export const SHOWHIDE = `data-${PREFIX}-show-hide`;

// CSS class names
export const ANSWERED = `${PREFIX}-answered`;
export const ASSOCIABLE = `${PREFIX}-associable`;
export const ASSOCIATION = `${PREFIX}-association`;
export const CHOICES = `${PREFIX}-choices`;
export const CLICKED = `${PREFIX}-clicked`;
export const CURRENT = `${PREFIX}-current`;
export const DRAGGING = `${PREFIX}-dragging`;
export const DRAGOVER = `${PREFIX}-dragover`;
export const GAP = `${PREFIX}-gap`;
export const GHOST = `${PREFIX}-ghost`;
export const HOTSPOT = `${PREFIX}-hotspot`;
export const INTERACTION = `${PREFIX}-interaction`;
export const MATCH = `${PREFIX}-match`;
export const MATCHED = `${PREFIX}-matched`;
export const MODAL = `${PREFIX}-modal`;
export const NAVIGATION = `${PREFIX}-navigation`;
export const PIVOTABLE = `${PREFIX}-pivotable`;
export const SELECTED = `${PREFIX}-selected`;

// CSS selectors
export const ASSOCIABLE_SEL = `.${ASSOCIABLE}`;
export const ASSOCIATION_SEL = `.${ASSOCIATION}`;
export const CHOICES_SEL = `.${CHOICES}`;
export const CLICKED_SEL = `.${CLICKED}`;
export const DRAGGING_SEL = `.${DRAGGING}`;
export const DRAGOVER_SEL = `.${DRAGOVER}`;
export const GAP_IMG_SEL = `[${TAG}="gapImg"]`;
export const GAP_SEL = `.${GAP}`;
export const GAP_TEXT_SEL = `[${TAG}="gapText"]`;
export const GHOST_SEL = `.${GHOST}`;
export const HOTSPOT_SEL = `.${HOTSPOT}`;
export const INTERACTION_SEL = `.${INTERACTION}`;
export const ITEM_SEL = `[${TAG}="assessmentItem"]`;
export const SIMPLECHOICE_SEL = `[${TAG}="simpleChoice"]`;

// Message identifiers
export const MSG_OK = `${PREFIX}-msg-ok`;
export const MSG_NONE = `${PREFIX}-msg-none`;
export const MSG_NO_SKIP = `${PREFIX}-msg-no-skip`;
export const MSG_TOO_MANY = `${PREFIX}-msg-too-many`;
export const MSG_TOO_FEW = `${PREFIX}-msg-too-few`;
export const MSG_MISMATCH = `${PREFIX}-msg-match-not-allowed`;

// Built-in QTI variable declarations
export const BUILTIN_DECLARATIONS: Record<string, VariableDeclaration> = {
	numAttempts: {
		identifier: 'numAttempts',
		value: 0,
		baseType: 'integer',
		cardinality: 'single',
	},
	duration: {
		identifier: 'duration',
		value: null,
		baseType: 'duration',
		cardinality: 'single',
	},
	completionStatus: {
		identifier: 'completionStatus',
		value: 'not_attempted',
		baseType: 'string',
		cardinality: 'single',
	},
	$comment: {
		identifier: '$comment',
		value: null,
		baseType: 'string',
		cardinality: 'single',
	},
	$dirty: {
		identifier: '$dirty',
		value: false,
		baseType: 'boolean',
		cardinality: 'single',
	},
};

// Namespaces
export const RPTEMPLATES = 'http://www.imsglobal.org/question/qti_v2p2/rptemplates';
export const SVG_NS = 'http://www.w3.org/2000/svg';
export const XLINK_NS = 'http://www.w3.org/1999/xlink';
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';

// UI constants
export const DEFAULT_THEME = 'theme';
export const MAX_TABLE_COLS = 4;

// Localization (English defaults)
export const EN = {
	UPLOAD: 'Upload file',
	COMMENT: 'Comment on this question if you wish.',
	EXPECTED_CHARS: (len: number) => `expected: ${len} chars`,
	EXPECTED_LINES: (lines: number) => `expected: ${lines} lines`,
	END_TEST: '<p>You have reached the end of the test</p>',
};
