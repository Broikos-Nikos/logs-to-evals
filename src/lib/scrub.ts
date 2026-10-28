/**
 * Takes the personal data out of a log line before it can become a test case.
 *
 * It removes what has a shape: email addresses, card numbers, phone numbers and
 * order numbers. It does not remove names. A name has no shape a regular
 * expression can hold, so the only names it removes are the ones that follow a
 * phrase that introduces one, and the measurement reports how many it still
 * misses. A scrubber that claims to remove names is a scrubber that has not been
 * measured.
 */

const RULES: [string, RegExp][] = [
  ['<EMAIL>', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['<CARD>', /\b(?:\d[ -]?){13,19}\b/g],
  ['<PHONE>', /(?:\+\d{1,3}[ -]?)?\(?\d{2,4}\)?[ -]?\d{3,4}[ -]?\d{3,4}\b/g],
  ['<ORDER>', /(?<=\border\b[^0-9]{0,12})\d{3,}/gi],
  ['<NAME>', /(?<=\b(?:my name is|i am|i'm|this is|name:|regards,|thanks,)\s+)(?:[A-ZΑ-Ω][\p{L}'-]+)(?:\s+[A-ZΑ-Ω][\p{L}'-]+)?/gu],
]

export function scrub(text: string): string {
  let t = text
  for (const [tag, re] of RULES) t = t.replace(re, tag)
  return t
}
