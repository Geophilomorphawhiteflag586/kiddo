/**
 * Генератор базы задач «мат в 1 ход».
 *
 *   npm run data:chess
 *
 * Позиции не набираются руками: скрипт расставляет фигуры по профилям и
 * проверяет каждую настоящим шахматным движком (chess.js). В базу попадает
 * только то, что прошло все проверки:
 *
 *   1. FEN корректен, позиция легальна;
 *   2. сторона, которая НЕ ходит, не под шахом (иначе позиция невозможна);
 *   3. сторона, которая ходит, тоже не под шахом — иначе ребёнок упирается
 *      в невидимое ограничение: почти любой его ход отклоняется;
 *   4. у стороны, которая ходит, есть ровно ОДИН ход, ставящий мат;
 *   5. до хода мата/пата ещё нет;
 *   6. решение — не превращение пешки (в V1 UI не спрашивает фигуру).
 *
 * Сложность задаётся не разбиением готового набора на трети, а самой
 * расстановкой: три профиля дают позиции разной густоты. Итоговый уровень
 * считается по абсолютной шкале (фигуры, ходы, ложные шахи, жертва), поэтому
 * «сложные» действительно сложные, а не «сложнее остальных».
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Chess } from 'chess.js';

const TARGET = Number(process.argv[2] ?? 1000);
const OUT = join(process.cwd(), 'public', 'data', 'chess-puzzles.json');

/** Детерминированный ГПСЧ — база воспроизводима при повторной генерации. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260811);

const FILES = 'abcdefgh';
const sq = (file, rank) => `${FILES[file]}${rank + 1}`;
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (list) => list[Math.floor(rng() * list.length)];

const adjacent = (a, b) =>
  Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])) <= 1 &&
  Math.abs(Number(a[1]) - Number(b[1])) <= 1;

/**
 * Профили расстановки. Разница между ними — не «чуть больше ходов», а
 * принципиально разная густота доски: от эндшпильной пустоты до позиции,
 * где мат прячется среди полутора десятков фигур.
 */
const PROFILES = [
  {
    name: 'sparse',
    whiteAttackers: [1, 2],
    blackBlockers: [1, 2],
    blackDefenders: [0, 1],
    whiteExtras: [0, 1],
  },
  {
    name: 'medium',
    whiteAttackers: [2, 3],
    blackBlockers: [2, 3],
    blackDefenders: [2, 3],
    whiteExtras: [1, 2],
  },
  {
    name: 'dense',
    whiteAttackers: [2, 4],
    blackBlockers: [2, 3],
    blackDefenders: [4, 6],
    whiteExtras: [2, 4],
  },
  {
    // Позиция как из настоящей партии: мат прячется среди полутора десятков
    // фигур, и почти каждый ход выглядит осмысленным.
    name: 'crowded',
    whiteAttackers: [3, 4],
    blackBlockers: [2, 3],
    blackDefenders: [6, 8],
    whiteExtras: [4, 6],
  },
];

const ATTACKERS = ['q', 'r', 'r', 'b', 'n'];
const DEFENDERS = ['r', 'b', 'n', 'p', 'p', 'p'];
const EXTRAS = ['p', 'p', 'p', 'n', 'b', 'r'];

/** Свободное поле в заданном диапазоне горизонталей. */
function freeSquare(board, minRank = 0, maxRank = 7) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = sq(randInt(0, 7), randInt(minRank, maxRank));
    if (!board.has(candidate)) return candidate;
  }
  return null;
}

/** Свободное поле рядом с указанным — так строится матовая сеть. */
function freeNear(board, center, radius = 1) {
  const file = FILES.indexOf(center[0]);
  const rank = Number(center[1]) - 1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const f = file + randInt(-radius, radius);
    const r = rank + randInt(-radius, radius);
    if (f < 0 || f > 7 || r < 0 || r > 7) continue;
    const candidate = sq(f, r);
    if (!board.has(candidate)) return candidate;
  }
  return null;
}

const canPlacePawn = (square) => {
  const rank = Number(square[1]);
  return rank > 1 && rank < 8;
};

