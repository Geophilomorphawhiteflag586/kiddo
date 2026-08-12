import { IMAGE_CREDIT } from '../data/images.ts';

/**
 * Указание источника иллюстраций. Лицензия CC BY-NC-SA 4.0 требует называть
 * автора и лицензию везде, где показан материал, — поэтому строка стоит на
 * всех экранах модуля, а не только в README.
 */
export default function ImageCredit({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-relaxed text-slate-500 ${className}`}>
      Анатомические иллюстрации:{' '}
      <a href={IMAGE_CREDIT.url} target="_blank" rel="noreferrer" className="hover:underline">
        «{IMAGE_CREDIT.source}»
      </a>
      , {IMAGE_CREDIT.publisher} —{' '}
      <a
        href={IMAGE_CREDIT.licenseUrl}
        target="_blank"
        rel="noreferrer"
        className="hover:underline"
      >
        {IMAGE_CREDIT.license}
      </a>
      . Рисунки обрезаны, подписи убраны. Access for free at openstax.org
    </p>
  );
}
