/**
 * The page. Every figure on it is read from src/generated/measure.json, written
 * by `npm run measure`. The one thing computed here is "another log": it builds
 * a log in the browser with the same generator, picks from it with the same
 * selector, and judges it with the same code the measurement used.
 */
import './style.css'
import m from './generated/measure.json'
import { genLog, MODES } from '../tools/gen-log'
import { select } from './lib/select'
import { scrub } from './lib/scrub'
import { judge, mulberry32, sample } from './lib/judge'

const el = <T extends HTMLElement>(id: string): T => {
  const n = document.getElementById(id)
  if (!n) throw new Error(`the page is missing #${id}`)
  return n as T
}
const fmt = (n: number) => n.toLocaleString('en-US')
const one = (n: number) => n.toFixed(2)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const S = m.setup, F = m.found

el('headline').innerHTML = `Across ${S.logs} support logs of ${fmt(S.rows)} lines, ${S.budget} cases picked by this selector hold failing examples of <em>${one(F.selector)}</em> of ${S.modes} known failure modes. ${S.budget} picked at random hold ${one(F.random)}.`
el('lead').textContent = `Most of that is the users' own signal: ${S.budget} random rows with a thumbs down, a re-ask or an escalation hold ${one(F.unhappy)}, and the selector with the signal taken away holds ${one(F.blind)}. What the selector adds is the rest of the way to ${S.modes}, and a set without repeats: ${pct(m.twins.selector)} of its cases have a near twin, against ${pct(m.twins.random)} of random ones.`

// one log, two test sets
type Shown = { text: string; why: string; signal: boolean; modes: string[]; failed: boolean }
const SAYS = Object.fromEntries(MODES.map((x) => [x.id, x.says]))
function column(box: string, title: string, found: string[], picks: Shown[]) {
  const chips = MODES.map((x) => `<span class="mode${found.includes(x.id) ? ' on' : ''}" title="${esc(x.says)}">${esc(x.says)}</span>`).join('')
  const rows = picks.map((p) => `<li${p.failed && p.modes.length ? ' class="hit"' : ''}><span class="t">${esc(p.text)}</span><span class="truth">${p.signal ? '<b class="sig">signal</b>' : ''}${p.modes.map((x) => `<i>${esc(SAYS[x])}</i>`).join('')}${p.failed ? '<b class="fail">failed</b>' : ''}</span></li>`).join('')
  el(box).innerHTML = `<h3 class="mono label">${esc(title)}</h3><p class="count"><span class="n">${found.length}</span> of ${S.modes} modes with a failing example</p><div class="modes">${chips}</div><ol class="cases">${rows}</ol>`
}
function showExample(seed: number, sel: { found: string[]; picks: Shown[] }, rnd: { found: string[]; picks: Shown[] }) {
  el('seed').textContent = String(seed)
  column('col-sel', 'Picked by the selector', sel.found, sel.picks)
  column('col-rnd', 'Picked at random', rnd.found, rnd.picks)
}
showExample(m.example.seed, m.example.selector, m.example.random)

// another log: built, picked and judged here, with the code the measurement ran
const seeds = m.perLog.map((l) => l.seed)
let at = 0
el('another').addEventListener('click', () => {
  at = (at + 1) % seeds.length
  const seed = seeds[at]
  const button = el<HTMLButtonElement>('another')
  button.disabled = true
  el('working').textContent = `Building log ${seed}: ${fmt(S.rows)} rows, clustered and picked in this tab.`
  setTimeout(() => {
    const log = genLog(seed, S.rows)
    const scrubbed = log.map((l) => scrub(l.text))
    const truth = log.map((l) => l.truth), planted = log.map((l) => l.pii)
    const picks = select(log.map((l) => ({ id: l.id, text: l.text, signal: l.signal })), S.budget).picks
    const selIdx = picks.map((p) => p.row.id - 1)
    const rndIdx = sample(log.length, S.budget, mulberry32(seed))
    const shown = (i: number, why: string): Shown => ({ text: scrubbed[i], why, signal: log[i].signal, modes: log[i].truth.modes, failed: log[i].truth.failed })
    showExample(seed,
      { found: judge(truth, planted, scrubbed, null, selIdx).found, picks: picks.map((p) => shown(p.row.id - 1, p.why)) },
      { found: judge(truth, planted, scrubbed, null, rndIdx).found, picks: rndIdx.map((i) => shown(i, 'random')) })
    el('working').textContent = ''
    button.disabled = false
  }, 30)
})