function put(board, square, type, color) {
  if (!square) return false;
  if (type === 'p' && !canPlacePawn(square)) return false;
  board.set(square, { type, color });
  return true;
}

/** Собирает случайную позицию по профилю и отдаёт FEN с ходом белых. */
function buildPosition(profile) {
  const board = new Map();

  // Чёрный король — у края: там матовые сети встречаются чаще.
  const blackKing = rng() < 0.75 ? freeSquare(board, 5, 7) : freeSquare(board);
  if (!blackKing) return null;
  board.set(blackKing, { type: 'k', color: 'b' });

  // Свои же фигуры вокруг короля отнимают у него поля для бегства.
  const blockers = randInt(...profile.blackBlockers);
  for (let i = 0; i < blockers; i++) {
    const spot = freeNear(board, blackKing);
    put(board, spot, rng() < 0.7 ? 'p' : pick(['n', 'b', 'r']), 'b');
  }

  const whiteKing = (() => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = freeSquare(board);
      if (candidate && !adjacent(candidate, blackKing)) return candidate;
    }
    return null;
  })();
  if (!whiteKing) return null;
  board.set(whiteKing, { type: 'k', color: 'w' });

  // Атакующие: часть — рядом с чёрным королём, часть — на дистанции.
  const attackers = randInt(...profile.whiteAttackers);
  for (let i = 0; i < attackers; i++) {
    const spot = rng() < 0.5 ? freeNear(board, blackKing, 3) : freeSquare(board);
    put(board, spot, pick(ATTACKERS), 'w');
  }

  // Защитники чёрных — источник ложных следов: ход выглядит матом, но фигура
  // прикрыта или у короля находится лазейка.
  const defenders = randInt(...profile.blackDefenders);
  for (let i = 0; i < defenders; i++) {
    put(board, freeSquare(board), pick(DEFENDERS), 'b');
  }

  // Прочие белые фигуры делают позицию похожей на настоящую партию и
  // расширяют перебор.
  const extras = randInt(...profile.whiteExtras);
  for (let i = 0; i < extras; i++) {
    put(board, freeSquare(board), pick(EXTRAS), 'w');
  }

  const rows = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = board.get(sq(file, rank));
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        row += empty;
        empty = 0;
      }
      row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} w - - 0 1`;
}

/** Проверяет позицию движком и, если это корректный мат в 1, описывает задачу. */
function evaluate(fen) {
  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }

  try {
    const flipped = new Chess(fen.replace(' w ', ' b '));
    if (flipped.isCheck()) return null; // сторона, которая не ходит, под шахом
  } catch {
    return null;
  }

  if (chess.isGameOver()) return null;
  if (chess.isCheck()) return null;

  const moves = chess.moves({ verbose: true });
  const mates = moves.filter((move) => move.san.endsWith('#'));
  if (mates.length !== 1) return null;

  const solution = mates[0];
  if (solution.san.includes('=')) return null;

  return { chess, moves, solution };
}

function themeOf(chess, solution) {
  const enemyKing = chess
    .board()
    .flat()
    .find((cell) => cell && cell.type === 'k' && cell.color === 'b');
  const kingRank = enemyKing ? Number(enemyKing.square[1]) : 0;

  if (solution.piece === 'n') return 'knight_mate';
  if (solution.piece === 'p') return 'pawn_mate';
  if ((solution.piece === 'r' || solution.piece === 'q') && Number(solution.to[1]) === kingRank) {
    return kingRank === 8 || kingRank === 1 ? 'back_rank' : 'rank_mate';
  }
  if (solution.piece === 'q') return 'queen_mate';
  if (solution.piece === 'r') return 'rook_mate';
  if (solution.piece === 'b') return 'bishop_mate';
  return 'other';
}

/**
 * Абсолютная оценка трудности. Считается по тому, что реально мешает найти мат:
 *
 *  - сколько всего ходов приходится перебрать;
 *  - сколько фигур на доске;
 *  - сколько ходов дают шах, но не мат — это самые обидные ложные следы;
 *  - можно ли побить матующую фигуру (ход выглядит «нельзя так»,
 *    и ребёнок его пропускает);
 *  - мат тихой фигурой заметить труднее, чем ферзём в упор.
 */
function measure(chess, moves, solution) {
  const pieces = chess.board().flat().filter(Boolean).length;
  const falseChecks = moves.filter((m) => m.san.endsWith('+')).length;

  // Матующая фигура под боем — значит, ход похож на зевок.
  const after = new Chess(chess.fen());
  after.move(solution.san);
  const sacrifice = after.attackers(solution.to, 'b').length > 0;

  const quiet = solution.piece === 'n' || solution.piece === 'b' || solution.piece === 'p';

  const score =
    moves.length * 0.6 +
    pieces * 1.6 +
    falseChecks * 3.5 +
    (sacrifice ? 9 : 0) +
    (quiet ? 5 : 0);

  return { pieces, falseChecks, sacrifice, score };
}

/** Пороги подобраны по фактическому разбросу оценок (см. вывод скрипта). */
function levelOf(score) {
  if (score < 42) return 1;
  if (score < 60) return 2;
  return 3;
}

const puzzles = [];
const seenFen = new Set();
let tries = 0;

/**
 * Квоты по уровням. Без них густые профили быстро забивают базу сложными
 * позициями, и новичку не с чего начать: лёгких задач набирается на десяток
 * сессий. Уровень, который уже набран, дальше отбрасывается.
 */
const QUOTA = {
  1: Math.round(TARGET * 0.3),
  2: Math.round(TARGET * 0.35),
  3: TARGET - Math.round(TARGET * 0.3) - Math.round(TARGET * 0.35),
};
const filled = { 1: 0, 2: 0, 3: 0 };
const quotaLeft = (level) =>
  filled[level] < QUOTA[level] && puzzles.length < TARGET;

// Профили чередуются, чтобы все уровни набирались параллельно.
while (puzzles.length < TARGET && tries < 8_000_000) {
  tries += 1;
  const profile = PROFILES[tries % PROFILES.length];
  const fen = buildPosition(profile);
  if (!fen || seenFen.has(fen)) continue;

  const evaluated = evaluate(fen);
  if (!evaluated) continue;

  const { chess, moves, solution } = evaluated;
  const metrics = measure(chess, moves, solution);
  const level = levelOf(metrics.score);
  if (!quotaLeft(level)) continue;

  seenFen.add(fen);
  filled[level] += 1;

  puzzles.push({
    id: puzzles.length + 1,
    fen,
    sideToMove: 'w',
    from: solution.from,
    to: solution.to,
    piece: solution.piece,
    solutionSan: solution.san,
    difficulty: level,
    theme: themeOf(chess, solution),
    legalMoves: moves.length,
    pieces: metrics.pieces,
    falseChecks: metrics.falseChecks,
  });
}

// Внутри уровня — от простого к сложному, сами уровни идут подряд.
puzzles.sort((a, b) => a.difficulty - b.difficulty || a.legalMoves - b.legalMoves);
puzzles.forEach((puzzle, index) => {
  puzzle.id = index + 1;
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ version: 2, puzzles }), 'utf8');

const summary = (level) => {
  const subset = puzzles.filter((p) => p.difficulty === level);
  if (subset.length === 0) return `уровень ${level}: пусто`;
  const avg = (get) => (subset.reduce((sum, p) => sum + get(p), 0) / subset.length).toFixed(1);
  return `уровень ${level}: ${subset.length} задач · фигур ${avg((p) => p.pieces)} · ходов ${avg(
    (p) => p.legalMoves,
  )} · ложных шахов ${avg((p) => p.falseChecks)}`;
};

console.log(`Сгенерировано задач: ${puzzles.length} (перебрано позиций: ${tries})`);
for (const level of [1, 2, 3]) console.log(summary(level));
console.log(
  'По темам:',
  puzzles.reduce((acc, p) => {
    acc[p.theme] = (acc[p.theme] ?? 0) + 1;
    return acc;
  }, {}),
);
