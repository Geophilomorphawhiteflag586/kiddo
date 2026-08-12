import Image from 'next/image';
import { structureImage } from '../data/images.ts';

/**
 * Настоящая анатомическая иллюстрация структуры (учебник OpenStax).
 *
 * Возвращает null, если для структуры иллюстрации нет: вызывающий код в этом
 * случае показывает схему SVG. Картинка лежит на белой подложке — исходные
 * рисунки чёрно-белые либо на белом фоне, на тёмной панели они не читаются.
 */
export default function StructureImage({
  structureId,
  alt,
  className = '',
  sizes = '(max-width: 640px) 60vw, 320px',
  priority = false,
}: {
  structureId: string;
  /** Пустая строка — картинка декоративная: название рядом в тексте. */
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const image = structureImage(structureId);
  if (!image) return null;

  return (
    <span className={`relative block overflow-hidden rounded-xl bg-white ${className}`}>
      <Image
        src={image.src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-contain p-1"
      />
    </span>
  );
}
