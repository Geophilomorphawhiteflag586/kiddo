/**
 * Логотип Kiddo.
 *
 * Собран вёрсткой, а не картинкой: буквы набраны уже загруженным Nunito
 * ExtraBold, поэтому логотип остаётся чётким на любом экране и масштабе, а
 * цвета берутся из тех же токенов, что и остальной интерфейс.
 *
 * Если понадобится точный оригинал — положите файл в `public/brand/` и
 * замените разметку на <Image>; API компонента при этом менять не нужно.
 */

/** Фирменные цвета: по одному на букву. */
export const BRAND = {
  purple: '#6C4FD8',
  yellow: '#FFC61E',
  blue: '#1E88E5',
  teal: '#12B886',
  orange: '#FA6A28',
} as const;

const LETTERS = [
  { char: 'k', color: BRAND.purple },
  { char: 'i', color: BRAND.yellow },
  { char: 'd', color: BRAND.blue },
  { char: 'd', color: BRAND.teal },
] as const;

/** Оранжевая «o» с глазами — она же самостоятельный знак бренда. */
export function KiddoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Kiddo">
      <circle cx="50" cy="50" r="46" fill={BRAND.orange} />
      <circle cx="50" cy="50" r="17" fill="#ffffff" />
      <circle cx="37" cy="40" r="6.5" fill="#14161f" />
      <circle cx="63" cy="40" r="6.5" fill="#14161f" />
    </svg>
  );
}

/** Искры над словом — тот же ритм цветов, что и в буквах. */
function Sparkles() {
  return (
    <svg viewBox="0 0 120 40" className="absolute -top-[0.42em] left-[0.9em] h-[0.5em] w-[1.5em]">
      <g strokeLinecap="round" strokeWidth="9" fill="none">
        <path d="M14 34 L8 12" stroke={BRAND.purple} />
        <path d="M46 28 L46 6" stroke={BRAND.yellow} />
        <path d="M78 28 L84 8" stroke={BRAND.teal} />
        <path d="M106 34 L114 16" stroke={BRAND.orange} />
      </g>
    </svg>
  );
}

export default function KiddoLogo({
  className = '',
  withTagline = false,
  sparkles = true,
}: {
  className?: string;
  /** Подпись «Learn. Play. Grow.» под словом. */
  withTagline?: boolean;
  sparkles?: boolean;
}) {
  return (
    <span className={`inline-flex flex-col items-center leading-none ${className}`}>
      <span className="relative inline-flex items-baseline font-[900] tracking-[-0.04em]">
        {sparkles && <Sparkles />}
        {LETTERS.map((letter, index) => (
          <span key={index} style={{ color: letter.color }}>
            {letter.char}
          </span>
        ))}
        <KiddoMark className="ml-[0.04em] h-[0.78em] w-[0.78em] self-center" />
      </span>

      {/* Дуга под словом — повторяет росчерк из логотипа. */}
      <svg viewBox="0 0 200 16" className="mt-[0.06em] h-[0.14em] w-[0.95em] scale-x-[3.2]">
        <path
          d="M6 4 Q100 22 194 4"
          fill="none"
          stroke={BRAND.purple}
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>

      {withTagline && (
        <span className="mt-[0.28em] text-[0.235em] font-[900] tracking-tight">
          <span style={{ color: BRAND.purple }}>Learn</span>
          <span style={{ color: BRAND.yellow }}>.</span>{' '}
          <span style={{ color: BRAND.blue }}>Play</span>
          <span style={{ color: BRAND.orange }}>.</span>{' '}
          <span style={{ color: BRAND.teal }}>Grow</span>
          <span style={{ color: BRAND.yellow }}>.</span>
        </span>
      )}
    </span>
  );
}
