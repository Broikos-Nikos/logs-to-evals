/**
 * Turns a log into a test set.
 *
 * 1. Scrub, so nothing personal is carried forward.
 * 2. Cluster by meaning, in one pass: a row joins the nearest cluster whose first
 *    member it resembles, or starts a new one. Order dependent, deterministic,
 *    and good enough that the clusters are readable by a person.
 * 3. Spend the budget on clusters, not on rows. A cluster is worth testing in
 *    proportion to the square root of its traffic (so a common question does not
 *    take the whole budget) and to how often its users showed they were unhappy.
 * 4. Inside a cluster, take the unhappy rows first, then the rows least like the
 *    ones already taken.
 *
 * The signal is whatever the log has: a thumbs down, a re-ask, an escalation. It
 * is optional. Without it, steps 3 and 4 fall back to traffic and diversity.
 */
import { cosine, embed, type Vec } from './embed'
import { scrub } from './scrub'

export type Row = { id: number; text: string; signal?: boolean }
export type Cluster = { id: number; members: number[]; signalRate: number; label: string }
export type Pick = { row: Row; cluster: number; why: 'unhappy' | 'diverse' | 'only' }

export const CLUSTER_AT = 0.6

export function cluster(rows: Row[], vecs: Vec[]): Cluster[] {
  const leaders: Vec[] = []
  const out: Cluster[] = []
  rows.forEach((_, i) => {
    let best = -1, bs = CLUSTER_AT
    leaders.forEach((l, c) => { const s = cosine(vecs[i], l); if (s >= bs) { bs = s; best = c } })
    if (best < 0) { leaders.push(vecs[i]); out.push({ id: out.length, members: [i], signalRate: 0, label: '' }) }
    else out[best].members.push(i)
  })
  for (const c of out) {
    c.signalRate = c.members.filter((i) => rows[i].signal).length / c.members.length
    c.label = rows[c.members[0]].text
  }
  return out
}

/** The value of one cluster to a test set of a fixed size. */
const worth = (c: Cluster, haveSignal: boolean) => Math.sqrt(c.members.length) * (haveSignal ? 1 + 5 * c.signalRate : 1)

export function select(raw: Row[], n: number): { picks: Pick[]; clusters: Cluster[] } {
  const rows = raw.map((r) => ({ ...r, text: scrub(r.text) }))
  const vecs = rows.map((r) => embed(r.text))
  const clusters = cluster(rows, vecs)
  const haveSignal = rows.some((r) => r.signal)
  const ranked = [...clusters].sort((a, b) => worth(b, haveSignal) - worth(a, haveSignal) || b.members.length - a.members.length)

  // one case per cluster, best clusters first, then the rest of the budget in proportion to worth
  const quota = new Map<number, number>()
  const chosen = ranked.slice(0, n)
  chosen.forEach((c) => quota.set(c.id, 1))
  let left = n - chosen.length
  const total = chosen.reduce((s, c) => s + worth(c, haveSignal), 0)
  for (const c of chosen) {
    if (left <= 0) break
    const extra = Math.min(c.members.length - 1, Math.floor(((n - chosen.length) * worth(c, haveSignal)) / total))
    quota.set(c.id, 1 + extra)
    left -= extra
  }
  for (const c of chosen) { // whatever the rounding left over goes to the biggest clusters that can take it
    if (left <= 0) break
    if ((quota.get(c.id) ?? 0) < c.members.length) { quota.set(c.id, (quota.get(c.id) ?? 0) + 1); left-- }
  }

  const picks: Pick[] = []
  for (const c of chosen) {
    const want = quota.get(c.id) ?? 0
    const taken: number[] = []
    const unhappy = c.members.filter((i) => rows[i].signal)
    const rest = c.members.filter((i) => !rows[i].signal)
    // unhappy rows first, spread apart; then the rows farthest from everything taken
    const far = (pool: number[]) => pool.reduce((b, i) => {
      const d = taken.length ? Math.max(...taken.map((t) => cosine(vecs[i], vecs[t]))) : 0
      return d < b.d ? { i, d } : b
    }, { i: -1, d: 2 })
    for (const pool of [unhappy, rest]) {
      const left2 = [...pool]
      while (taken.length < want && left2.length) {
        const { i } = far(left2)
        taken.push(i)
        left2.splice(left2.indexOf(i), 1)
      }
    }
    taken.forEach((i) => picks.push({ row: rows[i], cluster: c.id, why: c.members.length === 1 ? 'only' : rows[i].signal ? 'unhappy' : 'diverse' }))
  }
  return { picks, clusters }
}

/** Near duplicate pairs in a set: the share of cases that have a twin at 0.9 similarity or more. */
export function twins(texts: string[]): number {
  const v = texts.map(embed)
  const dup = v.filter((a, i) => v.some((b, j) => j !== i && cosine(a, b) >= 0.9)).length
  return texts.length ? dup / texts.length : 0
}
