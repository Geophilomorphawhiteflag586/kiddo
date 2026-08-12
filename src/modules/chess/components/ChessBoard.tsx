'use client';

import { useMemo } from 'react';
import { PIECE_GLYPHS } from '../config.ts';
import { boardFromFen } from '../engine.ts';
import type { PieceColor } from '../types.ts';

interface Props {
  fen: string;
  /** Выбранная фигура — единственная подсветка, которая здесь допустима. */
  selected: string | null;
  onSquareClick: (square: string) => void;
  /** Ходящая сторона внизу доски — так привычнее решать задачу. */
  orientation?: PieceColor;
  disabled?: boolean;
  /** Клетки последней попытки: откуда и куда. Показываются после ответа. */
  lastFrom?: string | null;
  lastTo?: string | null;
  lastWasMate?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Шахматная доска.
 *
 * Принципиально НЕ показывает возможные ходы: ни зелёных клеток, ни стрелок,
 * ни линий. Понять, куда фигура может пойти, — часть задачи, и подсказка
 * лишила бы упражнение смысла. Подсвечивается только выбранная фигура и —
 * уже после ответа — клетки сделанной попытки.
 */
export default function ChessBoard({
  fen,
  selected,
  onSquareClick,
  orientation = 'w',
  disabled = false,
  lastFrom = null,
  lastTo = null,
  lastWasMate = false,
}: Props) {
  const cells = useMemo(() => {
    const board = boardFromFen(fen);
    return orientation === 'w' ? board : [...board].reverse();
  }, [fen, orientation]);

  const files = orientation === 'w' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="inline-block select-none">
      <div className="flex">
        <div className="flex flex-col justify-around pr-1 text-[10px] font-bold text-slate-600">
          {ranks.map((rank) => (
            <span key={rank} className="grid h-[calc(min(11vw,3.25rem))] place-items-center">
              {rank}
            </span>
          ))}
        </div>

        <div
          className="grid grid-cols-8 overflow-hidden rounded-lg border-2 border-line"
          role="grid"
          aria-label="Шахматная доска"
        >
          {cells.map((cell) => {
            const file = FILES.indexOf(cell.square[0]);
            const rank = Number(cell.square[1]);
            const dark = (file + rank) % 2 === 0;
            const isSelected = cell.square === selected;
            const isFrom = cell.square === lastFrom;
            const isTo = cell.square === lastTo;

            return (
              <button
                key={cell.square}
                type="button"
                role="gridcell"
                disabled={disabled}
                onClick={() => onSquareClick(cell.square)}
                aria-label={`${cell.square}${
                  cell.piece ? `, ${cell.color === 'w' ? 'белая' : 'чёрная'} фигура` : ', пусто'
                }`}
                className={`relative grid h-[min(11vw,3.25rem)] w-[min(11vw,3.25rem)] place-items-center text-[min(8vw,2.4rem)] leading-none transition ${
                  dark ? 'bg-[#3a4256]' : 'bg-[#8792ab]'
                } ${isSelected ? 'outline outline-[3px] -outline-offset-[3px] outline-amber-300' : ''} ${
                  disabled ? '' : 'hover:brightness-110'
                }`}
              >
                {/* След последней попытки — виден только после ответа. */}
                {(isFrom || isTo) && (
                  <span
                    aria-hidden
                    className={`absolute inset-0 ${
                      lastWasMate ? 'bg-emerald-400/35' : 'bg-rose-400/35'
                    }`}
                  />
                )}
                {cell.piece && cell.color && (
                  <span
                    aria-hidden
                    className={`relative ${
                      cell.color === 'w'
                        ? 'text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]'
                        : 'text-[#10131c]'
                    }`}
                  >
                    {PIECE_GLYPHS[`${cell.color}${cell.piece}`]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex pl-4">
        {files.map((file) => (
          <span
            key={file}
            className="grid w-[min(11vw,3.25rem)] place-items-center pt-1 text-[10px] font-bold text-slate-600"
          >
            {file}
          </span>
        ))}
      </div>
    </div>
  );
}
