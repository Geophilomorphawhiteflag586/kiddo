import type { IllegalReason, PuzzleTheme } from './types.ts';

/** Задач в одной сессии. */
export const SESSION_LENGTH = 10;

/**
 * XP только начисляется. Ошибка ничего не отнимает: неверный ход — это часть
 * поиска, а не провал, и бояться его ребёнок не должен.
 */
export const CHESS_XP = {
  solved: 10,
  firstTryBonus: 5,
} as const;

export const TOTAL_PUZZLES = 1000;

export const THEME_LABELS: Record<PuzzleTheme, string> = {
  back_rank: 'Мат на последней горизонтали',
  rank_mate: 'Мат по горизонтали',
  queen_mate: 'Мат ферзём',
  rook_mate: 'Мат ладьёй',
  bishop_mate: 'Мат слоном',
  knight_mate: 'Мат конём',
  pawn_mate: 'Мат пешкой',
  other: 'Другое',
};

export const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Простые',
  2: 'Средние',
  3: 'Сложные',
};

/**
 * Причины отказа. Формулировки называют препятствие, но не подсказывают, куда
 * фигура ходить умеет и где искать мат.
 */
export const ILLEGAL_MESSAGES: Record<
  IllegalReason,
  { title: string; hint: string }
> = {
  own_piece: {
    title: 'Там стоит ваша фигура',
    hint: 'Своих бить нельзя',
  },
  in_check: {
    title: 'Ваш король под шахом',
    hint: 'Сначала нужно спасти короля — этот ход его не защищает',
  },
  exposes_king: {
    title: 'Так ходить нельзя: откроется ваш король',
    hint: 'Эта фигура сейчас прикрывает короля',
  },
  not_a_move: {
    title: 'Так эта фигура не ходит',
    hint: 'Или путь до этой клетки перекрыт',
  },
};

/** Символы фигур: без картинок и внешних файлов, работает офлайн. */
export const PIECE_GLYPHS: Record<string, string> = {
  wk: '♔',
  wq: '♕',
  wr: '♖',
  wb: '♗',
  wn: '♘',
  wp: '♙',
  bk: '♚',
  bq: '♛',
  br: '♜',
  bb: '♝',
  bn: '♞',
  bp: '♟',
};
