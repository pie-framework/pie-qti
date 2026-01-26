// Element name mapping
export type { ElementNameMapper } from './element-mapper/ElementNameMapper.js';
export { Qti2xElementNameMapper } from './element-mapper/Qti2xElementNameMapper.js';
export { Qti3ElementNameMapper } from './element-mapper/Qti3ElementNameMapper.js';

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
} from './xml/index.js';

// Parser factory
export {
	createQtiParser,
	createMapperForVersion,
	isQti2,
	isQti3,
	type QtiParserResult,
	type CreateParserOptions,
} from './parser-factory.js';
