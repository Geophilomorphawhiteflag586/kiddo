import Image from 'next/image';
import { getPerson } from '../people.ts';

/**
 * Фотография человека.
 *
 * У ханов и жырау фотографий не существует — там портрет или памятник, и об
 * этом сказано прямо на карточке. Ребёнок должен понимать, что настоящего
 * лица Абылай хана никто не знает: иначе он запомнит фантазию художника как
 * документальный факт.
 */
export default function PersonPhoto({
  personId,
  className = '',
  sizes = '(max-width: 640px) 60vw, 260px',
  priority = false,
  showKind = false,
}: {
  personId: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Показывать пометку «портрет, не фотография». */
  showKind?: boolean;
}) {
  const person = getPerson(personId);
  if (!person) return null;

  return (
    <span className={`relative block overflow-hidden rounded-2xl bg-ink-700 ${className}`}>
      <Image
        src={`/people/${person.id}.webp`}
        alt={person.nameRu}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
      {showKind && person.imageKind === 'depiction' && (
        <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center text-[11px] font-bold text-amber-300">
          портрет, а не фотография
        </span>
      )}
    </span>
  );
}
