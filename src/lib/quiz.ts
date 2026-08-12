import { CONFUSABLE_MAP } from '../data/confusables.ts';
import { COUNTRIES, WITHOUT_POLYGON, getCountry } from './countries.ts';
import { type ProfileData, totalConfusions } from './progress.ts';
import { cardKey, skillLevel } from './skills.ts';
import { errorRate, isDue } from './srs.ts';
import type { AgeMode, Country, CountryProgress, CountrySkill, ReviewCard } from './types';

export interface Question {
  skill: CountrySkill;
  countryCode: string;
  /** Коды-варианты ответа, уже перемешанные. Для countryLocation пустой. */
  options: string[];
  /** Подсказка для детского режима (название континента и т.п.). */
  hint?: string;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sample<T>(items: readonly T[], n: number): T[] {
  return shuffle(items).slice(0, n);
}

const confusionsFor = (
  progress: Record<string, CountryProgress>,
  code: string,
  skill: CountrySkill,
): Record<string, number> => progress[code]?.confusedWith[skill] ?? {};

const byCount = (confusions: Record<string, number>): string[] =>
  Object.entries(confusions)
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => code);

/**
 * Неправильные варианты для вопроса. Порядок приоритета: то, что пользователь
 * уже путал с этой страной в этом навыке → похожие флаги → соседи по
 * континенту → всё остальное. Случайные варианты со всего мира делают квиз
 * слишком лёгким.
 */
export function buildOptions(
  target: Country,
  pool: readonly Country[],
  count: number,
  personalConfusions: Record<string, number> = {},
): string[] {
  const picked = new Set<string>([target.code]);
  const inPool = new Set(pool.map((c) => c.code));
  const add = (codes: readonly string[]) => {
    for (const code of codes) {
      if (picked.size >= count) return;
      if (picked.has(code) || !inPool.has(code)) continue;
      picked.add(code);
    }
  };

  add(byCount(personalConfusions));
  add(shuffle(CONFUSABLE_MAP.get(target.code) ?? []));
  add(
    sample(pool.filter((c) => c.continent === target.continent && c.code !== target.code), count)
      .map((c) => c.code),
  );
  add(sample(pool, count * 2).map((c) => c.code));

  return shuffle([...picked]);
}

/** Отношение площадей ≤ этому порогу считаем «похожим размером» формы. */
const SIMILAR_AREA_RATIO = 8;

function shapeSimilar(a: Country, b: Country): boolean {
  const ratio = Math.max(a.area, b.area) / Math.max(1, Math.min(a.area, b.area));
  const bothIsland = a.landlocked === b.landlocked;
  return ratio <= SIMILAR_AREA_RATIO && bothIsland;
}

/**
 * Варианты для контурного режима. Контур не выдаёт цвета флага, поэтому
 * похожесть здесь другая: личная путаница контуров → тот же континент с
 * сопоставимой формой (размер, островной/континентальный характер) → тот же
 * континент → та же известность → любой fallback. Все варианты обязаны иметь
 * собственный контур, иначе после ответа их нельзя показать.
 */
export function buildOutlineOptions(
  target: Country,
  pool: readonly Country[],
  count: number,
  personalConfusions: Record<string, number> = {},
): string[] {
  const withOutline = pool.filter((c) => !WITHOUT_POLYGON.has(c.code));
  const picked = new Set<string>([target.code]);
  const inPool = new Set(withOutline.map((c) => c.code));
  const add = (codes: readonly string[]) => {
    for (const code of codes) {
      if (picked.size >= count) return;
      if (picked.has(code) || !inPool.has(code)) continue;
      picked.add(code);
    }
  };

  const sameContinent = withOutline.filter(
    (c) => c.continent === target.continent && c.code !== target.code,
  );

  add(byCount(personalConfusions));
  add(sample(sameContinent.filter((c) => shapeSimilar(c, target)), count).map((c) => c.code));
  add(sample(sameContinent, count).map((c) => c.code));
  add(
    sample(withOutline.filter((c) => c.tier === target.tier), count).map((c) => c.code),
  );
  add(sample(withOutline, count * 2).map((c) => c.code));

  return shuffle([...picked]);
}

