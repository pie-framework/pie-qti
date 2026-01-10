<script lang="ts">
	import { locale, setLocale, type LocaleCode } from '../core/store.js';

	const locales: { code: LocaleCode; label: string }[] = [
		// English variants
		{ code: 'en-US', label: 'English (US)' },
		{ code: 'en-GB', label: 'English (UK)' },
		{ code: 'en-AU', label: 'English (Australia)' },
		{ code: 'en-CA', label: 'English (Canada)' },
		// Western European
		{ code: 'es-ES', label: 'Español' },
		{ code: 'fr-FR', label: 'Français' },
		{ code: 'de-DE', label: 'Deutsch' },
		{ code: 'it-IT', label: 'Italiano' },
		{ code: 'pt-BR', label: 'Português' },
		{ code: 'nl-NL', label: 'Nederlands' },
		// Central/Eastern European
		{ code: 'pl-PL', label: 'Polski' },
		{ code: 'cs-CZ', label: 'Čeština' },
		{ code: 'hu-HU', label: 'Magyar' },
		{ code: 'ro-RO', label: 'Română' },
		{ code: 'uk-UA', label: 'Українська' },
		{ code: 'tr-TR', label: 'Türkçe' },
		// Nordic
		{ code: 'fi-FI', label: 'Suomi' },
		{ code: 'sv-SE', label: 'Svenska' },
		{ code: 'da-DK', label: 'Dansk' },
		{ code: 'nb-NO', label: 'Norsk' },
		// Asian
		{ code: 'zh-CN', label: '简体中文' },
		{ code: 'ja-JP', label: '日本語' },
		{ code: 'ko-KR', label: '한국어' },
		{ code: 'th-TH', label: 'ไทย' },
		{ code: 'hi-IN', label: 'हिन्दी' },
		// Middle East
		{ code: 'ar-SA', label: 'العربية' },
	];

	async function handleLocaleChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		await setLocale(select.value as LocaleCode);
	}
</script>

<div class="locale-switcher">
	<label for="locale-select">Language:</label>
	<select id="locale-select" value={$locale} onchange={handleLocaleChange}>
		{#each locales as { code, label }}
			<option value={code}>{label}</option>
		{/each}
	</select>
</div>

<style>
	.locale-switcher {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	select {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--color-base-300, #d4d4d4);
		border-radius: 0.25rem;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #000);
		cursor: pointer;
	}

	label {
		font-size: 0.875rem;
		font-weight: 500;
	}
</style>
