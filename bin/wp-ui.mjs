#!/usr/bin/env node
/**
 * wp-ui: the shared tools for every theme and plugin.
 *
 *   npx wp-ui php          Write the project's PHP bridge class.
 *   npx wp-ui check-css    Fail if the built stylesheet can reach outside the views.
 *   npx wp-ui check-build  check-css, plus fail if a chunk imports the loader.
 *   npx wp-ui check-page <address> [--chrome=path]
 *                          Fail if a page's React view does not draw, logs a
 *                          JavaScript error, changes anything outside the view,
 *                          scrolls sideways on a phone, or loses its plain
 *                          version with JavaScript off.
 *
 * Settings come from wp-ui.config.json at the project's root:
 *
 *   {
 *     "scope":   "frb-app",                     the view root's class
 *     "handle":  "frb-app",                     script and style handle
 *     "class":   "FRB_UI",                      PHP class name, unique to the project
 *     "filter":  "frb_react_ui",                filter that turns React off
 *     "dir":     "FRB_PLUGIN_DIR . 'assets/build/'",          PHP: folder of the build
 *     "url":     "FRB_PLUGIN_URL . 'assets/build/'",          PHP: address of the build
 *     "version": "FRB_VERSION",                 PHP: the project's version
 *     "php":     "includes/class-frb-ui.php",   where to write the bridge
 *     "css":     "assets/build/app.css"         the built stylesheet
 *   }
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(path.join(here, "..", "package.json"), "utf8"))
const [command, ...rest] = process.argv.slice(2)
const flags = Object.fromEntries(rest.filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=") || true] }))
const args = rest.filter((a) => !a.startsWith("--"))

function config() {
  const file = path.resolve(flags.config || "wp-ui.config.json")
  if (!fs.existsSync(file)) {
    console.error(`No ${path.basename(file)} here. See: npx wp-ui --help`)
    process.exit(2)
  }
  const c = JSON.parse(fs.readFileSync(file, "utf8"))
  for (const key of ["scope", "handle", "class", "filter", "dir", "url", "version"]) {
    if (!c[key]) {
      console.error(`${path.basename(file)} is missing "${key}".`)
      process.exit(2)
    }
  }
  if (!/^[a-z][a-z0-9-]*$/.test(c.scope)) {
    console.error(`"scope" must be a lowercase class name, like "frb-app".`)
    process.exit(2)
  }
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(c.class)) {
    console.error(`"class" must be a PHP class name, like "FRB_UI".`)
    process.exit(2)
  }
  return { ...c, root: path.dirname(file) }
}

async function php() {
  const c = config()
  const out = path.resolve(c.root, c.php || `includes/class-${c.scope}-ui.php`)
  let text = fs.readFileSync(path.join(here, "..", "php", "bridge.php.tpl"), "utf8")
  const values = { CLASS: c.class, SCOPE: c.scope, HANDLE: c.handle, FILTER: c.filter, DIR: c.dir, URL: c.url, VERSION: c.version, PACKAGE_VERSION: pkg.version }
  for (const [key, value] of Object.entries(values)) {
    text = text.split(`{{${key}}}`).join(value)
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, text)
  console.log(`Wrote ${path.relative(process.cwd(), out)} (class ${c.class}, scope ${c.scope}).`)
}

async function checkCss() {
  const c = config()
  const file = path.resolve(c.root, args[0] || c.css || "assets/build/app.css")
  if (!fs.existsSync(file)) {
    console.error(`No stylesheet at ${path.relative(process.cwd(), file)}. Build first.`)
    process.exit(1)
  }
  const { default: postcss } = await import("postcss")
  const root = postcss.parse(fs.readFileSync(file, "utf8"))
  const scope = `.${c.scope}.${c.scope}`
  const problems = []

  root.walkAtRules("layer", (rule) => problems.push(`a cascade layer remains: @layer ${rule.params}`))
  root.walkRules((rule) => {
    for (let node = rule.parent; node && node.type !== "root"; node = node.parent) {
      if (node.type === "atrule" && /keyframes$/i.test(node.name)) return
    }
    for (const selector of rule.selectors) {
      if (!selector.startsWith(scope)) problems.push(`unscoped selector: ${selector}`)
    }
  })

  if (problems.length) {
    console.error(problems.slice(0, 20).join("\n"))
    console.error(`${problems.length} problems in ${path.relative(process.cwd(), file)}.`)
    process.exit(1)
  }
  console.log(`Every rule in ${path.relative(process.cwd(), file)} applies only inside .${c.scope}.`)
}

async function checkBuild() {
  await checkCss()
  const c = config()
  const dir = path.dirname(path.resolve(c.root, c.css || "assets/build/app.css"))
  const chunks = path.join(dir, "chunks")
  const bad = fs.existsSync(chunks)
    ? fs.readdirSync(chunks).filter((f) => f.endsWith(".js") && /(from|import)\s*\(?\s*["']\.\.\/app\.js["']/.test(fs.readFileSync(path.join(chunks, f), "utf8")))
    : []
  if (bad.length) {
    console.error(`These chunks import app.js, so WordPress's ?ver= would load React twice: ${bad.join(", ")}`)
    console.error("Move what they share with main.tsx into a module the loader imports only with import().")
    process.exit(1)
  }
  console.log("No chunk imports the loader.")
}

async function checkPage() {
  const c = config()
  const url = args[0]
  if (!url) {
    console.error("Usage: npx wp-ui check-page <address> [--chrome=path]")
    process.exit(2)
  }
  const { default: puppeteer } = await import("puppeteer-core")
  const chrome = flags.chrome || process.env.CHROME_PATH || "/usr/bin/google-chrome"
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--no-proxy-server"] })
  const failures = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const sel = `.${c.scope}[data-ui-view]`

  const open = async ({ width = 1280, js = true } = {}) => {
    const page = await browser.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()) })
    await page.setJavaScriptEnabled(js)
    await page.setViewport({ width, height: 900 })
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 })
    await wait(500)
    return { page, errors }
  }

  {
    const { page, errors } = await open()
    const info = await page.evaluate((s, scope) => {
      const hosts = [...document.querySelectorAll(s)]
      return {
        views: hosts.length,
        ready: hosts.filter((h) => h.hasAttribute("data-ui-ready")).length,
        fallbacksShowing: hosts.filter((h) => getComputedStyle(h.querySelector(`.${scope}__fallback`)).display !== "none").length,
      }
    }, sel, c.scope)
    if (!info.views) failures.push(`the page has no .${c.scope} view`)
    if (info.ready < info.views) failures.push(`${info.views - info.ready} of ${info.views} views did not draw`)
    if (info.fallbacksShowing) failures.push(`${info.fallbacksShowing} views still show their plain version beside the React one`)
    errors.forEach((e) => failures.push(`JavaScript error: ${e}`))

    const snap = () => page.evaluate((scope) => {
      const props = ["display", "position", "margin", "padding", "font-family", "font-size", "font-weight", "line-height", "color", "background-color", "border", "box-sizing", "list-style-type", "text-decoration-line", "width", "height", "outline-style"]
      const out = []
      document.querySelectorAll("body *").forEach((el) => {
        if (el.closest(`.${scope}`) || el.matches("script,style,link")) return
        const holds = !!el.querySelector(`.${scope}`) // Grows with the view: its height proves nothing.
        const cs = getComputedStyle(el)
        out.push(`${el.tagName}.${el.className?.baseVal ?? el.className}|` + props.filter((p) => !(holds && p === "height")).map((p) => cs.getPropertyValue(p)).join("|"))
      })
      const html = getComputedStyle(document.documentElement)
      out.push(`html|${html.fontFamily}|${html.fontSize}|${html.getPropertyValue("--background")}|${html.getPropertyValue("--color-red-500")}`)
      return out
    }, c.scope)
    const before = await snap()
    const removed = await page.evaluate((handle) => { const l = document.getElementById(`${handle}-css`); l?.remove(); return !!l }, c.handle)
    await wait(300)
    const after = await snap()
    const changed = before.filter((line, i) => line !== after[i])
    if (!removed) failures.push(`the stylesheet #${c.handle}-css is not on the page`)
    if (changed.length) failures.push(`the design system changes ${changed.length} elements outside the views, e.g. ${changed[0].slice(0, 140)}`)
    await page.close()
  }

  {
    const { page } = await open({ width: 390 })
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push("the page scrolls sideways at phone width")
    await page.close()
  }

  {
    const { page } = await open({ js: false })
    const plain = await page.evaluate((s, scope) => [...document.querySelectorAll(s)].every((h) => getComputedStyle(h.querySelector(`.${scope}__fallback`)).display !== "none"), sel, c.scope)
    if (!plain) failures.push("with JavaScript off, a view's plain version does not show")
    await page.close()
  }

  await browser.close()
  if (failures.length) {
    console.error(failures.join("\n"))
    console.error(`${failures.length} page checks failed.`)
    process.exit(1)
  }
  console.log(`Page checks passed: views draw, stay inside .${c.scope}, fit a phone, and fall back without JavaScript.`)
}

const commands = { php, "check-css": checkCss, "check-build": checkBuild, "check-page": checkPage }
if (!commands[command]) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*\*\n?/, "").replace(/^ \* ?/gm, ""))
  process.exit(command ? 2 : 0)
}
await commands[command]()
