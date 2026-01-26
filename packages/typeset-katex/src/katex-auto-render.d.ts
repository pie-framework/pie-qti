declare module 'katex/contrib/auto-render' {
	export type AutoRenderDelimiter = {
		left: string;
		right: string;
		display: boolean;
	};

	export type AutoRenderOptions = {
		delimiters?: AutoRenderDelimiter[];
		ignoredTags?: string[];
		ignoredClasses?: string[];
		throwOnError?: boolean;
		// KaTeX auto-render supports additional options; we keep this intentionally open.
		[key: string]: unknown;
	};

	/**
	 * KaTeX auto-render entrypoint.
	 * Note: KaTeX does not currently ship TS types for this contrib module.
	 */
	export default function renderMathInElement(element: HTMLElement, options?: AutoRenderOptions): void;
}
