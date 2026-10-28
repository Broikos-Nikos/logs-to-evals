/**
 * What a test set holds, judged against the truth a picker never sees. Shared by
 * the measurement and the page, so the page's "another log" button computes the
 * same thing the measurement did.
 */
import { cosine, type Vec } from './embed'

/** The columns of a log row the pickers are never shown. */
export type Truth = { modes: string[]; failed: boolean }
export type Planted = { kind: string; value: string }

export type Judged = { found: string[]; touched: string[]; twins: number | null; pii: Record<string, { in: number; left: number }> }

export const TWIN_AT = 0.9

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** k distinct indices from 0..n-1, a partial Fisher Yates from a seeded generator. */
export function sample(n: number, k: number, r: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = 0; i < Math.min(k, n); i++) { const j = i + Math.floor(r() * (n - i)); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, Math.min(k, n))
}

/**
 * A mode is found when the set holds a row that triggers it and failed in the log: a regression suite built
 * from logs is worth its failing examples. Touched counts any row that triggers it. A near twin is a case with
 * another case at similarity TWIN_AT or more. Personal data is counted where it was planted and where it
 * survived the scrubber.
 */
export function judge(truth: Truth[], pii: Planted[][], scrubbed: string[], vecs: Vec[] | null, picked: number[]): Judged {
  const found = new Set<string>(), touched = new Set<string>()
  const counts: Judged['pii'] = {}
  for (const i of picked) {
    for (const m of truth[i].modes) { touched.add(m); if (truth[i].failed) found.add(m) }
    for (const p of pii[i]) {
      const k = (counts[p.kind] ??= { in: 0, left: 0 })
      k.in++
      if (scrubbed[i].includes(p.value)) k.left++
    }
  }
  const twins = vecs ? picked.filter((i) => picked.some((j) => j !== i && cosine(vecs[i], vecs[j]) >= TWIN_AT)).length / picked.length : null
  return { found: [...found].sort(), touched: [...touched].sort(), twins, pii: counts }
}
