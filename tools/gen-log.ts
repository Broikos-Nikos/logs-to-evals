/**
 * Makes a production log that has known problems in it, so a test set can be
 * judged by whether it finds them.
 *
 * Eight failure modes are planted, each with the condition that triggers it and
 * the chance it fails when triggered. The selector never sees any of this: it
 * sees the text and, like a real log, an unreliable signal (a thumbs down, a
 * re-ask, an escalation) that fires on about three failures in four and on about
 * one request in twenty that went fine.
 *
 * Personal data is planted too, so the scrubber can be counted rather than
 * trusted. Everything is a pure function of the seed.
 */
import { INTENTS } from './intents.ts'

export type Mode = { id: string; says: string; p: number }
export const MODES: Mode[] = [
  { id: 'refund_date', says: 'invents a refund date', p: 0.35 },
  { id: 'intl_rules', says: 'quotes the wrong rules for shipping abroad', p: 0.28 },
  { id: 'damaged_escalation', says: 'does not escalate a damaged item', p: 0.3 },
  { id: 'unsubscribe_confusion', says: 'cancels the plan when asked to stop emails', p: 0.25 },
  { id: 'greek', says: 'fails in Greek', p: 0.22 },
  { id: 'shouting', says: 'refuses when written in capitals', p: 0.15 },
  { id: 'long_message', says: 'truncates its answer to a long message', p: 0.3 },
  { id: 'vat_invoice', says: 'gets the VAT invoice format wrong', p: 0.45 },
]
const BASE = 0.02

const GREEK: Record<string, string[]> = {
  order_status: ['πού είναι η παραγγελία μου {n}', 'κατάσταση παραγγελίας {n} παρακαλώ', 'πότε θα έρθει η παραγγελία {n}'],
  refund_status: ['πού είναι η επιστροφή χρημάτων για την παραγγελία {n}', 'δεν έχω πάρει τα χρήματα της παραγγελίας {n}'],
  cancel_order: ['θέλω να ακυρώσω την παραγγελία {n}', 'ακύρωση παραγγελίας {n}'],
  shipping_cost: ['πόσο κάνουν τα μεταφορικά', 'τι χρεώνετε για αποστολή'],
  shipping_time: ['σε πόσες μέρες παραδίδετε', 'πόσο καθυστερεί η αποστολή'],
  reset_password: ['ξέχασα τον κωδικό μου', 'δεν μπορώ να συνδεθώ'],
  payment_methods: ['τι τρόπους πληρωμής δέχεστε', 'δέχεστε αντικαταβολή'],
  refund_policy: ['ποια είναι η πολιτική επιστροφών', 'μπορώ να επιστρέψω ένα προϊόν'],
  invoice: ['χρειάζομαι τιμολόγιο για την παραγγελία {n}'],
}
const TAX = ['can i get a tax invoice for order {n}', 'i need a tax invoice with the vat number for order {n}']
const RAMBLE = 'i have been a customer for a long time and i really like your shop but this has happened to me before and last time it took weeks to sort out and nobody called me back so i would like this handled properly this time because it is important to me'

const NAMES = ['Maria Papadopoulou', 'Nikos Georgiou', 'Eleni Dimitriou', 'John Smith', 'Anna Schmidt', 'Pierre Dubois', 'Sofia Rossi', 'Carlos Ruiz']

export type LogRow = {
  id: number
  text: string
  /** what the log has: any of thumbs down, re-ask, escalation */
  signal: boolean
  /** hidden from the selector */
  truth: { intent: string; modes: string[]; failed: boolean }
  pii: { kind: 'email' | 'phone' | 'card' | 'name'; value: string; caught: boolean }[]
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function genLog(seed: number, n: number): LogRow[] {
  const r = mulberry32(seed * 7919 + 13)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const order = INTENTS.map((_, i) => i).sort(() => r() - 0.5)
  const weights = order.map((_, k) => 1 / (k + 1) ** 0.9)
  const total = weights.reduce((a, b) => a + b, 0)
  const draw = () => { let x = r() * total; for (let k = 0; k < order.length; k++) { x -= weights[k]; if (x <= 0) return order[k] } return order[0] }

  const rows: LogRow[] = []
  for (let i = 0; i < n; i++) {
    const it = INTENTS[draw()]
    const modes: string[] = []
    let text = pick(it.ask)
    const num = String(1000 + Math.floor(r() * 4000))
    if (GREEK[it.id] && r() < 0.14) { text = pick(GREEK[it.id]); modes.push('greek') }
    else if (it.id === 'invoice' && r() < 0.35) { text = pick(TAX); modes.push('vat_invoice') }
    text = text.replace('{n}', num)
    if (it.id === 'refund_status') modes.push('refund_date')
    if (it.id === 'international') modes.push('intl_rules')
    if (it.id === 'damaged_item') modes.push('damaged_escalation')
    if (/unsubscribe/.test(text)) modes.push('unsubscribe_confusion')
    if (r() < 0.03) { text = text.toUpperCase(); modes.push('shouting') }
    if (r() < 0.015) { text = `${text}. ${RAMBLE}`; modes.push('long_message') }

    const pii: LogRow['pii'] = []
    if (r() < 0.08) {
      const kind = pick(['email', 'phone', 'card'] as const)
      const value = kind === 'email' ? `user${Math.floor(r() * 9000)}@example.test` : kind === 'phone' ? `+30 69${Math.floor(1e7 + r() * 9e7)}` : '4111 1111 1111 1111'
      text += kind === 'email' ? ` my email is ${value}` : kind === 'phone' ? ` call me on ${value}` : ` card ${value}`
      pii.push({ kind, value, caught: false })
    }
    if (r() < 0.04) {
      const name = pick(NAMES)
      const form = Math.floor(r() * 5)
      text = [`this is ${name}, ${text}`, `${text} regards, ${name}`, `${name} here, ${text}`, `${text} - ${name}`, `ask for ${name}: ${text}`][form]
      pii.push({ kind: 'name', value: name, caught: false })
    }

    const p = modes.length ? Math.max(...modes.map((m) => MODES.find((x) => x.id === m)!.p)) : BASE
    const failed = r() < p
    const signal = failed ? r() < 0.45 || r() < 0.35 || r() < 0.25 : r() < 0.01 || r() < 0.03 || r() < 0.01
    rows.push({ id: i + 1, text: text.replace(/\s+/g, ' ').trim(), signal, truth: { intent: it.id, modes, failed }, pii })
  }
  return rows
}
