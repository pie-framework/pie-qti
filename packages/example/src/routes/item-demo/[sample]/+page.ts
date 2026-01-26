import { SAMPLE_ITEMS } from '$lib/sample-items';

// Prerender all sample item pages so they can be hosted on GitHub Pages as static files.
// Without this, only the handful of routes reachable via <a href> during prerender are emitted.
export const prerender = true;

export const entries = () => SAMPLE_ITEMS.map((i) => ({ sample: i.id }));


