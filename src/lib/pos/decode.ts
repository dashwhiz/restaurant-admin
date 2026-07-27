// The LYRA POS exports Macedonian Cyrillic in a 7-bit scheme: some ASCII symbols
// stand in for Cyrillic letters, the rest are Latin equivalents. This decoder was
// validated against the real export files. See docs/features/pos-import.md.

const POS_SYMBOL: Record<string, string> = {
  '@': 'Ж', '[': 'Ш', ']': 'Ќ', '^': 'Ч', W: 'Њ', X: 'Џ', Q: 'Љ',
  '{': 'ш', '}': 'ќ', '~': 'ч', w: 'њ', x: 'џ', q: 'љ',
};

const POS_LAT_CYR: Record<string, string> = {
  A: 'А', B: 'Б', V: 'В', G: 'Г', D: 'Д', E: 'Е', Z: 'З', I: 'И', J: 'Ј',
  K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', R: 'Р', S: 'С', T: 'Т',
  U: 'У', F: 'Ф', H: 'Х', C: 'Ц',
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и', j: 'ј',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т',
  u: 'у', f: 'ф', h: 'х', c: 'ц',
};

/** Decode a raw 7-bit POS string to Macedonian Cyrillic. */
export function decodePOS(s: string): string {
  return (s || '')
    .split('')
    .map((ch) => POS_SYMBOL[ch] ?? POS_LAT_CYR[ch] ?? ch)
    .join('');
}

/** Decode a raw POS name, collapse whitespace, and Title Case it. */
export function cleanPOSName(raw: string): string {
  const s = decodePOS((raw || '').trim()).replace(/\s+/g, ' ').trim();
  return s
    .split(' ')
    .map((w) => (w ? w[0].toLocaleUpperCase('mk') + w.slice(1).toLocaleLowerCase('mk') : ''))
    .join(' ');
}
