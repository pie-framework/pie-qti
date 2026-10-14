export {
	APIP_NAMESPACE,
	type ApipAccessElement,
	type ApipAccessElementSource,
	type ApipAccessibilityXml,
	type ApipContentLink,
	type ApipWriteOptions,
	readApipAccessElements,
	SSML_NAMESPACE,
	writeApipAccessibility,
} from './apip.js';
export {
	type AccessibilityCatalog,
	type CatalogCard,
	type CatalogCardPayload,
	clockSeconds,
	type MediaAssetRef,
	type MediaFragmentRange,
	type MediaKind,
	type MediaSource,
	mediaKind,
	mediaMimeType,
	type TextRange,
} from './catalog.js';
export { type QtiCatalogInfoOptions, writeQtiCatalogInfo } from './catalog-info.js';
