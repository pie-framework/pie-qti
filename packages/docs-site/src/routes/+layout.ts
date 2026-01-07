// Enable prerendering for the docs site so adapter-static emits HTML pages
// (including a root `index.html`) for GitHub Pages.
export const prerender = true;

// GitHub Pages serves directories with `index.html`; keeping trailing slashes
// avoids subtle path issues when hosting under a base path like `/pie-qti`.
export const trailingSlash = 'always';


