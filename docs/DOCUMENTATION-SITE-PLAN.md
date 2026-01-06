# Documentation Site Implementation Plan

**Status**: Planning Phase
**Last Updated**: 2025-01-05

## Overview

Build and deploy an attractive documentation website on GitHub Pages that showcases the PIE-QTI framework. The site will serve engineers, product managers, and potential users with clear, accessible information about the framework's capabilities, architecture, and benefits.

## Hosting Strategy

**Decision**: Host documentation website on GitHub Pages at `https://pie-framework.github.io/pie-qti/`

**Previous Consideration (Rejected)**: Initially considered hosting interactive examples/demos on GitHub Pages, but decided against it in favor of a proper documentation site.

## Technology Stack

### Static Site Generator: SvelteKit

**Rationale**:
- **Existing Expertise**: Team already experienced with SvelteKit (qti2-example is SvelteKit)
- **Stack Consistency**: Same tech stack (Svelte 5 + runes, Vite, Bun, Turbo)
- **Already Configured**: GitHub Pages deployment already working with adapter-static
- **Component Reuse**: Can import and demo actual QTI player components
- **Markdown Support**: Use `mdsvex` for markdown with embedded Svelte components
- **Styling Consistency**: Already using DaisyUI + Tailwind
- **Full Flexibility**: Complete control over layout, navigation, and features
- **No Learning Curve**: No need to learn Vue/React for documentation

**Alternatives Considered**:
- VitePress (Vue-based, would introduce new framework)
- Docusaurus (React-based, heavier, different stack)
- Starlight (Astro-based, good but less mature)

### Deployment

- **Platform**: GitHub Pages
- **Adapter**: `@sveltejs/adapter-static` (already in use)
- **Build Output**: Static HTML/CSS/JS
- **CI/CD**: GitHub Actions workflow (similar to existing qti2-example deployment)
- **Trigger**: Automatic deployment on push to `main` branch
- **Base Path**: `/pie-qti/` (already configured pattern)

## Site Architecture

### Navigation Structure

```
/                           # Landing page
├── /guide/
│   ├── introduction        # What is PIE-QTI?
│   ├── getting-started     # Quick start guide
│   ├── architecture        # System architecture (engineers)
│   └── concepts            # Core concepts
├── /features/
│   ├── overview            # Feature overview (product managers)
│   ├── qti-players         # QTI 2.2 rendering
│   ├── transformations     # PIE ↔ QTI transformations
│   ├── accessibility       # WCAG compliance
│   └── customization       # Extensibility
├── /packages/
│   ├── item-player         # QTI item player
│   ├── assessment-player   # QTI assessment player
│   ├── transform-core      # Transform engine
│   ├── qti-to-pie          # QTI → PIE
│   ├── pie-to-qti          # PIE → QTI
│   └── cli                 # CLI tools
├── /api/
│   ├── item-player-api     # Item player API reference
│   ├── assessment-api      # Assessment player API
│   └── plugin-system       # Plugin development
├── /examples/
│   ├── basic-usage         # Code examples (code snippets, not live demos)
│   ├── custom-interactions # Custom component examples (code)
│   └── integration         # Integration patterns (code)
│   └── live-demos          # Link to qti2-example app for comprehensive demos
└── /resources/
    ├── qti-compliance      # QTI 2.2 compliance
    ├── contributing        # Contribution guide
    └── changelog           # Version history
```

## Page Content Plan

### Landing Page (/)

**Goal**: Sell the framework without being corny. Clear, compelling, and professional.

**Sections**:

1. **Hero Section**
   - Headline: "Production-Ready QTI 2.2 Implementation for Modern Web Applications"
   - Subheadline: "Complete toolkit for QTI assessment rendering and PIE transformations"
   - CTA Buttons: "Get Started" | "View Examples" | "GitHub"
   - **Hero Image**: System Architecture Diagram (Diagram 1) - shows QTI/PIE → Players → Rendered UI
   - Clean, prominent placement to make landing page visually appealing

2. **Framework Benefits** (4 cards)
   - **Complete QTI 2.2 Support**: All 21 interactions, full spec compliance
   - **Production-Grade**: 1,112+ tests, WCAG 2.2 AA, TypeScript strict
   - **Dual Architecture**: Direct QTI rendering + PIE transformation
   - **Framework Agnostic**: Pluggable core, works with any UI framework

