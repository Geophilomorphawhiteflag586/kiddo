'use client';

import Image from 'next/image';
import type { EnglishWord } from '../types.ts';

/**
 * Изображение слова. Сейчас это эмодзи; как только в public/english/images
 * появится файл и поле `image` будет заполнено, компонент покажет картинку —
 * менять вызовы не придётся. Внешние CDN не используются.
 */
export default function WordVisual({
  word,
  size = 120,
  className = '',
}: {
  word: EnglishWord;
  size?: number;
  className?: string;
}) {
  if (word.image) {
    return (
      <Image
        src={word.image}
        alt=""
        width={size}
        height={size}
        className={`object-contain ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-hidden
      className={`select-none leading-none ${className}`}
      style={{ fontSize: size }}
    >
      {word.emoji}
    </span>
  );
}
