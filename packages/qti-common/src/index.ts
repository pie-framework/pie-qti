// Element name mapping
export type { ElementNameMapper } from './element-mapper/ElementNameMapper.js';
export { Qti2xElementNameMapper } from './element-mapper/Qti2xElementNameMapper.js';
export { Qti3ElementNameMapper } from './element-mapper/Qti3ElementNameMapper.js';

// Attribute name mapping
export type { AttributeNameMapper } from './element-mapper/AttributeNameMapper.js';
export { Qti2xAttributeNameMapper } from './element-mapper/Qti2xAttributeNameMapper.js';
export { Qti3AttributeNameMapper } from './element-mapper/Qti3AttributeNameMapper.js';
export {
	QTI2_PROMPT_BEARING_INTERACTIONS,
	QTI3_ATTRIBUTE_TO_QTI2,
} from './element-mapper/qti3-attribute-map.js';
export {
	convertQti2ToQti3,
	QTI3_ASI_SCHEMA_LOCATION,
	QTI3_NAMESPACE,
	QTI3_RPTEMPLATE_BASE,
} from './element-mapper/qti2-to-qti3.js';

// Version detection
export { detectQtiVersion } from './version-detection/detectQtiVersion.js';
export type { QtiVersion } from './version-detection/detectQtiVersion.js';

// XML attribute utilities
export {
	getAttribute,
	getBooleanAttribute,
	getNumberAttribute,
	hasAttribute,
	toCamelCase,
	toKebabCase,
} from './xml/attributes.js';

// DOM utility helpers shared across player packages
export { assignProps, type AssignPropsOptions } from './dom/assignProps.js';
export {
	createSvelteMountController,
	type SvelteMountController,
	type SvelteMountControllerOptions,
} from './dom/svelteMountController.js';
export { touchDrag, touchDragStyles } from './dom/touchDrag.js';

// Parser factory
export {
	createQtiParser,
	createMapperForVersion,
	createAttributeMapperForVersion,
	isQti2,
	isQti3,
	type QtiParserResult,
	type CreateParserOptions,
} from './parser-factory.js';
