/**
 * The pictures: `docs/logs-to-evals.png` at the top of the README, and
 * `public/card.png` at 1200 by 630 for link previews. Both are the built page at
 * load: the claim, and one log's two test sets side by side.
 *
 *   npm run capture
 *
 * Beside them, `docs/capture.json` keeps the words the README picture shows.
 * `check:capture` reads the same words off the current page and fails when they
 * differ, so a page that changed its claim cannot keep an old picture of it.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { browserReady } from './preflight.ts'
import { serve } from './serve.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/** The words a reader sees in the picture: the claim, the log, and how many modes each set found. */
export async function visibleWords(page: import('playwright').Page) {
  return page.evaluate(() => ({
    headline: document.querySelector('#headline')!.textContent!.trim(),
    seed: document.querySelector('#seed')!.textContent!.trim(),
    counts: [...document.querySelectorAll('.col .count .n')].map((n) => n.textContent!.trim()),
    first: document.querySelector('#col-sel .cases li .t')!.textContent!.trim(),
  }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await browserReady()
  const server = await serve()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1040 }, deviceScaleFactor: 1 })
    await page.goto(server.url)
    await page.waitForSelector('#col-sel .cases li')
    await page.screenshot({ path: here('../docs/logs-to-evals.png') })
    writeFileSync(here('../docs/capture.json'), JSON.stringify(await visibleWords(page), null, 1) + '\n')
    const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
    await card.goto(server.url)
    await card.waitForSelector('#col-sel .cases li')
    await card.screenshot({ path: here('../public/card.png') })
    console.log('wrote docs/logs-to-evals.png, docs/capture.json and public/card.png')
  } finally {
    await browser.close()
    server.stop()
  }
}
