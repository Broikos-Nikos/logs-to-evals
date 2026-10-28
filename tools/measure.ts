/**
 * Builds 50 logs the selector has never seen, picks a 60 case test set from each
 * four ways, and writes what each test set holds to src/generated/measure.json.
 * The page and the README read that file and compute nothing of their own.
 *
 * The question is the one `specs/logs-to-evals.md` fixed before the first run:
 * does the selector's test set hold failing examples of more of the log's
 * failure modes than rows picked another way? The selector is the scaffold's,
 * unchanged, and the seeds below were not used while it was written.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { genLog, MODES } from './gen-log.ts'
import { select, CLUSTER_AT, type Row, type Pick } from '../src/lib/select.ts'
import { scrub } from '../src/lib/scrub.ts'
import { embed } from '../src/lib/embed.ts'
import { judge as judgeRows, mulberry32, sample, TWIN_AT, type Judged } from '../src/lib/judge.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export const EVAL_SEEDS = Array.from({ length: 50 }, (_, i) => 1001 + i)
export const ROWS = 5000
export const BUDGET = 60
/** random draws per log for the mean of the random pickers; near twins are counted on the first TWIN_DRAWS of them */
export const DRAWS = 200
export const TWIN_DRAWS = 20

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const r3 = (x: number) => Math.round(x * 1000) / 1000

/** One log, picked four ways. */
export function runLog(seed: number) {
  const log = genLog(seed, ROWS)
  const scrubbed = log.map((l) => scrub(l.text))
  const vecs = scrubbed.map(embed)
  const truth = log.map((l) => l.truth), planted = log.map((l) => l.pii)
  const judge = (v: typeof vecs | null, picked: number[]) => judgeRows(truth, planted, scrubbed, v, picked)
  const rows: Row[] = log.map((l) => ({ id: l.id, text: l.text, signal: l.signal }))
  const at = (picks: Pick[]) => picks.map((p) => p.row.id - 1)

  const chosen = select(rows, BUDGET).picks
  const sel = judge(vecs, at(chosen))
  const blind = judge(vecs, at(select(rows.map((x) => ({ ...x, signal: false })), BUDGET).picks))
  const r = mulberry32(seed)
  const unhappyIdx = log.map((l, i) => (l.signal ? i : -1)).filter((i) => i >= 0)
  const randomPicks = Array.from({ length: DRAWS }, () => sample(log.length, BUDGET, r))
  const rand = randomPicks.map((p, d) => judge(d < TWIN_DRAWS ? vecs : null, p))
  const unhappy = Array.from({ length: DRAWS }, (_, d) => judge(d < TWIN_DRAWS ? vecs : null, sample(unhappyIdx.length, BUDGET, r).map((k) => unhappyIdx[k])))
  const failing = MODES.filter((m) => log.some((l) => l.truth.failed && l.truth.modes.includes(m.id))).map((m) => m.id)
  const twinMean = (xs: Judged[]) => r3(mean(xs.filter((x) => x.twins !== null).map((x) => x.twins!)))
  return { seed, log, scrubbed, chosen, randomPicks, sel, blind, rand, unhappy, failing, signalRows: unhappyIdx.length, twinMean }
}

export function measure() {
  const perLog = EVAL_SEEDS.map((seed) => {
    const x = runLog(seed)
    return {
      seed, failing: x.failing.length, signalRows: x.signalRows,
      selector: x.sel, blind: x.blind,
      random0: x.rand[0].found.length,
      random: { found: r3(mean(x.rand.map((j) => j.found.length))), touched: r3(mean(x.rand.map((j) => j.touched.length))), twins: x.twinMean(x.rand), beats: x.rand.filter((j) => j.found.length > x.sel.found.length).length },
      unhappy: { found: r3(mean(x.unhappy.map((j) => j.found.length))), touched: r3(mean(x.unhappy.map((j) => j.touched.length))), twins: x.twinMean(x.unhappy), beats: x.unhappy.filter((j) => j.found.length > x.sel.found.length).length, ties: x.unhappy.filter((j) => j.found.length === x.sel.found.length).length },
    }
  })

  // one log in full, for the page: the selector's 60 and the first random draw's 60, with the columns the pickers never see
  const ex = runLog(EVAL_SEEDS[0])
  const show = (i: number, why: string) => ({ text: ex.scrubbed[i], why, signal: ex.log[i].signal, modes: ex.log[i].truth.modes, failed: ex.log[i].truth.failed })
  const example = {
    seed: ex.seed, rows: ROWS, signalRows: ex.signalRows,
    selector: { found: ex.sel.found, picks: ex.chosen.map((p) => show(p.row.id - 1, p.why)) },
    random: { found: ex.rand[0].found, picks: ex.randomPicks[0].map((i) => show(i, 'random')) },
  }

  const avg = (f: (l: (typeof perLog)[number]) => number) => r3(mean(perLog.map(f)))
  const piiTotal = (side: 'selector') => {
    const out: Record<string, { in: number; left: number }> = {}
    for (const l of perLog) for (const [k, v] of Object.entries(l[side].pii)) { const o = (out[k] ??= { in: 0, left: 0 }); o.in += v.in; o.left += v.left }
    return out
  }
  return {
    setup: { logs: EVAL_SEEDS.length, firstSeed: EVAL_SEEDS[0], lastSeed: EVAL_SEEDS[EVAL_SEEDS.length - 1], rows: ROWS, budget: BUDGET, draws: DRAWS, twinDraws: TWIN_DRAWS, twinAt: TWIN_AT, modes: MODES.length, clusterAt: CLUSTER_AT },
    found: { selector: avg((l) => l.selector.found.length), unhappy: avg((l) => l.unhappy.found), blind: avg((l) => l.blind.found.length), random: avg((l) => l.random.found), failing: avg((l) => l.failing) },
    touched: { selector: avg((l) => l.selector.touched.length), unhappy: avg((l) => l.unhappy.touched), blind: avg((l) => l.blind.touched.length), random: avg((l) => l.random.touched) },
    twins: { selector: avg((l) => l.selector.twins!), unhappy: avg((l) => l.unhappy.twins), blind: avg((l) => l.blind.twins!), random: avg((l) => l.random.twins) },
    allFound: { selector: perLog.filter((l) => l.selector.found.length === l.failing).length, blind: perLog.filter((l) => l.blind.found.length === l.failing).length },
    versusUnhappy: { better: perLog.filter((l) => l.selector.found.length > l.unhappy.found).length, worse: perLog.filter((l) => l.selector.found.length < l.unhappy.found).length },
    perMode: Object.fromEntries(MODES.map((m) => [m.id, { says: m.says, selector: perLog.filter((l) => l.selector.found.includes(m.id)).length, blind: perLog.filter((l) => l.blind.found.includes(m.id)).length }])),
    perLog: perLog.map((l) => ({ seed: l.seed, failing: l.failing, signalRows: l.signalRows, selector: l.selector.found.length, unhappy: l.unhappy.found, blind: l.blind.found.length, random: l.random.found, random0: l.random0 })),
    pii: piiTotal('selector'),
    example,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t0 = Date.now()
  const m = measure()
  mkdirSync(here('../src/generated'), { recursive: true })
  writeFileSync(here('../src/generated/measure.json'), JSON.stringify(m, null, 1) + '\n')
  console.log(`${Date.now() - t0} ms`)
  console.log(JSON.stringify({ found: m.found, touched: m.touched, twins: m.twins, allFound: m.allFound, versusUnhappy: m.versusUnhappy, pii: m.pii, exampleFound: [m.example.selector.found.length, m.example.random.found.length] }, null, 1))
}
