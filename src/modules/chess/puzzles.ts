'use client';

import { useEffect, useState } from 'react';
import type { ChessPuzzle } from './types.ts';

/**
 * База задач лежит отдельным файлом и грузится один раз на всё приложение:
 * 1000 позиций весят ~180 КБ, и держать их в основном бандле незачем.
 */
let promise: Promise<ChessPuzzle[]> | null = null;

export function loadPuzzles(): Promise<ChessPuzzle[]> {
  promise ??= fetch('/data/chess-puzzles.json')
    .then((res) => res.json())
    .then((json: { puzzles: ChessPuzzle[] }) => json.puzzles);
  return promise;
}

export function usePuzzles(): ChessPuzzle[] | null {
  const [puzzles, setPuzzles] = useState<ChessPuzzle[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadPuzzles().then((list) => {
      if (alive) setPuzzles(list);
    });
    return () => {
      alive = false;
    };
  }, []);
  return puzzles;
}
