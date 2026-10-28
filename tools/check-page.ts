/**
 * The page a visitor gets, read after its script has run, at 1280 and at 390.
 *
 *   npm run check:page        (inside npm run verify, which starts the server)
 *
 * The HTML file is empty where the claims go, because src/main.ts writes every
 * figure from src/generated/measure.json, so this reads the DOM a browser built
 * and holds it to the measurement:
 *
 * - the headline and the four pickers' figures say what measure.json says;
 * - the example log shows 60 cases a side and the found counts the measurement
 *   recorded for it;
 * - "another log" builds the next log in the browser, and its selector's count
 *   and its random draw's count must equal what the measurement recorded for
 *   that seed, so the page cannot run a different selector from the one measured;
 * - no console error, and nothing wider than the window at either width.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const m = JSON.parse(readFileSync(here('../src/generated/measure.json'), 'utf8'))
const url = process.env.EVALS_URL
if (!url) { console.error('EVALS_URL is not set: run this through `npm run verify`'); process.exit(1) }

const fmt = (n: number) => n.toLocaleString('en-US')
const one = (n: number) => n.toFixed(2)
const fails: string[] = []
const expect = (ok: boolean, what: string) => { if (!ok) fails.push(what) }
const S = m.setup, F = m.found

const browser = await chromium.launch()
try {
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(url)
    await page.waitForSelector('#col-sel .cases li')
    const at = `at ${w}`

    const headline = (await page.textContent('#headline'))!.trim()
    const want = `Across ${S.logs} support logs of ${fmt(S.rows)} lines, ${S.budget} cases picked by this selector hold failing examples of ${one(F.selector)} of ${S.modes} known failure modes. ${S.budget} picked at random hold ${one(F.random)}.`
    expect(headline === want, `${at}: the headline reads "${headline}", the measurement says "${want}"`)
    const pickers = await page.$$eval('#pickers .stat .n', (ns) => ns.map((n) => n.textContent!.trim()))
    const wantPickers = [one(F.selector), one(F.unhappy), one(F.blind), one(F.random)]
    expect(JSON.stringify(pickers) === JSON.stringify(wantPickers), `${at}: the pickers read ${JSON.stringify(pickers)}, the measurement says ${JSON.stringify(wantPickers)}`)

    const counts = async () => page.$$eval('.col .count .n', (ns) => ns.map((n) => Number(n.textContent)))
    const sizes = await page.$$eval('.col .cases', (ls) => ls.map((l) => l.children.length))
    expect(JSON.stringify(sizes) === JSON.stringify([S.budget, S.budget]), `${at}: the example shows ${JSON.stringify(sizes)} cases, not ${S.budget} a side`)
    const c0 = await counts()
    expect(c0[0] === m.example.selector.found.length && c0[1] === m.example.random.found.length, `${at}: the example log shows ${JSON.stringify(c0)} modes found, the measurement recorded ${m.example.selector.found.length} and ${m.example.random.found.length}`)

    await page.click('#another')
    const next = m.perLog[1]
    await page.waitForFunction((s) => document.querySelector('#seed')?.textContent === String(s) && !(document.querySelector('#another') as HTMLButtonElement).disabled, next.seed, { timeout: 60000 })
    const c1 = await counts()
    expect(c1[0] === next.selector && c1[1] === next.random0, `${at}: log ${next.seed} built in the page found ${JSON.stringify(c1)}, the measurement recorded ${next.selector} for the selector and ${next.random0} for its first random draw`)

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(wide <= 0, `${at}: the page is ${wide}px wider than the window`)
    expect(!errors.length, `${at}: console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
}

if (fails.length) { console.error(fails.map((f) => 'FAIL  ' + f).join('\n')); process.exit(1) }
console.log(`check:page ok: headline, the four pickers, the example log, and a log built in the page agree with the measurement, at 1280 and 390`)
