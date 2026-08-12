/**
 * Работа с пиньинем и тонами. Тон — не украшение: mā/má/mǎ/mà это разные
 * слоги, поэтому тон хранится отдельно, а не только рисуется диакритикой.
 *
 * Единственный источник правды — сам пиньинь с диакритикой; номер тона из
 * него выводится. Так в базе не может появиться слог, у которого поле tone
 * расходится со значком (тест это проверяет).
 */

export type Tone = 1 | 2 | 3 | 4 | 5;

/** Гласные с диакритикой по тонам: индекс = тон − 1. */
const TONE_MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

const MARK_TO_PLAIN = new Map<string, { plain: string; tone: Tone }>();
for (const [plain, marks] of Object.entries(TONE_MARKS)) {
  marks.forEach((mark, index) => {
    MARK_TO_PLAIN.set(mark, { plain, tone: (index + 1) as Tone });
  });
}

/** Номер тона слога. Без диакритики — нейтральный тон (5). */
export function toneOf(pinyin: string): Tone {
  for (const char of pinyin) {
    const found = MARK_TO_PLAIN.get(char);
    if (found) return found.tone;
  }
  return 5;
}

/** Слог без тона: nǐ → ni, lǜ → lü. */
export function stripTone(pinyin: string): string {
  return [...pinyin].map((char) => MARK_TO_PLAIN.get(char)?.plain ?? char).join('');
}

/**
 * Ставит тон на слог по правилам пиньиня: приоритет у «a», затем «o»/«e»,
 * в сочетаниях iu/ui знак идёт на последнюю гласную.
 */
export function applyTone(base: string, tone: Tone): string {
  const plain = stripTone(base);
  if (tone === 5) return plain;

  const vowels = [...plain]
    .map((char, index) => ({ char, index }))
    .filter(({ char }) => char in TONE_MARKS);
  if (vowels.length === 0) return plain;

  let target = vowels[vowels.length - 1];
  const a = vowels.find((v) => v.char === 'a');
  const oe = vowels.find((v) => v.char === 'o' || v.char === 'e');
  if (a) target = a;
  else if (oe && !/iu$|ui$/.test(plain)) target = oe;

  const chars = [...plain];
  chars[target.index] = TONE_MARKS[target.char][tone - 1];
  return chars.join('');
}

/** Все четыре тоновых варианта слога — основа «злых» вариантов ответа. */
export function toneVariants(pinyin: string): string[] {
  const base = stripTone(pinyin);
  return ([1, 2, 3, 4] as Tone[]).map((tone) => applyTone(base, tone));
}

/** Инициали путунхуа, от длинных к коротким — порядок важен для разбора. */
const INITIALS = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
  'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
];

/** Начальный согласный слога: nǐ → n, zhōng → zh, ér → ''. */
export function initialOf(pinyin: string): string {
  const base = stripTone(pinyin);
  return INITIALS.find((initial) => base.startsWith(initial)) ?? '';
}

/** Финаль слога — всё после инициали: nǐ → i, zhōng → ong. */
export function finalOf(pinyin: string): string {
  const base = stripTone(pinyin);
  return base.slice(initialOf(pinyin).length);
}

/**
 * Похоже ли звучание двух слогов. Такие пары — самые полезные неправильные
 * варианты: они заставляют вслушиваться, а не угадывать по первой букве.
 */
export function soundsSimilar(a: string, b: string): boolean {
  if (a === b) return false;
  const baseA = stripTone(a);
  const baseB = stripTone(b);
  if (baseA === baseB) return true; // тоновые двойники
  return finalOf(a) === finalOf(b) || initialOf(a) === initialOf(b);
}

export const TONE_NAMES: Record<Tone, string> = {
  1: '1-й тон (ровный)',
  2: '2-й тон (восходящий)',
  3: '3-й тон (нисходяще-восходящий)',
  4: '4-й тон (нисходящий)',
  5: 'нейтральный тон',
};
