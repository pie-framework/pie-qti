# @pie-qti/app-demo

Demo application showcasing the QTI item and assessment players with interactive examples.

## Features

### Player Demos

- **Item Demo** (`/item-demo`) - Render and interact with individual QTI items
- **Assessment Demo** (`/assessment-demo`) - Full multi-item assessment experience with navigation

### XML Editor

Live XML editing with syntax-highlighted display powered by TipTap and Lowlight.

#### Features

- **Syntax Highlighting**: Filter-based color scheme that adapts to all DaisyUI themes
- **Theme Support**: Works seamlessly with all 32 standard DaisyUI themes (light, dark, cupcake, synthwave, etc.)
- **Customizable Colors**: Override syntax colors via CSS variables
- **Format XML**: Auto-format and indent XML with the toolbar button
- **Live Preview**: Changes to XML are immediately reflected in the player

#### Customizing Syntax Highlighting

The XmlEditor component uses CSS filters to create distinct syntax colors. You can customize the color scheme by overriding CSS variables:

```css
/* Adjust overall color saturation */
.xml-editor-container {
  --xml-syntax-saturation: 700%; /* Default: 500% */
}

/* Customize individual element colors via hue rotation */
.xml-editor-container {
  --xml-syntax-name-hue: 220deg;    /* Element names (default: 190deg for blue) */
  --xml-syntax-attr-hue: 280deg;    /* Attributes (default: 260deg for purple) */
  --xml-syntax-string-hue: 120deg;  /* String values (default: 80deg for green) */
  --xml-syntax-meta-hue: 30deg;     /* XML declarations (default: 10deg for orange) */
  --xml-syntax-keyword-hue: 0deg;   /* Keywords (default: 340deg for red) */
  --xml-syntax-number-hue: 180deg;  /* Numbers (default: 160deg for cyan) */
}
```

**Color Reference**: Hue rotation values:
- 0° = Red
- 80° = Green
- 160° = Cyan
- 190° = Blue
- 260° = Purple
- 340° = Red-pink

### Theme System

The application includes a theme switcher with all 32 standard DaisyUI themes:

**Light Themes**: light, cupcake, bumblebee, emerald, corporate, fantasy, wireframe, lofi, pastel, cmyk, autumn, lemonade, winter

**Dark Themes**: dark, synthwave, retro, cyberpunk, valentine, halloween, garden, forest, aqua, black, luxury, dracula, business, acid, night, coffee, dim, nord, sunset

The selected theme is saved to localStorage and persists across sessions.

### Sample Items

The demo ships 30+ sample QTI 2.2 items in [src/lib/sample-items.ts](src/lib/sample-items.ts), plus separate QTI 3.0, i18n, likert, and edge-case sets (`sample-items-qti3.ts`, `sample-items-i18n/`, `sample-likert-items.ts`, `sample-items-edge-cases.ts`). Samples are selectable in the demo UI at `/item-demo`.

### File Upload

Upload your own QTI content:

- **Single XML file**: Upload individual QTI item XML
- **ZIP package**: Upload IMS content packages with manifest and resources

### Role Switching

Test different QTI role/view actors:

- **Candidate** - Student taking the assessment (editable, no answers shown)
- **Scorer** - Grader reviewing responses (readonly, correct answers shown)
- **Tutor** - Teacher providing feedback (readonly, correct answers shown)
- **Author** - Content creator preview (readonly, correct answers shown)
- **Proctor** - Test administrator (readonly, no correct answers shown)
- **Test Constructor** - Assessment builder (readonly, correct answers shown)

### Session Management

- **Save Session**: Persist item responses to localStorage
- **Load Session**: Restore previously saved responses
- **Export**: Download responses as JSON or CSV

## Development

### Running Locally

```bash
# Install dependencies
bun install

# Start dev server
cd apps/demo
bun run dev

# Open browser to http://localhost:5173
```

### Building

```bash
bun run build
```

### Testing

```bash
# Run E2E tests
bun run test:e2e

# Run specific test file
bun run test:e2e tests/playwright/theme-cascade.pw.ts
```

## Architecture

### Components

- **[XmlEditor.svelte](src/lib/components/XmlEditor.svelte)** - Syntax-highlighted XML editor with TipTap
- **[AssessmentShell](../../packages/assessment-player/src/components/AssessmentShell.svelte)** - Assessment player shell (imported)

### Routes

- **[+layout.svelte](src/routes/+layout.svelte)** - App shell with navigation and theme switcher
- **[+page.svelte](src/routes/+page.svelte)** - Landing page
- **[item-demo/[sample]/+page.svelte](src/routes/item-demo/[sample]/+page.svelte)** - Item player demo (sample-driven; /item-demo redirects to the first sample)
- **[assessment-demo/+page.svelte](src/routes/assessment-demo/+page.svelte)** - Assessment player demo

…plus routes for accessibility fixtures, package upload, the QTI 3 demo, iframe embedding, and web-component hosts.

### Libraries

- **[@tiptap/core](https://tiptap.dev/)** - Headless rich text editor framework
- **[lowlight](https://github.com/wooorm/lowlight)** - Virtual syntax highlighter using highlight.js
- **[DaisyUI](https://daisyui.com/)** - Tailwind CSS component library with themes
- **[KaTeX](https://katex.org/)** - Fast math rendering library

## Related Packages

- [@pie-qti/item-player](../../packages/item-player) - Core item rendering engine
- [@pie-qti/assessment-player](../../packages/assessment-player) - Assessment orchestration
- [@pie-qti/to-pie](../../packages/to-pie) - QTI XML → PIE JSON transformer

## License

See [LICENSE](../../LICENSE) in the repository root.
