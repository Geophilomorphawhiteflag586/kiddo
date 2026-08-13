/**
 * Реестр учебных направлений Kiddo. Learning Hub рисуется из этого списка —
 * добавление нового модуля не требует правки страницы.
 *
 * География и флаги живут в текущих маршрутах (`/`, `/play/*`, `/progress`) и
 * намеренно не переносились: реестр только ссылается на них.
 */

export type ModuleStatus = 'active' | 'soon';

/** Как считать прогресс карточки. Значение вычисляется в Learning Hub. */
export type ProgressKind =
  | 'geography'
  | 'math'
  | 'english'
  | 'chinese'
  | 'chess'
  | 'anatomy'
  | 'people'
  | 'none';

export interface LearningModule {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  topics: string[];
  href: string;
  status: ModuleStatus;
  progress: ProgressKind;
  /** Подпись на кнопке для активных модулей. */
  cta: string;
  /** Дополнительная строка под темами (например, «1000+ задач»). */
  note?: string;
  accent: string;
  /** Градиент карточки в Learning Hub: от левого верхнего угла к правому нижнему. */
  gradient: [string, string];
  /** Короткая подпись на карточке — под названием направления. */
  tagline: string;
}

export const LEARNING_MODULES: LearningModule[] = [
  {
    // Флаги — не отдельное направление, а один из навыков географии:
    // они живут в тех же режимах и в той же карточке страны.
    id: 'geography',
    gradient: ['#1d6fd8', '#0e3f8f'],
    tagline: 'Страны, флаги, столицы',
    title: 'География',
    subtitle: 'Страны, флаги и столицы на интерактивном глобусе',
    emoji: '🌍',
    topics: ['Флаги', 'Столицы', 'Контуры стран', 'Поиск на глобусе'],
    href: '/',
    status: 'active',
    progress: 'geography',
    cta: 'Продолжить',
    note: '194 страны · 6 навыков на каждую',
    accent: '#22c55e',
  },
  {
    id: 'mathematics',
    gradient: ['#f5642d', '#c01f4a'],
    tagline: 'Сложение и устный счёт',
    title: 'Математика',
    subtitle: 'Устный счёт короткими сессиями',
    emoji: '➕',
    topics: ['Сложение', 'Вычитание', 'Умножение', 'Деление'],
    href: '/math',
    status: 'active',
    progress: 'math',
    cta: 'Начать',
    accent: '#f59e0b',
  },
  {
    id: 'english',
    gradient: ['#4f46e5', '#7c3aed'],
    tagline: 'Английский язык',
    title: 'English',
    subtitle: 'Английские слова через картинки',
    emoji: '🇬🇧',
    topics: ['Vocabulary', 'Listening', 'Pronunciation'],
    href: '/english',
    status: 'active',
    progress: 'english',
    cta: 'Start learning',
    note: '400 слов · 300 существительных, 100 глаголов',
    accent: '#6366f1',
  },
  {
    id: 'chinese',
    gradient: ['#b02a6b', '#5b1b52'],
    tagline: 'Иероглифы, пиньинь и тоны',
    title: '中文',
    subtitle: 'Иероглифы, пиньинь и тоны',
    emoji: '🇨🇳',
    topics: ['Иероглифы', 'Пиньинь', 'Произношение', 'Аудирование'],
    href: '/chinese',
    status: 'active',
    progress: 'chinese',
    cta: '开始',
    note: '698 иероглифов · 4 навыка на знак',
    accent: '#ef4444',
  },
  {
    id: 'anatomy',
    gradient: ['#3f4756', '#12161f'],
    tagline: 'Органы, кости, мышцы',
    title: 'Анатомия',
    subtitle: 'Тело человека: узнать, найти, назвать',
    emoji: '🫀',
    topics: ['Органы', 'Кости по регионам', 'Мышцы', 'Полный скелет'],
    href: '/anatomy',
    status: 'active',
    progress: 'anatomy',
    cta: 'Изучать',
    note: 'Органы → кости → мышцы',
    accent: '#e879f9',
  },
  {
    id: 'people',
    gradient: ['#0f5ea8', '#0b2d5c'],
    tagline: 'Казахстан: лица и имена',
    title: 'Известные люди',
    subtitle: 'Кто это и чем известен',
    emoji: '👤',
    topics: ['Фото → имя', 'Имя → фото', 'Чем известен', 'Кем является'],
    href: '/people',
    status: 'active',
    progress: 'people',
    cta: 'Знакомиться',
    note: '125 человек · 4 навыка на каждого',
    accent: '#38bdf8',
  },
  {
    id: 'chess',
    gradient: ['#6b4b2a', '#2f1f12'],
    tagline: 'Мат в 1 ход, разбор попыток',
    title: 'Шахматы',
    subtitle: 'Мат в 1 ход — тренажёр мышления',
    emoji: '♟️',
    topics: ['Мат в 1 ход', 'Разбор попыток', 'Время на задачу'],
    href: '/chess',
    status: 'active',
    progress: 'chess',
    cta: 'Решать',
    note: '1000 задач',
    accent: '#94a3b8',
  },
];

/**
 * Единая учебная петля платформы. Все модули следуют ей — меняется только
 * предметное наполнение шагов.
 */
export const LEARNING_LOOP = ['Learn', 'Practice', 'Test', 'Master', 'Compete'] as const;

/** Та же петля по-русски — её видно на главной странице направлений. */
export const LEARNING_LOOP_RU = [
  'Учись',
  'Практикуй',
  'Проверяй',
  'Совершенствуйся',
] as const;
