/**
 * Keep the design system inside a project's React views.
 *
 * Tailwind writes global CSS: a reset on html, body, and every element,
 * variables on :root, and utilities any element with a matching class
 * picks up. On a WordPress site that would restyle the theme. And it
 * writes everything into cascade layers, which lose to every unlayered
 * rule, so the theme's CSS would beat all of it inside the views.
 *
 * This rewrites the built CSS:
 *   - every selector gets ".{scope}.{scope} " in front, so it only matches
 *     inside a view, with enough weight to beat ordinary theme rules;
 *   - :root, :host, html, and body become the view's root;
 *   - the cascade layers are removed, keeping their order.
 *
 * @keyframes and @property are left alone: they are named, not matched.
 */
import postcss, { type Root, type Rule, type AtRule } from "postcss"

export interface ScopeOptions {
  /** The view root's class, without the dot: "ft-app". */
  scope: string
  /** Class of server-HTML islands inside a view, which the reset skips. Default: "{scope}-html". */
  island?: string
}

const ROOTS = new Set([":root", ":host", "html", "body"])

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function scopeSelector(selector: string, scope: string): string {
  const SCOPE = `.${scope}.${scope}`
  const s = selector.trim()
  if (ROOTS.has(s)) {
    return SCOPE
  }
  // A rule written for the view's root itself, such as the colour tokens
  // on the scope class: keep it on the root, with the same weight as the rest.
  const self = new RegExp(`^\\.${escapeRegExp(scope)}(?![\\w-])`).exec(s)
  if (self) {
    return SCOPE + s.slice(self[0].length)
  }
  if (s.startsWith(":root ") || s.startsWith("html ") || s.startsWith("body ")) {
    return `${SCOPE} ${s.slice(s.indexOf(" ") + 1)}`
  }
  return `${SCOPE} ${s}`
}

function insideKeyframes(rule: Rule): boolean {
  let node = rule.parent
  while (node && node.type !== "root") {
    if (node.type === "atrule" && /keyframes$/i.test((node as AtRule).name)) {
      return true
    }
    node = node.parent as typeof node
  }
  return false
}

/**
 * Parts of a view can be the server's finished HTML ("islands", class
 * {scope}-html by default), styled by the project's older stylesheet. The reset must not
 * reach into them, or it would undo that stylesheet. :where() keeps the
 * selector's weight unchanged.
 */
// A pseudo-element must stay last. The minifier writes the old ones with
// one colon (":before"), so both spellings are matched.
const PSEUDO_ELEMENT = /(::[a-z-]+(\([^)]*\))?|:(before|after|first-line|first-letter))$/i

function skipIslands(selector: string, island: string): string {
  const notIsland = `:where(:not(.${island}, .${island} *))`
  const match = PSEUDO_ELEMENT.exec(selector)
  if (!match) {
    return selector + notIsland
  }
  return selector.slice(0, match.index) + notIsland + match[0]
}

function inLayer(rule: Rule, name: string): boolean {
  let node = rule.parent
  while (node && node.type !== "root") {
    if (node.type === "atrule" && (node as AtRule).name === "layer" && (node as AtRule).params.trim() === name) {
      return true
    }
    node = node.parent as typeof node
  }
  return false
}

export function scopeCss(css: string, options: ScopeOptions): string {
  const { scope } = options
  const island = options.island ?? `${scope}-html`
  const root: Root = postcss.parse(css)

  root.walkRules((rule) => {
    if (inLayer(rule, "base") && !insideKeyframes(rule)) {
      rule.selectors = rule.selectors.map((s) => (ROOTS.has(s.trim()) ? s : skipIslands(s.trim(), island)))
    }
  })

  // Unwrap layers, innermost first, so nested layers come out too.
  let found = true
  while (found) {
    found = false
    root.walkAtRules("layer", (layer) => {
      found = true
      if (layer.nodes && layer.nodes.length) {
        layer.replaceWith(layer.nodes)
      } else {
        layer.remove()
      }
    })
  }

  root.walkRules((rule) => {
    if (insideKeyframes(rule)) {
      return
    }
    const scoped = Array.from(new Set(rule.selectors.map((selector) => scopeSelector(selector, scope))))
    rule.selectors = scoped
  })

  // Rules every project needs on its own root. Written here so no project
  // has to repeat them with its class name.
  //   - The view uses the site's own font, size, and colour scheme.
  //   - The server's HTML hides once React has drawn the view.
  root.append(
    postcss.parse(
      `.${scope}.${scope}{font-family:inherit;font-size:inherit;color:var(--foreground)}` +
        `.${scope}.${scope}[data-ui-ready]>.${scope}__fallback{display:none}`
    )
  )

  return root.toString()
}

/** Vite plugin: scope every CSS file in the build. */
export function scopeCssPlugin(options: ScopeOptions) {
  return {
    name: "wp-ui-scope-css",
    enforce: "post" as const,
    generateBundle(_options: unknown, bundle: Record<string, { type: string; fileName: string; source?: string | Uint8Array }>) {
      for (const file of Object.values(bundle)) {
        if (file.type === "asset" && file.fileName.endsWith(".css")) {
          file.source = scopeCss(String(file.source), options)
        }
      }
    },
  }
}
