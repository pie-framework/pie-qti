import { DOMParser as XmldomDOMParser, XMLSerializer as XmldomXMLSerializer } from '@xmldom/xmldom';

export function parseXml(xml: string): Document {
	const DOMParserImpl: any = (globalThis as any).DOMParser ?? XmldomDOMParser;

	const parser = new DOMParserImpl({
		// Silences xmldom's console reporting of warnings and recoverable errors;
		// a fatalError still throws a ParseError after this returns.
		onError: () => {},
	});

	const doc = parser.parseFromString(xml, 'text/xml');

	// xmldom represents parse errors using <parsererror> nodes in some cases.
	// We detect them and throw to make failures explicit.
	const parserErrors = doc.getElementsByTagName('parsererror');
	if (parserErrors && parserErrors.length > 0) {
		const msg = parserErrors[0]?.textContent?.trim() || 'XML parse error';
		throw new Error(msg);
	}

	return doc;
}

export function serializeXml(node: Node): string {
	const XMLSerializerImpl: any = (globalThis as any).XMLSerializer ?? XmldomXMLSerializer;

	return new XMLSerializerImpl().serializeToString(node);
}


