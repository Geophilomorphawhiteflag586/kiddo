/**
 * Источники анатомических иллюстраций.
 *
 * Их два, и требования у них разные: учебник OpenStax обязывает называть
 * автора и лицензию везде, где показан материал, плакат такого требования не
 * несёт, но источник всё равно указывается — так честнее.
 */
export interface ImageCreditEntry {
  source: string;
  publisher: string;
  url?: string;
  license: string;
  licenseUrl?: string;
}

export const OPENSTAX_CREDIT: ImageCreditEntry = {
  source: 'Anatomy and Physiology 2e',
  publisher: 'OpenStax, Rice University',
  url: 'https://openstax.org/details/books/anatomy-and-physiology-2e',
  license: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
};

/**
 * Набор рисунков органов, предоставленный владельцем проекта. Права на него
 * подтверждает владелец; если источник изменится — поправьте эту запись.
 */
export const POSTER_CREDIT: ImageCreditEntry = {
  source: 'Набор анатомических рисунков',
  publisher: 'предоставлен владельцем проекта',
  license: 'использование разрешено владельцем',
};

/** Совместимость: прежнее имя указывает на учебник. */
export const IMAGE_CREDIT = OPENSTAX_CREDIT;
