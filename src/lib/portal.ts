/**
 * Where dialogs, menus, popovers, and tooltips render.
 *
 * Radix draws them at the end of <body>, outside the view's root. The
 * design system's styles only apply inside an element with the project's
 * scope class, so they would arrive unstyled. This keeps one such element
 * at the end of <body> and hands it to every portal.
 *
 * startViews() sets the scope class. A project can call configurePortal()
 * itself when it renders without startViews().
 */
let scope = "wp-ui"
let host: HTMLElement | null = null

export function configurePortal(scopeClass: string) {
  if (scopeClass !== scope) {
    scope = scopeClass
    host?.remove()
    host = null
  }
}

export function portalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") {
    return undefined
  }
  if (!host || !host.isConnected) {
    host = document.createElement("div")
    host.className = `${scope} ${scope}--portal`
    document.body.appendChild(host)
  }
  return host
}
