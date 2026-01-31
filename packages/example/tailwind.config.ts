import type { Config } from "tailwindcss";

export default {
	// IMPORTANT:
	// This app renders interaction UIs from workspace packages (via Vite aliases),
	// so Tailwind must scan those sources too. Otherwise utility classes inside
	// those components won't be generated, and you'll see broken layouts (e.g.
	// SVGs rendering at the browser default 300x150).
	content: [
		"./src/**/*.{html,js,svelte,ts}",
		"../default-components/src/**/*.{html,js,svelte,ts}",
		"../item-player/src/**/*.{html,js,svelte,ts}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
				mono: ["JetBrains Mono", "Fira Code", "monospace"],
			},
		},
	},
	plugins: [
		// @ts-expect-error - daisyui types are not available
		require("daisyui"),
	],
	// @ts-expect-error - daisyui config
	daisyui: {
		themes: [
			// PIE-branded themes (default)
			{
				light: {
					...require("daisyui/src/theming/themes")["light"],
					primary: "#ee4923", // Orange from PIE logo
					"primary-content": "#ffffff",
					secondary: "#1e3a5f", // Deep navy blue
					"secondary-content": "#ffffff",
				},
			},
			{
				dark: {
					...require("daisyui/src/theming/themes")["dark"],
					primary: "#ff5733", // Brighter orange for dark mode
					"primary-content": "#ffffff",
					secondary: "#3b82f6", // Lighter blue for dark mode
					"secondary-content": "#ffffff",
				},
			},
			// Additional demo themes
			"cupcake",
			"bumblebee",
			"emerald",
			"corporate",
			"synthwave",
			"retro",
			"cyberpunk",
			"valentine",
			"halloween",
			"garden",
			"forest",
			"aqua",
			"lofi",
			"pastel",
			"fantasy",
			"wireframe",
			"black",
			"luxury",
			"dracula",
			"cmyk",
			"autumn",
			"business",
			"acid",
			"lemonade",
			"night",
			"coffee",
			"winter",
			"dim",
			"nord",
			"sunset",
			// Custom high contrast theme
			{
				"high-contrast": {
					primary: "#0000ff", // Pure blue
					"primary-content": "#ffffff", // White text on blue
					secondary: "#000000", // Pure black
					"secondary-content": "#ffffff", // White text on black
					accent: "#ffff00", // Pure yellow
					"accent-content": "#000000", // Black text on yellow
					neutral: "#000000", // Black
					"neutral-content": "#ffffff", // White
					"base-100": "#ffffff", // White background
					"base-200": "#f0f0f0", // Very light gray
					"base-300": "#e0e0e0", // Light gray
					"base-content": "#000000", // Black text
					info: "#0000ff", // Blue
					"info-content": "#ffffff", // White
					success: "#008000", // Green
					"success-content": "#ffffff", // White
					warning: "#ff8c00", // Dark orange
					"warning-content": "#000000", // Black
					error: "#ff0000", // Pure red
					"error-content": "#ffffff", // White
				},
			},
		],
		darkTheme: "dark",
		base: true,
		styled: true,
		utils: true,
		logs: false,
	},
} satisfies Config;
