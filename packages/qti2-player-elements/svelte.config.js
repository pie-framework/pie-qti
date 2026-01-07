/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
const config = {
	compilerOptions: {
		// Required to compile components that declare `<svelte:options customElement="...">`.
		customElement: true,
	},
	vitePlugin: {
		include: ['**/*.svelte'],
	},
};

export default config;


