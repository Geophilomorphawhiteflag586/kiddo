/**
 * Сгенерировано `npm run assets:brand` — вручную не править.
 *
 * Пути к фирменным картинкам. Пустое значение означает «файла нет»: в этом
 * случае интерфейс рисует запасной вариант — логотип вёрсткой, значок
 * направления символом. Положите файл в assets-src/brand и перезапустите
 * команду, чтобы подставился ваш.
 */
export const BRAND_LOGO: string | null = '/brand/logo.webp';
export const BRAND_MARK: string | null = null;

/** Размеры нужны карточке: она берёт пропорцию своей картинки, чтобы
 *  показать её целиком, без обрезки и без пустых полей. */
export interface ModuleIcon {
  src: string;
  width: number;
  height: number;
}

export const MODULE_ICONS: Record<string, ModuleIcon> = {
  "geography": {
    "src": "/modules/geography.webp",
    "width": 1200,
    "height": 801
  },
  "mathematics": {
    "src": "/modules/mathematics.webp",
    "width": 1200,
    "height": 900
  },
  "english": {
    "src": "/modules/english.webp",
    "width": 1125,
    "height": 900
  },
  "chinese": {
    "src": "/modules/chinese.webp",
    "width": 1200,
    "height": 900
  },
  "anatomy": {
    "src": "/modules/anatomy.webp",
    "width": 1200,
    "height": 800
  },
  "chess": {
    "src": "/modules/chess.webp",
    "width": 1200,
    "height": 900
  },
  "people": {
    "src": "/modules/people.webp",
    "width": 825,
    "height": 608
  }
};
