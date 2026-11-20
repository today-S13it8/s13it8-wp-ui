/**
 * Draws every React view a page carries.
 *
 * The PHP bridge prints, for each view:
 *
 *   <div class="{scope}" data-ui-view="name" data-ui-props="id">
 *     <div class="{scope}__fallback">…the server's finished HTML…</div>
 *   </div>
 *   <script type="application/json" id="id">…the view's data…</script>
 *
 * This loads the view's code, draws it from the data, then hides the
 * server's HTML. If anything fails, the HTML stays: the page works as it
 * did without React.
 */
import { Component, StrictMode, useLayoutEffect, type ComponentType, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { configurePortal } from "./lib/portal"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ViewLoader = () => Promise<{ default: ComponentType<{ data: any }> }>

export interface StartOptions {
  /** The project's scope class, as given to the build and the PHP bridge. */
  scope: string
  /** View name => loader. Use import() so each view is its own chunk. */
  views: Record<string, ViewLoader>
  /** Name used in console messages. */
  label?: string
}

class Boundary extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Marks the view ready once it is on the page. CSS then hides the fallback. */
function Ready({ host, children }: { host: HTMLElement; children: ReactNode }) {
  useLayoutEffect(() => {
    host.setAttribute("data-ui-ready", "")
  }, [host])
  return <>{children}</>
}

async function mount(host: HTMLElement, options: StartOptions) {
  if (host.dataset.uiMounted) {
    return
  }
  host.dataset.uiMounted = "1"

  const label = options.label ?? options.scope
  const load = options.views[host.dataset.uiView ?? ""]
  const json = document.getElementById(host.dataset.uiProps ?? "")?.textContent
  if (!load || !json) {
    return
  }

  try {
    const data = JSON.parse(json)
    const { default: View } = await load()

    const slot = document.createElement("div")
    slot.className = `${options.scope}__root`
    host.appendChild(slot)

    const root = createRoot(slot)
    const fail = (error: unknown) => {
      console.error(`[${label}] The "${host.dataset.uiView}" view failed. Showing the plain version.`, error)
      host.removeAttribute("data-ui-ready")
      queueMicrotask(() => {
        root.unmount()
        slot.remove()
      })
    }

    root.render(
      <StrictMode>
        <Boundary onError={fail}>
          <Ready host={host}>
            <View data={data} />
          </Ready>
        </Boundary>
      </StrictMode>
    )
  } catch (error) {
    console.error(`[${label}] Could not load the "${host.dataset.uiView}" view. Showing the plain version.`, error)
  }
}

export function startViews(options: StartOptions) {
  configurePortal(options.scope)

  const run = () => {
    document.querySelectorAll<HTMLElement>(`.${options.scope}[data-ui-view]`).forEach((host) => {
      void mount(host, options)
    })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run)
  } else {
    run()
  }
}