// across 50 logs
const stat = (n: string, what: string, hot = false) => `<div class="stat"><div class="n${hot ? ' hot' : ''}">${n}</div><div class="what">${what}</div></div>`
el('pickers').innerHTML = [
  stat(one(F.selector), `the selector: all ${S.modes} found in ${m.allFound.selector} of ${S.logs} logs`, true),
  stat(one(F.unhappy), `${S.budget} random rows with a signal, ${fmt(S.draws)} draws a log. The selector did better in ${m.versusUnhappy.better} logs and worse in ${m.versusUnhappy.worse}`),
  stat(one(F.blind), 'the selector with the signal taken away: clustering and spread alone'),
  stat(one(F.random), `${S.budget} rows at random, ${fmt(S.draws)} draws a log`),
].join('')
const W = 640, H = 220, L = 34, R = 10, T = 10, B = 26
const x = (i: number) => L + (i / (m.perLog.length - 1)) * (W - L - R)
const y = (v: number) => T + (1 - v / S.modes) * (H - T - B)
const SERIES: [keyof (typeof m.perLog)[number], string, string][] = [['random', '#8a7f76', ''], ['blind', '#9a8f88', '4 3'], ['unhappy', '#ffffff', ''], ['selector', '#ff6a00', '']]
const grid = [0, 2, 4, 6, 8].map((v) => `<line class="ax" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tx" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')
el('chart').innerHTML = grid + SERIES.map(([k, c, dash]) => `<polyline fill="none" stroke="${c}" stroke-width="${k === 'selector' ? 2.4 : 1.4}" ${dash ? `stroke-dasharray="${dash}"` : ''} points="${m.perLog.map((l, i) => `${x(i).toFixed(1)},${y(l[k] as number).toFixed(1)}`).join(' ')}"/>`).join('') + `<text class="tx" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">the ${S.logs} logs, seeds ${S.firstSeed} to ${S.lastSeed}</text>`
el('chart-t').textContent = `Failure modes with a failing example in the test set, out of ${S.modes}, for each log. Orange: the selector. White: random rows with a signal, the mean of ${fmt(S.draws)} draws. Dashed: the selector without the signal. Grey: random rows.`

el('per-mode').innerHTML = `<thead><tr><th>failure mode</th><th>logs where the selector found it</th><th>without the signal</th></tr></thead><tbody>${Object.values(m.perMode).map((v) => `<tr><td>${esc(v.says)}</td><td class="num">${v.selector} of ${S.logs}</td><td class="num">${v.blind} of ${S.logs}</td></tr>`).join('')}</tbody>`

const P = m.pii as Record<string, { in: number; left: number }>
el('pii').innerHTML = (['email', 'phone', 'card', 'name'] as const).map((k) => stat(`${fmt(P[k].in - P[k].left)} of ${fmt(P[k].in)}`, `${k === 'name' ? 'names' : k === 'card' ? 'card numbers' : k === 'phone' ? 'phone numbers' : 'email addresses'} removed from the selected cases`, k === 'name')).join('')

el('failures').innerHTML = [
  ['The signal does most of the work', `Without the thumbs down, the re-asks and the escalations, the selector finds ${one(F.blind)} modes of ${S.modes}. A log with no such signal gets a much weaker set, and a signal that fires on the wrong rows gets a wrong one.`],
  ['Names are not removed', `${fmt(P.name.left)} of ${fmt(P.name.in)} names planted in the selected cases are still there after scrubbing. A name has no shape: the scrubber removes only the ones that follow a phrase like "my name is". Everything with a shape, ${fmt(P.email.in + P.phone.in + P.card.in)} email addresses, phone and card numbers, was removed.`],
  ['Capitals are invisible to it', `The embedder lowercases every request, so a failure caused by writing in capitals looks like no failure at all to the clustering. The selector finds it in ${m.perMode.shouting.selector} of ${S.logs} logs through the signal, and in ${m.perMode.shouting.blind} without it.`],
  ['The log is synthetic, and so is its truth', `${S.modes} failure modes were planted with known triggers, by the same author as the selector. The selector was frozen before the ${S.logs} logs were built and none of their seeds was used to write it, but real failures do not announce themselves in the text this cleanly.`],
].map(([h, p]) => `<div class="fail"><h3>${h}</h3><p>${p}</p></div>`).join('')
