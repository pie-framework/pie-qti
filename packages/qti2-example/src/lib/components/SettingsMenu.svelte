<!--
  Settings Menu Component

  Combined dropdown menu for theme and language switching.
  Integrates with PIE QTI i18n system and DaisyUI theming.

  Features:
  - Language selector with 8 available locales
  - Theme selector with all DaisyUI themes + high-contrast
  - localStorage persistence
  - Page reload pattern for locale changes
  - Visual indicators for active selections
  - Accessible keyboard navigation
-->
<script lang="ts">
	import type { SvelteI18nProvider, LocaleCode } from '@pie-qti/qti2-i18n';

	// Props
	interface Props {
		/** Current i18n provider instance */
		i18n: SvelteI18nProvider | null;
		/** Current locale code */
		currentLocale: LocaleCode;
		/** Current theme name */
		theme: string;
		/** Callback when locale changes */
		onLocaleChange: (locale: LocaleCode) => void;
		/** Callback when theme changes */
		onThemeChange: (theme: string) => void;
		/** Available DaisyUI themes */
		availableThemes?: string[];
	}

	let {
		i18n,
		currentLocale,
		theme,
		onLocaleChange,
		onThemeChange,
		availableThemes = [
			'light',
			'dark',
			'cupcake',
			'bumblebee',
			'emerald',
			'corporate',
			'synthwave',
			'retro',
			'cyberpunk',
			'valentine',
			'halloween',
			'garden',
			'forest',
			'aqua',
			'lofi',
			'pastel',
			'fantasy',
			'wireframe',
			'black',
			'luxury',
			'dracula',
			'cmyk',
			'autumn',
			'business',
			'acid',
			'lemonade',
			'night',
			'coffee',
			'winter',
			'dim',
			'nord',
			'sunset',
			'high-contrast',
		],
	}: Props = $props();

	// Available locales with display names (matching pie-qti)
	const availableLocales: { code: LocaleCode; label: string }[] = [
		{ code: 'en-US', label: 'English (US)' },
		{ code: 'es-ES', label: 'Español' },
		{ code: 'fr-FR', label: 'Français' },
		{ code: 'nl-NL', label: 'Nederlands' },
		{ code: 'ro-RO', label: 'Română' },
		{ code: 'th-TH', label: 'ไทย' },
		{ code: 'zh-CN', label: '中文(简体)' },
		{ code: 'ar-SA', label: 'العربية' },
	];

	// Derived translations
	const translations = $derived({
		settings: i18n?.t('demo.settings') ?? 'Settings',
		language: i18n?.t('i18n.selectLanguage') ?? 'Language',
		theme: i18n?.t('demo.theme') ?? 'Theme',
		ariaLabel: i18n?.t('demo.settings_aria') ?? 'Open settings menu',
	});
</script>

<div class="dropdown dropdown-end">
	<button
		tabindex="0"
		class="btn btn-ghost btn-circle"
		aria-label={translations.ariaLabel}
		aria-haspopup="true"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			class="w-5 h-5 stroke-current"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
			/>
		</svg>
	</button>

	<div
		tabindex="0"
		class="dropdown-content bg-base-100 rounded-box w-80 p-4 shadow-2xl z-[1] mt-3"
		role="menu"
	>
		<!-- Language Section -->
		<div class="mb-4">
			<h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
					/>
				</svg>
				{translations.language}
			</h3>
			<div class="max-h-64 overflow-y-auto">
				<ul class="menu menu-compact rounded-box" role="group" aria-label={translations.language}>
					{#each availableLocales as locale}
						<li>
							<button
								class="justify-between"
								class:active={currentLocale === locale.code}
								onclick={() => onLocaleChange(locale.code)}
								role="menuitem"
								aria-current={currentLocale === locale.code ? 'true' : undefined}
							>
								<span>{locale.label}</span>
								{#if currentLocale === locale.code}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-label="Selected"
									>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
									</svg>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<div class="divider my-2"></div>

		<!-- Theme Section -->
		<div>
			<h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
					/>
				</svg>
				{translations.theme}
			</h3>
			<div class="max-h-64 overflow-y-auto">
				<ul class="menu menu-compact rounded-box" role="group" aria-label={translations.theme}>
					{#each availableThemes as themeName}
						<li>
							<button
								class="justify-between capitalize"
								class:active={theme === themeName}
								onclick={() => onThemeChange(themeName)}
								role="menuitem"
								aria-current={theme === themeName ? 'true' : undefined}
							>
								<span>{themeName}</span>
								{#if theme === themeName}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-label="Selected"
									>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
									</svg>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</div>

<style>
	/* Smooth transitions for active state */
	.menu button {
		transition: all 0.2s ease;
	}

	.menu button.active {
		background-color: hsl(var(--p) / 0.1);
		color: hsl(var(--p));
		font-weight: 600;
	}

	.menu button:hover {
		background-color: hsl(var(--b2));
	}

	.menu button.active:hover {
		background-color: hsl(var(--p) / 0.15);
	}

	/* Ensure dropdown stays visible when focused */
	.dropdown:focus-within .dropdown-content {
		display: block;
	}
</style>
