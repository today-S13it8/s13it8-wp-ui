// Opens the fixture's dialog and fails unless it renders in the scoped popup
// container with the design system's styles, and React loads once.
//   node dialog-check.mjs <address> [chrome path]
import puppeteer from "puppeteer-core"

const [url, chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome"] = process.argv.slice(2)
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--no-proxy-server"] })
const page = await browser.newPage()
const scripts = []
page.on("request", (r) => { if (/\/assets\/build\/.*\.js/.test(r.url())) scripts.push(r.url().replace(/^.*\/build\//, "")) })
await page.goto(url, { waitUntil: "networkidle0" })
await page.click(".demo-app button")
await new Promise((r) => setTimeout(r, 400))
const dialog = await page.evaluate(() => {
  const el = document.querySelector('[role="dialog"]')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { inPortal: !!el.closest(".demo-app--portal"), bg: cs.backgroundColor, radius: cs.borderRadius }
})
await browser.close()

const failures = []
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
