import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

export default {
	content: ["./src/**/*.{html,js,svelte,ts,md}"],
	theme: {
		extend: {
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
				mono: ["JetBrains Mono", "Fira Code", "monospace"],
			},
		},
	},
	plugins: [
		typography,
		// @ts-expect-error - daisyui types are not available
		require("daisyui"),
	],
	// @ts-expect-error - daisyui config
	daisyui: {
		themes: [
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
		],
		darkTheme: "dark",
		base: true,
		styled: true,
		utils: true,
		logs: false,
	},
} satisfies Config;
