import { DOMParser as XmldomDOMParser, XMLSerializer as XmldomXMLSerializer } from '@xmldom/xmldom';

export function parseXml(xml: string): Document {
	const DOMParserImpl: any = (globalThis as any).DOMParser ?? XmldomDOMParser;

	const parser = new DOMParserImpl({
		errorHandler: {
			// xmldom calls these for parse warnings/errors; treat as errors via thrown Error in our wrapper.
			warning: () => {},
			error: () => {},
			fatalError: () => {},
		},
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


