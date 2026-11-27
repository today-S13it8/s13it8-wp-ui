# @s13it8/wp-ui

The shared React design system for the WP Smith theme and the s13it8 plugins.

WordPress still renders every page. React draws the interactive parts ("islands") from data the PHP side prints. Each island ships its plain HTML version first, so the page works with JavaScript off and search engines read the full content.

What's inside:

- Tailwind CSS 4 with `@tailwindcss/typography`
- shadcn/ui components on Radix UI (`ui/*`)
- `cn()` from clsx and tailwind-merge, plus cva for variants
- Lucide icons
- Theme colours and fonts read from the active theme's `theme.json` presets
- A CSS fence, so these styles never touch the theme or other plugins
- The PHP bridge that prints islands and loads the build
- Checks for the CSS fence, the build, and a live page in Chrome

## Add it to a project

```
project/
  wp-ui.config.json
  ui/
    package.json
    vite.config.ts
    src/main.tsx
    src/styles.css
    src/views/*.tsx
  assets/build/        built files, committed
```

**ui/package.json**

```json
{
  "private": true,
  "type": "module",
  "scripts": { "build": "vite build && wp-ui check-build --config=../wp-ui.config.json" },
  "dependencies": { "@s13it8/wp-ui": "github:today-S13it8/s13it8-wp-ui#v0.1.0" }
}
```

**wp-ui.config.json**

```json
{
  "scope": "frb-app",
  "handle": "frb-app",
  "class": "FRB_UI",
  "filter": "frb_react_ui",
  "dir": "FRB_PLUGIN_DIR . 'assets/build/'",
  "url": "FRB_PLUGIN_URL . 'assets/build/'",
  "version": "FRB_VERSION",
  "php": "includes/class-frb-ui.php",
  "css": "assets/build/app.css"
}
```

Pick a scope class unique to the project. Two projects with the same scope share styles.

**ui/vite.config.ts**

```ts
import { wpUi } from "@s13it8/wp-ui/vite"
export default wpUi({ scope: "frb-app", root: import.meta.dirname, outDir: "../assets/build" })
```

**ui/src/styles.css**

```css
@import "@s13it8/wp-ui/styles/base.css";
@source "./";
@source "../node_modules/@s13it8/wp-ui/src";
```

**ui/src/main.tsx** (keep it this small)

```tsx
import "./styles.css"
import { startViews } from "@s13it8/wp-ui/boot"

startViews({
  scope: "frb-app",
  views: { "recipe-card": () => import("./views/recipe-card") },
})
```

**A view**

```tsx
import { Button } from "@s13it8/wp-ui/ui/button"
import { Minus, Plus } from "lucide-react"

export default function RecipeCard({ data }: { data: { title: string; servings: number } }) {
  // ...
}
```

## The PHP side

Generate the bridge once, and again after each package upgrade:

```
npx wp-ui php
```

Load it, enqueue on pages with a view, and print islands:

```php
require_once FRB_PLUGIN_DIR . 'includes/class-frb-ui.php';

echo FRB_UI::mount( 'recipe-card', $data, $plain_html );
```

`mount()` prints `$plain_html` inside the island and the data as JSON. React draws from the JSON, then hides the plain version. Build both from the same filtered data, so React never sees anything the HTML would not show.

Turn React off for one site with `add_filter( 'frb_react_ui', '__return_false' );`.

## Checks

```
npx wp-ui check-css      every rule stays inside the scope
npx wp-ui check-build    check-css, plus no chunk imports the loader
npx wp-ui check-page <address> [--chrome=path]
```

`check-page` needs `puppeteer-core` and Chrome. It fails if a view does not draw, logs an error, changes anything outside the views, scrolls sideways at 390 px, or loses its plain version with JavaScript off.

## Rules that keep this working

- `main.tsx` holds only the styles import and `startViews`. WordPress adds `?ver=` to `app.js`. A chunk that imports it would load React twice. `check-build` catches this.
- Popups (dialogs, menus, tooltips) render into a scoped container, so they keep their styles outside the island.
- Lazy images inside a view stay visible, even on themes that hide them until their own fade-in script runs.
- Colours come from the theme's presets: primary, accent, surface, text-primary, border, and the rest. A child theme's palette changes every island. To change a token for one project, set it on `:root` in its `styles.css` after the import. The build moves `:root` onto the scope class.
- A theme picks the views' action colour in `theme.json`, under `settings.custom.ui`: `primary` for buttons and `onPrimary` for their text. Without it, buttons use the palette's `primary`, with the page `surface` colour as text.
