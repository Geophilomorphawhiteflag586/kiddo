import Image from 'next/image';
import { flagUrl, getCountry } from '@/lib/countries';

interface Props {
  code: string;
  /** Высота блока в пикселях. Пропорции флага сохраняются. */
  size?: number;
  className?: string;
  priority?: boolean;
  /** В квизе название страны нельзя раскрывать даже в alt. */
  alt?: string;
}

/**
 * Флаг в фиксированной рамке. object-contain, а не cover: у Непала, Швейцарии
 * и Ватикана нестандартные пропорции, обрезать их нельзя.
 */
export default function FlagImage({ code, size = 120, className = '', priority, alt }: Props) {
  const country = getCountry(code);
  return (
    <div
      className={`relative overflow-hidden bg-slate-900/60 flag ${className}`}
      style={{ height: size, width: size * 1.5 }}
    >
      <Image
        src={flagUrl(code)}
        alt={alt ?? (country ? `Флаг: ${country.name}` : code)}
        fill
        sizes={`${Math.round(size * 1.5)}px`}
        className="object-contain"
        priority={priority}
      />
    </div>
  );
}
