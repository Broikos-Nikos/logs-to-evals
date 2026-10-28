/**
 * Every figure the README and the page's meta tags quote is held to the
 * measurement. The sentences below are built from src/generated/measure.json and
 * must be found word for word, so a number typed into prose fails the build the
 * moment the measurement moves.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const m = JSON.parse(readFileSync(here('../src/generated/measure.json'), 'utf8'))
const readme = readFileSync(here('../README.md'), 'utf8')
const html = readFileSync(here('../index.html'), 'utf8')
const f = (n: number) => n.toLocaleString('en-US')
const one = (n: number) => n.toFixed(2)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const S = m.setup, F = m.found, T = m.touched, W = m.twins, P = m.pii

const headline = `Across ${S.logs} support logs of ${f(S.rows)} lines, ${S.budget} cases picked by this selector hold failing examples of ${one(F.selector)} of ${S.modes} known failure modes. ${S.budget} picked at random hold ${one(F.random)}.`
const claims = [
  `### ${headline}`,
  `${S.budget} random rows that carry a thumbs down, a re-ask or an escalation hold ${one(F.unhappy)}, and the selector with that signal taken away holds ${one(F.blind)}`,
  `| the selector | **${one(F.selector)}** | ${one(T.selector)} | ${pct(W.selector)} |`,
  `| ${S.budget} random rows with a signal | ${one(F.unhappy)} | ${one(T.unhappy)} | ${pct(W.unhappy)} |`,
  `| the selector without the signal | ${one(F.blind)} | ${one(T.blind)} | ${pct(W.blind)} |`,
  `| ${S.budget} random rows | ${one(F.random)} | ${one(T.random)} | ${pct(W.random)} |`,
  `Means over ${S.logs} logs, seeds ${S.firstSeed} to ${S.lastSeed}, with ${S.draws} random draws a log for the two random pickers (near twins counted on the first ${S.twinDraws}).`,
  `another case at similarity ${S.twinAt} or more`,
  `The selector found all ${S.modes} modes in ${m.allFound.selector} of the ${S.logs} logs. Against the random rows with a signal it did better in ${m.versusUnhappy.better} logs and worse in ${m.versusUnhappy.worse}.`,
  ...Object.values(m.perMode as Record<string, { says: string; selector: number; blind: number }>).map((v) => `| ${v.says} | ${v.selector} of ${S.logs} | ${v.blind} of ${S.logs} |`),
  `${f(P.email.in - P.email.left)} of ${f(P.email.in)} email addresses, ${f(P.phone.in - P.phone.left)} of ${f(P.phone.in)} phone numbers, ${f(P.card.in - P.card.left)} of ${f(P.card.in)} card numbers, and ${f(P.name.in - P.name.left)} of ${f(P.name.in)} names`,
  `it finds ${one(F.blind)} modes of ${S.modes}`,
  `${f(P.name.left)} of ${f(P.name.in)} names planted in the picked cases survive the scrubber`,
  `The selector found it in ${m.perMode.shouting.selector} of ${S.logs} logs through the signal, and in ${m.perMode.shouting.blind} without it.`,
  `${S.modes} failure modes were planted`,
  `the ${S.logs} logs come from one generator`,
]
const fails = [
  ...claims.filter((x) => !readme.includes(x)).map((x) => `README does not say: "${x}"`),
  ...(html.includes(headline) ? [] : [`index.html does not carry the headline: "${headline}"`]),
]
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]| -{1,2} `)
if (DASHES.test(readme.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, ''))) fails.push('README uses a dash as punctuation')
if (fails.length) { console.error(fails.map((x) => 'FAIL  ' + x).join('\n')); process.exit(1) }
console.log(`check:claims ok: ${claims.length} figures found in the README, the headline in index.html`)
