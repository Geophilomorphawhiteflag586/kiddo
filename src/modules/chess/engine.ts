/**
 * Обёртка над шахматным движком. Правила не пишутся руками — их знает
 * chess.js: он же валидирует FEN, легальность хода, шах и мат.
 *
 * Здесь только классификация попытки на три исхода, ради которых и затевался
 * модуль: невозможный ход, легальный но не мат, и собственно мат.
 */
import { Chess, type Square } from 'chess.js';
import type { IllegalReason, MoveOutcome, PieceColor, PieceType } from './types.ts';

export interface BoardCell {
  square: string;
  piece: PieceType | null;
  color: PieceColor | null;
}

/** Раскладка позиции для отрисовки: 64 клетки от a8 к h1. */
export function boardFromFen(fen: string): BoardCell[] {
  const chess = new Chess(fen);
  return chess
    .board()
    .flat()
    .map((cell, index) => {
      const file = 'abcdefgh'[index % 8];
      const rank = 8 - Math.floor(index / 8);
      return {
        square: `${file}${rank}`,
        piece: (cell?.type as PieceType) ?? null,
        color: (cell?.color as PieceColor) ?? null,
      };
    });
}

export function sideToMove(fen: string): PieceColor {
  return new Chess(fen).turn() as PieceColor;
}

/** Фигура на клетке — нужно, чтобы понять, свою ли фигуру выбрал ребёнок. */
export function pieceAt(fen: string, square: string): { piece: PieceType; color: PieceColor } | null {
  const found = new Chess(fen).get(square as Square);
  return found ? { piece: found.type as PieceType, color: found.color as PieceColor } : null;
}

const PIECE_LETTER: Record<PieceType, string> = {
  p: '',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K',
};

/**
 * Достаёт ли фигура до поля с учётом преград, если забыть про безопасность
 * короля. Для всех фигур кроме пешки это ровно то, что знает `attackers`;
 * у пешки ход вперёд не считается атакой, поэтому разбирается отдельно.
 */
function reachesSquare(chess: Chess, from: string, to: string, piece: PieceType, color: PieceColor) {
  if (piece === 'p') {
    const direction = color === 'w' ? 1 : -1;
    const startRank = color === 'w' ? 2 : 7;
    const fromRank = Number(from[1]);
    const toRank = Number(to[1]);
    const target = chess.get(to as Square);

    if (from[0] === to[0] && !target) {
      if (toRank === fromRank + direction) return true;
      const between = `${from[0]}${fromRank + direction}`;
      return (
        toRank === fromRank + 2 * direction &&
        fromRank === startRank &&
        !chess.get(between as Square)
      );
    }
    // Бить пешка может только по диагонали и только чужую фигуру.
    return Boolean(target) && chess.attackers(to as Square, color).includes(from as Square);
  }
  return chess.attackers(to as Square, color).includes(from as Square);
}

/**
 * Пробует ход и классифицирует результат.
 *
 * Подсказок не даёт: где фигура может ходить, не показывается ни визуально, ни
 * текстом. Но причину отказа называет честно — сказать «так фигура не ходит»
 * про геометрически верный ход, запрещённый из-за шаха, значит обмануть.
 */
export function tryMove(fen: string, from: string, to: string): MoveOutcome {
  const chess = new Chess(fen);
  const moving = chess.get(from as Square);

  try {
    // Превращение в V1 всегда в ферзя: задачи с матом лёгкой фигурой
    // отфильтрованы генератором, поэтому выбор не требуется.
    const move = chess.move({ from, to, promotion: 'q' });
    const isCheckmate = chess.isCheckmate();
    return {
      legality: 'legal',
      result: isCheckmate ? 'checkmate' : 'legal_not_mate',
      san: move.san,
      piece: move.piece as PieceType,
      isCheck: chess.inCheck(),
      isCheckmate,
      reason: null,
    };
  } catch {
    // chess.js бросает исключение на нелегальном ходе — остаётся понять, почему.
    const piece = (moving?.type as PieceType) ?? null;
    const color = (moving?.color as PieceColor) ?? null;
    const target = chess.get(to as Square);

    let reason: IllegalReason = 'not_a_move';
    if (!piece || !color) reason = 'not_a_move';
    else if (target && target.color === color) reason = 'own_piece';
    else if (reachesSquare(chess, from, to, piece, color)) {
      // Геометрия в порядке — значит, дело в безопасности короля.
      reason = chess.inCheck() ? 'in_check' : 'exposes_king';
    }

    return {
      legality: 'illegal',
      result: 'illegal_move',
      san: `${piece ? PIECE_LETTER[piece] : ''}${to}?`,
      piece,
      isCheck: false,
      isCheckmate: false,
      reason,
    };
  }
}

/**
 * Проверка задачи при загрузке: позиция корректна, решение легально и
 * действительно ставит мат. Битые задачи до ребёнка не доходят.
 */
export function validatePuzzle(puzzle: {
  fen: string;
  from: string;
  to: string;
  sideToMove: PieceColor;
}): boolean {
  try {
    const chess = new Chess(puzzle.fen);
    if (chess.turn() !== puzzle.sideToMove) return false;
    if (chess.isGameOver()) return false;
    const outcome = tryMove(puzzle.fen, puzzle.from, puzzle.to);
    return outcome.result === 'checkmate';
  } catch {
    return false;
  }
}

/** Сколько ходов в позиции ставят мат — база должна содержать ровно один. */
export function countMateMoves(fen: string): number {
  try {
    return new Chess(fen).moves().filter((san) => san.endsWith('#')).length;
  } catch {
    return 0;
  }
}
