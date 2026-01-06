# @pie-qti/qti2-example

Demo application showcasing the QTI 2.x item and assessment players with interactive examples.

## Features

### Player Demos

- **Item Demo** (`/item-demo`) - Render and interact with individual QTI 2.x items
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

Includes 20 sample QTI items covering all 18 interaction types:

1. **Simple Multiple Choice** - Basic choice interaction
2. **Partial Credit** - Multiple response scoring
3. **Capital Cities** - Choice with distractors
4. **Text Entry** - Fill-in-the-blank
5. **Extended Text** - Essay/long-form response
6. **Inline Choice** - Dropdown within text
7. **Order Interaction** - Drag to reorder
8. **Match Interaction** - Drag-and-drop matching
9. **Associate Interaction** - Many-to-many associations
10. **Gap Match** - Drag text into gaps
11. **Graphic Gap Match** - Drag labels onto diagram
12. **Slider Interaction** - Numeric slider
13. **Hotspot Interaction** - Click regions on image
14. **Upload Interaction** - File upload
15. **Drawing Interaction** - Canvas drawing
16. **Custom Interaction** - Fallback renderer
17. **Reading Comprehension** - Inline stimulus passage
18. **Quadratic Equation** - Inline KaTeX math
19. **Pythagorean Theorem** - Show work with math
20. **Adding Fractions** - Block display math

### File Upload

Upload your own QTI content:

- **Single XML file**: Upload individual QTI 2.x item XML
- **ZIP package**: Upload IMS content packages with manifest and resources

### Role Switching

Test different QTI 2.x standard roles:

- **Candidate** - Student taking the assessment (editable, no answers shown)
- **Scorer** - Grader reviewing responses (readonly, correct answers shown)
- **Tutor** - Teacher providing feedback (readonly, correct answers shown)
- **Author** - Content creator preview (readonly, correct answers shown)
- **Proctor** - Test administrator (readonly, limited feedback)
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
cd packages/qti2-example
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
bun run test:e2e tests/e2e/theme-cascade.spec.ts
```

## Architecture

### Components
- **[XmlEditor.svelte](src/lib/components/XmlEditor.svelte)** - Syntax-highlighted XML editor with TipTap
- **[AssessmentShell](../../qti2-assessment-player/src/components/AssessmentShell.svelte)** - Assessment player shell (imported)

### Routes

- **[+layout.svelte](src/routes/+layout.svelte)** - App shell with navigation and theme switcher
- **[+page.svelte](src/routes/+page.svelte)** - Landing page
- **[item-demo/+page.svelte](src/routes/item-demo/+page.svelte)** - Item player demo
- **[assessment-demo/+page.svelte](src/routes/assessment-demo/+page.svelte)** - Assessment player demo

### Libraries

- **[@tiptap/core](https://tiptap.dev/)** - Headless rich text editor framework
- **[lowlight](https://github.com/wooorm/lowlight)** - Virtual syntax highlighter using highlight.js
- **[DaisyUI](https://daisyui.com/)** - Tailwind CSS component library with themes
- **[KaTeX](https://katex.org/)** - Fast math rendering library

## Related Packages

- [@pie-qti/qti2-item-player](../qti2-item-player) - Core item rendering engine
- [@pie-qti/qti2-assessment-player](../qti2-assessment-player) - Assessment orchestration
- [@pie-qti/qti2-to-pie](../qti2-to-pie) - QTI XML → PIE JSON transformer

## License

See [LICENSE](../../LICENSE) in the repository root.