3. **Key Features** (visual showcase)
   - Interactive player demonstrations
   - Transform pipeline visualization
   - Accessibility highlights
   - Extensibility examples

4. **Architecture Diagram** (with placeholder)
   - System overview showing QTI input → Players → Rendered UI
   - Transform pipeline: PIE ↔ QTI bidirectional
   - Plugin system integration points

5. **Quick Start Code Example**
   ```bash
   bun add @pie-qti/qti2-item-player
   ```

6. **Stats Bar**
   - 21/21 Interactions
   - 1,112+ Tests
   - 99.5% WCAG AA
   - 100% TypeScript

7. **Use Cases** (3 columns)
   - **Educational Platforms**: Embed QTI assessments
   - **Content Authoring**: Transform between formats
   - **Assessment Engines**: Full-featured test delivery

8. **Sponsors & Credits** (footer section)
   - **Primary Sponsor**: Renaissance Learning logo + link (https://www.renaissance.com/)
   - **Development**: "Built by the PIE team at MCRO" with MCRO logo + link (https://mcro.tech)
   - Brief attribution text: "Sponsored by Renaissance Learning, developed by MCRO"
   - Subtle presentation - professional acknowledgment without being promotional

### /guide/architecture

**Goal**: Engineer-level architecture overview without overwhelming detail.

**Sections**:

1. **System Overview**
   - High-level architecture diagram (Diagram 1 - featured on landing page too)
   - Core packages and responsibilities
   - Data flow

2. **Player Architecture**
   - Component hierarchy
   - Extraction → Render pipeline
   - Plugin system architecture (Diagram 2)

3. **Transform Architecture**
   - Transform core engine
   - Plugin registry
   - Bidirectional transformation flow (Diagram 3)

4. **Integration Patterns**
   - Backend integration
   - State management
   - Custom interactions
   - Assessment navigation flow (Diagram 5)

### /features/overview

**Goal**: Product manager friendly feature overview showing business value.

**Sections**:

1. **QTI 2.2 Compliance**
   - Full specification support with interaction types diagram (Diagram 4)
   - Standards-based interoperability
   - Future-proof content

2. **Assessment Capabilities**
   - Single items and multi-item tests
   - Navigation modes (Diagram 5 - Assessment navigation)
   - Scoring and feedback
   - Adaptive branching

3. **Accessibility**
   - WCAG 2.2 Level AA compliance
   - Screen reader support
   - Keyboard navigation
   - Mobile accessibility

4. **Customization**
   - Custom interactions
   - Theme support
   - Backend integration
   - Vendor extensions (Plugin system Diagram 2)

5. **Developer Experience**
   - TypeScript first
   - Comprehensive docs
   - CLI tools
   - Testing utilities
   - Item rendering flow (Diagram 6)

### /packages/* Pages

**Goal**: Technical reference for each package with API docs.

**Template**:
- Package overview
- Installation
- Basic usage (code examples)
- Configuration options
- API reference (types, interfaces, classes)
- Code examples (not live demos - link to qti2-example for that)
- Related packages

### /examples/live-demos

**Goal**: Direct users to comprehensive demos without rebuilding them.

**Content**:
- Brief intro explaining the example app
- Link to qti2-example GitHub repository
- Link to hosted example app (if available)
- Screenshots/videos of key interactions
- Clear message: "For comprehensive interactive demos, see our example application"

## Diagram Placeholders & Prompts

### Diagram 1: System Architecture Overview

**Placeholder**: `[SYSTEM_ARCHITECTURE_DIAGRAM]`

**Usage**:
- **Landing page hero section** (prominent placement)
- Architecture guide page
- Getting started guide

**Prompt for Nano Banana Pro**:
```
Create a slight hand-drawn, Excalidraw-like visualization of a software architecture diagram.

Content to include:
- Left side: "QTI 2.2 XML" and "PIE JSON" as input boxes
- Center: Three main boxes stacked vertically:
  1. "Transform Core" (with bidirectional arrows to inputs)
  2. "QTI Item Player" (with plugins icon)
  3. "QTI Assessment Player" (with plugins icon)
- Right side: "Rendered UI" (web browser window shape)
- Arrows showing data flow left to right
- Small plugin icons on players indicating extensibility
- Clean, minimal color palette (2-3 accent colors)
- Slightly sketchy lines giving hand-drawn feel

Style: Technical diagram, Excalidraw aesthetic, professional but approachable
```

### Diagram 2: Plugin System Architecture

**Placeholder**: `[PLUGIN_SYSTEM_DIAGRAM]`

**Usage**:
- Customization features page
- Plugin development guide
- API documentation

**Prompt for Nano Banana Pro**:
```
Create a slight hand-drawn, Excalidraw-like visualization of a plugin architecture system.

Content to include:
- Center: "Core Player" as main component
- Around center, connected with arrows:
  - "Extractor Plugins" (top left)
  - "Renderer Plugins" (top right)
  - "Transform Plugins" (bottom left)
  - "Custom Interactions" (bottom right)
- Small icons representing different plugin types
- Registry box at bottom center connecting to core
- Dashed lines indicating plugin boundaries
- Flow arrows showing data moving through system

Style: Technical architecture diagram, Excalidraw aesthetic, organized and clear
```

### Diagram 3: Transform Pipeline Flow

**Placeholder**: `[TRANSFORM_PIPELINE_DIAGRAM]`

**Prompt for Nano Banana Pro**:
```
Create a slight hand-drawn, Excalidraw-like visualization of a bidirectional data transformation pipeline.

Content to include:
- Left box: "QTI 2.2 XML" (with XML icon)
- Right box: "PIE JSON" (with JSON icon)
- Center: Bidirectional arrow going through processing stages
- Top arrow (QTI → PIE): Parse → Extract → Transform → Validate
- Bottom arrow (PIE → QTI): Validate → Transform → Generate → Format
- "Transform Core" label at center
- Plugin points indicated with small connector icons
- Validation checkmarks at endpoints

Style: Process flow diagram, Excalidraw aesthetic, emphasizes bidirectional nature
```

### Diagram 4: QTI Interaction Components

**Placeholder**: `[INTERACTION_COMPONENTS_DIAGRAM]`

**Usage**:
- Features overview page
- QTI players page
- Landing page (possibly in features section)

**Prompt for Nano Banana Pro**:
```
Create a slight hand-drawn, Excalidraw-like visualization showing different QTI interaction types.

Content to include:
- Grid layout (3x3 or 4x3) of small cards
- Each card represents an interaction type with icon:
  - Choice (radio/checkbox)
  - Text Entry (text input)
  - Match (drag-and-drop pairs)
  - Hotspot (image with clickable areas)
  - Order (sortable list)
  - Drawing (canvas)
  - Upload (file icon)
  - Extended Text (rich text editor)
  - Inline Choice (dropdown in text)
- Simple icons/sketches for each type
- All 21 interaction types represented

Style: Component showcase, Excalidraw aesthetic, grid layout, consistent sizing
```

### Diagram 5: Assessment Player Navigation

**Placeholder**: `[ASSESSMENT_NAVIGATION_DIAGRAM]`

**Usage**:
- Assessment player features page
- Architecture guide

**Prompt for Nano Banana Pro**:
```
Create a slight hand-drawn, Excalidraw-like visualization of assessment test navigation.

Content to include:
- Browser window frame
- Header with "Assessment Player" title
- Left sidebar: Section menu with items 1-5
- Center: Current item display area
- Bottom: Navigation bar with Prev/Next buttons
- Top right: Timer and progress indicator
- Arrows showing navigation flow
- Current item highlighted
- Linear vs. nonlinear paths indicated with different arrow styles

Style: UI mockup diagram, Excalidraw aesthetic, clear navigation structure
```

### Diagram 6: Data Flow - Rendering an Item

**Placeholder**: `[ITEM_RENDERING_FLOW_DIAGRAM]`

**Prompt for Nano Banana Pro**:
```
Create a slight hand-drawn, Excalidraw-like visualization of the item rendering data flow.

Content to include:
- Top: "QTI XML" document icon
- Flow downward through stages:
  1. "Parse XML" (parser icon)
  2. "Extract Data" (with extractor plugins branching)
  3. "Map to Components" (component registry)
  4. "Render UI" (Svelte components)
  5. "Rendered Item" (browser view)
- Side branches showing:
  - Plugin injection points
  - State management
  - Event handling
- Vertical flow with stage labels

Style: Technical flow diagram, Excalidraw aesthetic, top-to-bottom flow
```

## Implementation Phases

### Phase 1: Setup & Structure (Days 1-2)

**Tasks**:
1. Create new SvelteKit package at `packages/docs-site/`
2. Configure adapter-static with base path `/pie-qti/`
3. Set up mdsvex for markdown support
4. Create main layout with navigation (`+layout.svelte`)
5. Set up routing structure (guide, features, packages, etc.)
6. Configure Tailwind + DaisyUI (reuse existing config)
7. Copy PIE logo to `packages/docs-site/static/`
8. Add docs-site to Turbo pipeline
9. Create placeholder pages for all sections

**Deliverables**:
- Working local dev server (`bun run docs:dev`)
- Navigation layout component
- Routing structure in place
- Markdown rendering working
- Logo and styling configured

### Phase 2: Content Migration & Creation (Days 3-5)

**Tasks**:
1. Create compelling landing page (`+page.svelte` with custom components)
2. Build reusable doc components (FeatureCard, CodeBlock, DiagramPlaceholder)
3. Add hero diagram to landing page (Diagram 1 - System Architecture)
4. Write architecture guide for engineers (markdown with diagrams)
5. Write features overview for product managers (markdown with diagrams)
6. Migrate and organize existing package documentation
7. Add diagram placeholders with prompts to all relevant pages
8. Create getting started guide
9. Write code examples with syntax highlighting
10. Add 1-2 simple demos on landing page (choice + text entry)
11. Obtain and add sponsor logos (Renaissance Learning, MCRO)
12. Add sponsor attribution section to landing page footer

**Deliverables**:
- Complete landing page with Svelte components
- Reusable doc component library
- All guide pages written (markdown)
- Feature pages written (markdown)
- Package docs organized
- 1-2 simple demos on landing page (not comprehensive demo gallery)

### Phase 3: Polish & Enhancement (Days 6-7)

**Tasks**:
1. Add search functionality (client-side search or algolia)
2. Customize DaisyUI theme to match brand
3. Create OG images for social sharing
4. Configure SEO metadata in `app.html` and page components
5. Add syntax highlighting for code blocks (reuse from qti2-example)
6. Implement table of contents for doc pages
7. Add "Edit on GitHub" links
8. Test all internal links
9. Mobile responsive testing
10. Add theme toggle (light/dark mode)

**Deliverables**:
- Polished, professional appearance
- Working search (basic or advanced)
- Responsive on all devices
- SEO optimized
- Consistent theming

### Phase 4: Deployment (Day 8)

**Tasks**:
1. ✅ Create GitHub Actions workflow for docs deployment
2. ✅ Configure GitHub Pages settings
3. ✅ Test deployment to staging
4. ✅ Deploy to production
5. ✅ Verify all pages load correctly
6. ✅ Update main README with docs link

**Deliverables**:
- Live documentation site
- Automatic deployment on main branch
- Working CI/CD pipeline

### Phase 5: Diagram Generation (Post-Deployment)

**Tasks**:
1. Generate diagrams using Nano Banana Pro with provided prompts
2. Optimize images for web (compress, resize)
3. Replace placeholders with actual diagrams
4. Review and adjust diagram quality
5. Deploy updated site

**Deliverables**:
- Professional diagrams replacing placeholders
- Optimized image assets
- Visually compelling documentation

## File Structure

```
pie-qti/
├── packages/
│   └── docs-site/              # SvelteKit documentation site (new package)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── +page.svelte           # Landing page
│       │   │   ├── +layout.svelte         # Main layout with nav
│       │   │   ├── guide/
│       │   │   │   ├── introduction/+page.md
│       │   │   │   ├── getting-started/+page.md
│       │   │   │   ├── architecture/+page.md
│       │   │   │   └── concepts/+page.md
│       │   │   ├── features/
│       │   │   │   ├── overview/+page.md
│       │   │   │   ├── qti-players/+page.md
│       │   │   │   ├── transformations/+page.md
│       │   │   │   ├── accessibility/+page.md
│       │   │   │   └── customization/+page.md
│       │   │   ├── packages/
│       │   │   │   ├── item-player/+page.md
│       │   │   │   ├── assessment-player/+page.md
│       │   │   │   └── ...
│       │   │   ├── api/
│       │   │   │   └── ...
│       │   │   ├── examples/
│       │   │   │   └── ...
│       │   │   └── resources/
│       │   │       └── ...
│       │   ├── lib/
│       │   │   └── components/
│       │   │       ├── DocNav.svelte      # Documentation navigation
│       │   │       ├── CodeBlock.svelte   # Syntax highlighted code
│       │   │       ├── FeatureCard.svelte # Feature showcase cards
│       │   │       └── ...
│       │   └── app.html
│       ├── static/
│       │   ├── pie-logo-orange.svg        # Copy from qti2-example
│       │   └── diagrams/                  # Generated diagrams
│       ├── svelte.config.js               # adapter-static + mdsvex
│       ├── vite.config.ts
│       ├── tailwind.config.ts             # Shared DaisyUI config
│       └── package.json
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml    # UPDATE: Deploy docs-site instead of qti2-example
│       └── ...
├── package.json                # UPDATE: Add docs build scripts
└── README.md                   # UPDATE: Link to docs site
```

## Build Configuration

### Root package.json Scripts

```json
{
  "scripts": {
    "docs:dev": "turbo dev --filter=@pie-qti/docs-site",
    "docs:build": "turbo build --filter=@pie-qti/docs-site",
    "docs:preview": "turbo preview --filter=@pie-qti/docs-site",
    "build:all": "turbo build"
  }
}
```

### SvelteKit Config (packages/docs-site/svelte.config.js)

```javascript
import adapter from '@sveltejs/adapter-static';
import { mdsvex } from 'mdsvex';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.md'],

  preprocess: [
    vitePreprocess(),
    mdsvex({
      extensions: ['.md'],
      layout: {
        guide: './src/lib/layouts/DocLayout.svelte',
        features: './src/lib/layouts/DocLayout.svelte',
        packages: './src/lib/layouts/DocLayout.svelte',
        api: './src/lib/layouts/DocLayout.svelte',
        examples: './src/lib/layouts/DocLayout.svelte',
        resources: './src/lib/layouts/DocLayout.svelte',
      }
    })
  ],

  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: false
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/pie-qti' : ''
    },
    prerender: {
      entries: ['*'], // Prerender all routes
      handleMissingId: 'warn'
    }
  }
};

export default config;
```

### Package.json (packages/docs-site/package.json)

```json
{
  "name": "@pie-qti/docs-site",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "dependencies": {
    "@pie-qti/qti2-item-player": "workspace:*",
    "@pie-qti/qti2-assessment-player": "workspace:*"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.10",
    "@sveltejs/kit": "^2.49.2",
    "@sveltejs/vite-plugin-svelte": "^6.2.1",
    "@tailwindcss/vite": "^4.1.18",
    "daisyui": "^5.5.14",
    "mdsvex": "^0.12.3",
    "svelte": "^5.46.1",
    "svelte-check": "^4.3.5",
    "tailwindcss": "^4.1.18",
    "typescript": "^5.9.3",
    "vite": "^7.3.0"
  }
}
```

## GitHub Actions Workflow Update

**File**: `.github/workflows/deploy-pages.yml`

**Changes**:
1. Rename job from "Build example app" to "Build documentation site"
2. Update build command to build docs instead of example app
3. Update artifact path to docs-site build output

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    name: Build documentation site
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.1.42

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build documentation site
        run: bun run docs:build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: packages/docs-site/build

  deploy:
    name: Deploy to GitHub Pages
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Documentation Updates Required

### Files to Update

1. **README.md** (root)
   - Remove reference to examples being hosted on GitHub Pages
   - Add link to documentation site
   - Update "Quick Links" section

2. **packages/qti2-example/README.md**
   - Clarify that examples are for local development/testing
   - Remove any references to hosted examples
   - Explain purpose is demonstration and accessibility testing

3. **docs/README.md**
   - Add reference to documentation site
   - Explain relationship between `/docs` (technical specs) and `/docs-site` (public docs)

## Success Metrics

### Technical Metrics
- ✅ Site loads in < 2 seconds
- ✅ Perfect Lighthouse scores (95+ in all categories)
- ✅ Mobile responsive on all pages
- ✅ Search works correctly
- ✅ All internal links resolve
- ✅ Automatic deployment works on every commit to main

### Content Metrics
- ✅ Clear value proposition on landing page
- ✅ Engineer-focused architecture documentation
- ✅ Product manager-friendly feature overview
- ✅ Complete package documentation
- ✅ Working code examples
- ✅ Professional diagrams

### User Experience
- ✅ Easy to navigate
- ✅ Clear hierarchy
- ✅ Professional appearance
- ✅ Not corny or over-marketed
- ✅ Fast page loads
- ✅ Good SEO

## Maintenance

### Keeping Docs Updated

**When to update documentation**:
- New package releases → Update package docs and changelog
- New features → Update feature pages
- API changes → Update API reference pages
- Breaking changes → Update migration guides

**Documentation review schedule**:
- After each major release
- Quarterly review for accuracy
- Update examples when API changes

### Content Ownership

- **Landing page**: Product/marketing review
- **Architecture docs**: Engineering review
- **Package docs**: Package maintainers
- **Examples**: Engineering team
- **API reference**: Auto-generated from TypeScript (future)

## Future Enhancements

### Phase 2 (Future)

1. **Interactive Playground**
   - Embed live QTI item player
   - Try examples in browser
   - Code sandbox integration

2. **API Auto-Generation**
   - Generate API docs from TypeScript
   - TypeDoc integration
   - Always up-to-date API reference

3. **Video Tutorials**
   - Getting started screencast
   - Architecture walkthrough
   - Common integration patterns

4. **Advanced Search**
   - Algolia DocSearch integration
   - Better search results
   - Search analytics

5. **Versioned Docs**
   - Multiple version support
   - Version switcher
   - Legacy documentation

6. **Multi-language Support**
   - i18n support
   - Additional languages based on user base

## Assets

### Logo

**PIE Logo**:
- **Source**: `packages/qti2-example/static/pie-logo-orange.svg`
- **Destination**: `packages/docs-site/static/pie-logo-orange.svg`
- **Usage**: Site logo in navigation header, favicon, social media cards
- **Color**: `#ee4923` (orange-red)
- **Size**: 448x448px SVG

### Sponsor Logos

**Renaissance Learning**:
- **Source**: Need to obtain official logo from Renaissance (request PNG/SVG)
- **Destination**: `packages/docs-site/static/sponsors/renaissance-logo.svg` (or .png)
- **Usage**: Footer attribution on landing page and about/resources pages
- **Link**: https://www.renaissance.com/

**MCRO**:
- **Source**: Need to obtain official logo from MCRO (request PNG/SVG)
- **Destination**: `packages/docs-site/static/sponsors/mcro-logo.svg` (or .png)
- **Usage**: Footer attribution noting development team
- **Link**: https://mcro.tech

### Favicon Generation

Generate multiple sizes from the logo SVG:
- favicon.ico (16x16, 32x32, 48x48 combined)
- apple-touch-icon.png (180x180)
- favicon-16x16.png
- favicon-32x32.png
- favicon-192x192.png (Android)
- favicon-512x512.png (Android)

## Notes

- Documentation site is **separate** from the example app (`qti2-example`)
- Example app remains for local development and E2E testing
- Documentation site is the public-facing product documentation
- Keep docs high-level and useful, not exhaustive API dumps
- Focus on **why** and **how**, not just **what**
- Use diagrams liberally to explain concepts visually
- Keep it professional but approachable
- Update docs as part of feature development, not as an afterthought
- **Demos**: Include 1-2 simple interactive demos on landing page only (e.g., choice interaction, text entry)
  - Purpose: Show it works, not showcase every interaction
  - For comprehensive demos, link to the example app repository
  - Keep site focused on documentation, not interactive playground
- **Visuals**: Include interesting diagrams throughout the site
  - Landing page MUST have hero diagram (System Architecture)
  - Each major section should have at least one relevant diagram
  - Diagrams make the site more engaging and easier to understand
- **Attribution**: Professional acknowledgment of sponsors
  - Renaissance Learning as primary sponsor (footer with logo)
  - MCRO as development team (footer with logo)
  - Simple text: "Sponsored by Renaissance Learning, developed by MCRO"
  - Not promotional, just proper credit

## Questions to Resolve

1. ~~Should we use VitePress or another generator?~~ → **Decision: VitePress**
2. ~~Should examples be embedded or linked?~~ → **Linked to local example app**
3. ~~Do we need versioned docs from day one?~~ → **No, add later**
4. ~~Should API docs be auto-generated?~~ → **Manual for now, auto-generate later**
5. Do we need a blog section? → **Decision pending**

## References

- [VitePress Documentation](https://vitepress.dev/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Excalidraw Style Guide](https://excalidraw.com/)
- [Technical Documentation Best Practices](https://documentation.divio.com/)