function optionsFor(
  skill: CountrySkill,
  target: Country,
  pool: readonly Country[],
  count: number,
  progress: Record<string, CountryProgress>,
): string[] {
  if (skill === 'countryLocation') return [];
  if (skill === 'outlineToCountry') {
    return buildOutlineOptions(target, pool, count, confusionsFor(progress, target.code, skill));
  }
  return buildOptions(target, pool, count, confusionsFor(progress, target.code, skill));
}

export interface SessionOptions {
  data: ProfileData;
  pool: Country[];
  skills: CountrySkill[];
  length: number;
  ageMode?: AgeMode;
  now?: number;
}

interface SessionSettings {
  optionCount: number;
  hintFor: (skill: CountrySkill, country: Country) => string | undefined;
}

const CONTINENT_NAMES: Record<string, string> = {
  europe: 'Европа',
  asia: 'Азия',
  africa: 'Африка',
  'north-america': 'Северная Америка',
  'south-america': 'Южная Америка',
  oceania: 'Океания',
};

function settingsFor(ageMode: AgeMode): SessionSettings {
  if (ageMode === 'kid') {
    return {
      optionCount: 3,
      hintFor: (skill, country) =>
        skill === 'outlineToCountry' ? `Континент: ${CONTINENT_NAMES[country.continent]}` : undefined,
    };
  }
  return { optionCount: 4, hintFor: () => undefined };
}

/** В детском режиме показываем только известные страны, пока их хватает. */
function poolFor(pool: Country[], ageMode: AgeMode, minSize: number): Country[] {
  if (ageMode !== 'kid') return pool;
  const known = pool.filter((c) => c.tier <= 2);
  return known.length >= minSize ? known : pool;
}

/**
 * Персональная сессия. Приоритет:
 * просроченные повторения → страны из личной путаницы → слабые навыки уже
 * знакомых стран → новые страны → контрольное повторение освоенного.
 * «Недавние ошибки» отдельной ветки не требуют: ошибка ставит карточке
 * due ≈ +7 минут, и она попадает в просроченные первой.
 */
export function buildPersonalSession({
  data,
  pool,
  skills,
  length,
  ageMode = 'school',
  now = Date.now(),
}: SessionOptions): Question[] {
  const settings = settingsFor(ageMode);
  const effectivePool = poolFor(pool, ageMode, length * 2);
  const poolCodes = new Set(effectivePool.map((c) => c.code));

  const relevant = (card: ReviewCard) =>
    poolCodes.has(card.countryCode) &&
    skills.includes(card.skill) &&
    (card.skill !== 'outlineToCountry' || !WITHOUT_POLYGON.has(card.countryCode));

  const allCards = Object.values(data.cards).filter(relevant);

  const questions: Question[] = [];
  const used = new Set<string>();
  const perCountry = new Map<string, number>();

  const push = (code: string, skill: CountrySkill) => {
    if (questions.length >= length) return;
    if (skill === 'outlineToCountry' && WITHOUT_POLYGON.has(code)) return;
    const key = cardKey(code, skill);
    if (used.has(key)) return;
    // Не больше двух вопросов про одну страну, чтобы сессия не зацикливалась.
    if ((perCountry.get(code) ?? 0) >= 2) return;
    const country = getCountry(code);
    if (!country || !poolCodes.has(code)) return;
    used.add(key);
    perCountry.set(code, (perCountry.get(code) ?? 0) + 1);
    questions.push({
      skill,
      countryCode: code,
      options: optionsFor(skill, country, effectivePool, settings.optionCount, data.progress),
      hint: settings.hintFor(skill, country),
    });
  };

  // 1. Просроченные повторения — самые старые первыми.
  for (const card of allCards.filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due)) {
    push(card.countryCode, card.skill);
  }

  // 2. Страны, которые пользователь путает: спрашиваем обе стороны пары.
  for (const entry of Object.values(data.progress)) {
    if (questions.length >= length) break;
    for (const [skill, perSkill] of Object.entries(entry.confusedWith)) {
      if (!skills.includes(skill as CountrySkill)) continue;
      for (const other of byCount(perSkill ?? {})) {
        push(entry.countryCode, skill as CountrySkill);
        push(other, skill as CountrySkill);
      }
    }
  }

  // 3. Слабые навыки: высокая доля ошибок или низкий уровень при знакомстве.
  const weak = allCards
    .filter((c) => !isDue(c, now) && (errorRate(c) > 0.3 || skillLevel(c) <= 2))
    .sort((a, b) => errorRate(b) - errorRate(a));
  for (const card of weak) push(card.countryCode, card.skill);

  // 4. Незатронутые навыки уже знакомых стран: флаг знает — спросим столицу.
  const knownCodes = new Set(allCards.map((c) => c.countryCode));
  for (const code of knownCodes) {
    for (const skill of skills) {
      if (!data.cards[cardKey(code, skill)]) push(code, skill);
    }
  }

  // 5. Новые страны — от крупных и известных к редким.
  const fresh = effectivePool
    .filter((c) => !skills.some((skill) => data.cards[cardKey(c.code, skill)]))
    .sort((a, b) => a.tier - b.tier || b.area - a.area);
  let skillIndex = 0;
  for (const country of fresh) {
    if (questions.length >= length) break;
    push(country.code, skills[skillIndex++ % skills.length]);
  }

  // 6. Контрольное повторение освоенного, если вопросов всё ещё мало.
  for (const card of shuffle(allCards)) push(card.countryCode, card.skill);
  for (const country of shuffle(effectivePool)) {
    if (questions.length >= length) break;
    push(country.code, skills[skillIndex++ % skills.length]);
  }

  return questions.slice(0, length);
}

