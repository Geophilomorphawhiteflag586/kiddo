import { OPENSTAX_CREDIT, POSTER_CREDIT } from '../data/credits.ts';

/**
 * Указание источника иллюстраций. Лицензия CC BY-NC-SA 4.0 требует называть
 * автора и лицензию везде, где показан материал, — поэтому строка стоит на
 * всех экранах модуля, а не только в README.
 */
export default function ImageCredit({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-relaxed text-slate-400 ${className}`}>
      Анатомические иллюстрации:{' '}
      <a href={OPENSTAX_CREDIT.url} target="_blank" rel="noreferrer" className="hover:underline">
        «{OPENSTAX_CREDIT.source}»
      </a>
      , {OPENSTAX_CREDIT.publisher} —{' '}
      <a
        href={OPENSTAX_CREDIT.licenseUrl}
        target="_blank"
        rel="noreferrer"
        className="hover:underline"
      >
        {OPENSTAX_CREDIT.license}
      </a>
      . Рисунки обрезаны, подписи убраны. Access for free at openstax.org.
      {' '}Рисунки органов — {POSTER_CREDIT.publisher}.
    </p>
  );
}
