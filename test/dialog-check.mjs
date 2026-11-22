// Opens the fixture's dialog and fails unless it renders in the scoped popup
// container with the design system's styles, and React loads once.
//   node dialog-check.mjs <address> [chrome path]
import puppeteer from "puppeteer-core"

const failures = []

const [url, chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome"] = process.argv.slice(2)
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--no-proxy-server"] })
const page = await browser.newPage()
const scripts = []
page.on("request", (r) => { if (/\/assets\/build\/.*\.js/.test(r.url())) scripts.push(r.url().replace(/^.*\/build\//, "")) })
await page.goto(url, { waitUntil: "networkidle0" })
await page.click(".demo-app button")
await new Promise((r) => setTimeout(r, 400))
const dialog = await page.evaluate(() => {
  const el = document.querySelector('.demo-app--portal [role="dialog"]')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { inPortal: !!el.closest(".demo-app--portal"), bg: cs.backgroundColor, radius: cs.borderRadius }
})
// Primary buttons stay readable on WP Smith's palettes: light, the Family
// Roots child theme, and dark mode, which makes primary light.
const palettes = {
  "WP Smith light": { primary: "#0A0A0A", surface: "#FFFFFF", white: "#FFFFFF" },
  "Family Roots": { primary: "#2B2118", surface: "#F8F3EA", white: "#FFFFFF" },
  "WP Smith dark": { primary: "#f5f5f5", surface: "#111111", white: "#ffffff" },
}
// Buttons animate colour changes. Measure the end state, not the start.
await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" })
for (const [name, p] of Object.entries(palettes)) {
  const ratio = await page.evaluate((p) => {
    const root = document.documentElement.style
    root.setProperty("--wp--preset--color--primary", p.primary)
    root.setProperty("--wp--preset--color--surface", p.surface)
    root.setProperty("--wp--preset--color--white", p.white)
    const button = document.querySelector(".demo-app .demo-app__root button")
    const cs = getComputedStyle(button)
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number)
    const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
    const [a, b] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  }, p)
  if (ratio < 4.5) failures.push(`${name}: primary button text contrast is ${ratio.toFixed(2)}:1, below 4.5:1`)
}

await browser.close()

if (!dialog) failures.push("the dialog did not open")
else {
  if (!dialog.inPortal) failures.push("the dialog is not inside .demo-app--portal")
  if (dialog.bg === "rgba(0, 0, 0, 0)") failures.push("the dialog has no background: tokens are missing in the popup container")
  if (dialog.radius === "0px") failures.push("the dialog has no rounded corners")
}
const names = scripts.map((s) => s.split("?")[0])
const twice = names.filter((n, i) => names.indexOf(n) !== i)
if (twice.length) failures.push(`scripts loaded twice: ${twice.join(", ")}`)
if (!names.some((n) => n.includes("vendor-"))) failures.push("the vendor chunk did not load")

if (failures.length) {
  console.error(failures.join("\n"))
  process.exit(1)
}
console.log(`Dialog opens styled in the popup container. ${names.length} scripts, each loaded once.`)