/**
 * Сравнительная тренировка по паре, которую пользователь стабильно путает.
 * Спрашиваем обе страны и подсовываем в варианты именно её двойника.
 */
export function buildConfusionDrill(
  a: string,
  b: string,
  skill: CountrySkill = 'flagToCountry',
): Question[] {
  const first = getCountry(a);
  const second = getCountry(b);
  if (!first || !second) return [];
  if (skill === 'outlineToCountry' && (WITHOUT_POLYGON.has(a) || WITHOUT_POLYGON.has(b))) {
    return [];
  }
  const extraPool = COUNTRIES.filter(
    (c) =>
      c.code !== a &&
      c.code !== b &&
      c.continent === first.continent &&
      (skill !== 'outlineToCountry' || !WITHOUT_POLYGON.has(c.code)),
  );
  const options = [a, b, ...sample(extraPool, 2).map((c) => c.code)];
  return shuffle([
    { skill, countryCode: a, options: shuffle(options) },
    { skill, countryCode: b, options: shuffle(options) },
  ]);
}

/**
 * Тренировка одной страны: все навыки по очереди (или один выбранный),
 * плюс страны, с которыми пользователь её путает.
 */
export function buildCountryTraining(
  code: string,
  data: ProfileData,
  skills: CountrySkill[],
  onlySkill?: CountrySkill,
): Question[] {
  const country = getCountry(code);
  if (!country) return [];

  const active = (onlySkill ? [onlySkill] : skills).filter(
    (skill) => skill !== 'outlineToCountry' || !WITHOUT_POLYGON.has(code),
  );

  const questions: Question[] = active.map((skill) => ({
    skill,
    countryCode: code,
    options: optionsFor(skill, country, COUNTRIES, 4, data.progress),
  }));

  // Добавляем двойников: пара сравнительных вопросов по самой частой путанице.
  const rivals = byCount(totalConfusions(data.progress[code] ?? { countryCode: code, confusedWith: {}, discoveredAt: null }));
  for (const rival of rivals.slice(0, 2)) {
    const drillSkill = onlySkill ?? 'flagToCountry';
    const rivalQuestion = buildConfusionDrill(code, rival, drillSkill).find(
      (q) => q.countryCode === rival,
    );
    if (rivalQuestion) questions.push(rivalQuestion);
  }

  return questions;
}
