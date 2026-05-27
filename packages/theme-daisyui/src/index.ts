export type QtiThemeVariables = Record<`--pie-qti-${string}`, string>;

export type DaisyThemeTokens = {
	base100?: string;
	base200?: string;
	base300?: string;
	baseContent?: string;
	primary?: string;
	primaryContent?: string;
	secondary?: string;
	secondaryContent?: string;
	accent?: string;
	accentContent?: string;
	neutral?: string;
	neutralContent?: string;
	info?: string;
	infoContent?: string;
	success?: string;
	successContent?: string;
	warning?: string;
	warningContent?: string;
	error?: string;
	errorContent?: string;
};

function normalize(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function definedEntries(
	variables: Record<`--pie-qti-${string}`, string | undefined>,
): QtiThemeVariables {
	return Object.fromEntries(
		Object.entries(variables).filter((entry): entry is [`--pie-qti-${string}`, string] =>
			Boolean(entry[1]),
		),
	) as QtiThemeVariables;
}

export function mapDaisyThemeToQtiVariables(tokens: DaisyThemeTokens): QtiThemeVariables {
	return definedEntries({
		'--pie-qti-primary': tokens.primary ?? 'var(--color-primary)',
		'--pie-qti-primary-content': tokens.primaryContent ?? 'var(--color-primary-content)',
		'--pie-qti-secondary': tokens.secondary ?? 'var(--color-secondary)',
		'--pie-qti-secondary-content': tokens.secondaryContent ?? 'var(--color-secondary-content)',
		'--pie-qti-accent': tokens.accent ?? 'var(--color-accent)',
		'--pie-qti-accent-content': tokens.accentContent ?? 'var(--color-accent-content)',
		'--pie-qti-neutral': tokens.neutral ?? 'var(--color-neutral)',
		'--pie-qti-neutral-content': tokens.neutralContent ?? 'var(--color-neutral-content)',
		'--pie-qti-base-100': tokens.base100 ?? 'var(--color-base-100)',
		'--pie-qti-base-200': tokens.base200 ?? 'var(--color-base-200)',
		'--pie-qti-base-300': tokens.base300 ?? 'var(--color-base-300)',
		'--pie-qti-base-content': tokens.baseContent ?? 'var(--color-base-content)',
		'--pie-qti-info': tokens.info ?? 'var(--color-info)',
		'--pie-qti-info-content': tokens.infoContent ?? 'var(--color-info-content)',
		'--pie-qti-success': tokens.success ?? 'var(--color-success)',
		'--pie-qti-success-content': tokens.successContent ?? 'var(--color-success-content)',
		'--pie-qti-warning': tokens.warning ?? 'var(--color-warning)',
		'--pie-qti-warning-content': tokens.warningContent ?? 'var(--color-warning-content)',
		'--pie-qti-error': tokens.error ?? 'var(--color-error)',
		'--pie-qti-error-content': tokens.errorContent ?? 'var(--color-error-content)',
		'--pie-qti-focus': tokens.primary ?? 'var(--color-primary)',
	});
}

export function readDaisyThemeTokensFromElement(element: HTMLElement): DaisyThemeTokens | null {
	const computed = getComputedStyle(element);
	const tokens: DaisyThemeTokens = {
		base100: normalize(computed.getPropertyValue('--color-base-100')),
		base200: normalize(computed.getPropertyValue('--color-base-200')),
		base300: normalize(computed.getPropertyValue('--color-base-300')),
		baseContent: normalize(computed.getPropertyValue('--color-base-content')),
		primary: normalize(computed.getPropertyValue('--color-primary')),
		primaryContent: normalize(computed.getPropertyValue('--color-primary-content')),
		secondary: normalize(computed.getPropertyValue('--color-secondary')),
		secondaryContent: normalize(computed.getPropertyValue('--color-secondary-content')),
		accent: normalize(computed.getPropertyValue('--color-accent')),
		accentContent: normalize(computed.getPropertyValue('--color-accent-content')),
		neutral: normalize(computed.getPropertyValue('--color-neutral')),
		neutralContent: normalize(computed.getPropertyValue('--color-neutral-content')),
		info: normalize(computed.getPropertyValue('--color-info')),
		infoContent: normalize(computed.getPropertyValue('--color-info-content')),
		success: normalize(computed.getPropertyValue('--color-success')),
		successContent: normalize(computed.getPropertyValue('--color-success-content')),
		warning: normalize(computed.getPropertyValue('--color-warning')),
		warningContent: normalize(computed.getPropertyValue('--color-warning-content')),
		error: normalize(computed.getPropertyValue('--color-error')),
		errorContent: normalize(computed.getPropertyValue('--color-error-content')),
	};

	return tokens.base100 || tokens.primary || tokens.baseContent ? tokens : null;
}

export function mapResolvedDaisyThemeToQtiVariables(
	tokens: DaisyThemeTokens,
): QtiThemeVariables {
	return definedEntries({
		'--pie-qti-primary': tokens.primary,
		'--pie-qti-primary-content': tokens.primaryContent,
		'--pie-qti-secondary': tokens.secondary,
		'--pie-qti-secondary-content': tokens.secondaryContent,
		'--pie-qti-accent': tokens.accent,
		'--pie-qti-accent-content': tokens.accentContent,
		'--pie-qti-neutral': tokens.neutral,
		'--pie-qti-neutral-content': tokens.neutralContent,
		'--pie-qti-base-100': tokens.base100,
		'--pie-qti-base-200': tokens.base200,
		'--pie-qti-base-300': tokens.base300,
		'--pie-qti-base-content': tokens.baseContent,
		'--pie-qti-info': tokens.info,
		'--pie-qti-info-content': tokens.infoContent,
		'--pie-qti-success': tokens.success,
		'--pie-qti-success-content': tokens.successContent,
		'--pie-qti-warning': tokens.warning,
		'--pie-qti-warning-content': tokens.warningContent,
		'--pie-qti-error': tokens.error,
		'--pie-qti-error-content': tokens.errorContent,
		'--pie-qti-focus': tokens.primary,
	});
}

export function applyDaisyThemeToElement(
	element: HTMLElement,
	tokens: DaisyThemeTokens,
): void {
	for (const [key, value] of Object.entries(mapDaisyThemeToQtiVariables(tokens)) as Array<
		[string, string]
	>) {
		element.style.setProperty(key, value);
	}
}
