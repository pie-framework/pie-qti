export type { ElementNameMapper } from './ElementNameMapper.js';
export { Qti2xElementNameMapper } from './Qti2xElementNameMapper.js';
export { Qti3ElementNameMapper } from './Qti3ElementNameMapper.js';

export type { AttributeNameMapper } from './AttributeNameMapper.js';
export { Qti2xAttributeNameMapper } from './Qti2xAttributeNameMapper.js';
export { Qti3AttributeNameMapper } from './Qti3AttributeNameMapper.js';
export { QTI2_PROMPT_BEARING_INTERACTIONS, QTI3_ATTRIBUTE_TO_QTI2 } from './qti3-attribute-map.js';
export {
	convertQti2ToQti3,
	QTI3_ASI_SCHEMA_LOCATION,
	QTI3_HTML_ELEMENTS,
	QTI3_NAMESPACE,
	QTI3_RPTEMPLATE_BASE,
	qti3AttributeName,
	qti3ElementName,
	qti3TemplateUri,
} from './qti2-to-qti3.js';
