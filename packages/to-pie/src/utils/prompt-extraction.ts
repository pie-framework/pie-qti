import type { HTMLElement } from 'node-html-parser';

export function extractPromptForInteraction(
	itemBody: HTMLElement,
	interaction: HTMLElement
): string {
	const interactionPrompt = interaction.querySelector('prompt') || interaction.getElementsByTagName('prompt')[0];
	if (interactionPrompt) {
		const prompt = cleanTransformHtml(interactionPrompt.innerHTML);
		if (prompt) {
			return prompt;
		}
	}

	return extractItemBodyPromptBeforeInteraction(itemBody, interaction);
}

export function extractItemBodyPromptBeforeInteraction(
	itemBody: HTMLElement,
	interaction: HTMLElement
): string {
	let promptHtml = '';
	for (const child of itemBody.childNodes) {
		if (child === interaction) {
			break;
		}
		if (child.nodeType === 3) {
			const text = cleanTransformHtml(child.textContent ?? '');
			if (text) {
				promptHtml += text;
			}
			continue;
		}
		if ((child as HTMLElement).tagName) {
			const element = child as HTMLElement;
			const tagName = element.tagName?.toLowerCase();
			if (tagName === 'stimulus' || tagName === 'rubricblock') {
				continue;
			}
			const html = cleanTransformHtml(tagName === 'p' ? element.innerHTML : element.outerHTML);
			if (html) {
				promptHtml += html;
			}
		}
	}
	return promptHtml;
}

export function cleanTransformHtml(html: string): string {
	return html
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/>\s+</g, '><');
}
