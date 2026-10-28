/**
 * Re-runs the whole measurement, holds it to what is committed, and holds the
 * facts the README stands on:
 *
 * - **the selector is the frozen one.** Its file is held to the hash it had when
 *   `specs/logs-to-evals.md` froze it, before the first evaluation run. Tuning it
 *   on these 50 logs and regenerating the file would pass every other check
 *   here, so this one exists: a changed selector has to be measured on logs it
 *   has never seen, with new seeds and a new hash written down first;
 * - the selector holds more failure modes than random rows, and the signal is
 *   worth what the README says it is (the selector with it beats the selector
 *   without it, and random rows with it beat random rows without it);
 * - the scrubber removes every planted email address, phone and card number.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { measure } from './measure.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const fail: string[] = []

/** src/lib/select.ts as frozen on 2026-10-28 at 23:10, before the first run on seeds 1001 to 1050 */
const FROZEN = '417c2c9b643b6c8df8925ac1175c5e4b59b9c92016c4e589a6673a4802be4927'
const now_hash = createHash('sha256').update(readFileSync(here('../src/lib/select.ts'))).digest('hex')
if (now_hash !== FROZEN) fail.push('src/lib/select.ts is not the selector frozen before the evaluation: measure a changed selector on logs it has never seen')

const now = measure()
const stored = JSON.parse(readFileSync(here('../src/generated/measure.json'), 'utf8'))
if (JSON.stringify(now) !== JSON.stringify(stored)) fail.push('src/generated/measure.json is stale: run `npm run measure` and read the diff')

const f = now.found
if (f.selector <= f.random) fail.push(`the selector holds ${f.selector} modes and random rows ${f.random}: the headline is false`)
if (f.selector <= f.blind) fail.push(`the selector holds ${f.selector} with the signal and ${f.blind} without: the signal is not doing what the README says`)
if (f.unhappy <= f.random) fail.push(`random rows with a signal hold ${f.unhappy} and random rows ${f.random}: the signal is not doing what the README says`)
for (const k of ['email', 'phone', 'card'] as const) if (now.pii[k].left !== 0) fail.push(`${now.pii[k].left} of ${now.pii[k].in} planted ${k} values survive the scrubber`)

if (fail.length) { console.error(fail.map((x) => 'FAIL ' + x).join('\n')); process.exit(1) }
console.log(`check:measure ok: the frozen selector holds ${f.selector} of ${now.setup.modes} modes, random rows with a signal ${f.unhappy}, the selector without it ${f.blind}, random rows ${f.random}, over ${now.setup.logs} logs`)
