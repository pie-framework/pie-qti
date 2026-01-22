import daisyui from 'daisyui';
import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {}
	},
	plugins: [daisyui],
	daisyui: {
		themes: [
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
			{
				'examplecorp': {
					'primary': '#0066cc',
					'secondary': '#4d4d4d',
					'accent': '#ff6b35',
					'neutral': '#2a2a2a',
					'base-100': '#ffffff',
					'base-content': '#1a1a1a',
					'info': '#3b82f6',
					'success': '#10b981',
					'warning': '#f59e0b',
					'error': '#ef4444',
				}
			}
		]
	}
} satisfies Config;
