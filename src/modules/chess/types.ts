export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export type PuzzleTheme =
  | 'back_rank'
  | 'rank_mate'
  | 'queen_mate'
  | 'rook_mate'
  | 'bishop_mate'
  | 'knight_mate'
  | 'pawn_mate'
  | 'other';

export interface ChessPuzzle {
  id: number;
  /** Позиция в FEN — единственный источник правды, не картинка. */
  fen: string;
  sideToMove: PieceColor;
  from: string;
  to: string;
  piece: PieceType;
  solutionSan: string;
  difficulty: 1 | 2 | 3;
  theme: PuzzleTheme;
  /** Сколько всего легальных ходов в позиции — оценка «поля перебора». */
  legalMoves: number;
  /** Фигур на доске: густота позиции — главный признак трудности. */
  pieces: number;
  /** Ходов, дающих шах, но не мат, — самые обидные ложные следы. */
  falseChecks: number;
}

/** Ход бывает трёх видов, и разница между ними — суть обучения. */
export type AttemptResult = 'illegal_move' | 'legal_not_mate' | 'checkmate';
export type MoveLegality = 'illegal' | 'legal';

/**
 * Почему ход не принят. Разница важна: сказать «так фигура не ходит» про
 * геометрически верный ход — соврать ребёнку.
 */
export type IllegalReason =
  /** На поле стоит своя же фигура. */
  | 'own_piece'
  /** Король под шахом, и этот ход его не спасает. */
  | 'in_check'
  /** Ход возможен, но открывает своего короля (связка). */
  | 'exposes_king'
  /** Фигура так не ходит или путь перекрыт. */
  | 'not_a_move';

export interface MoveOutcome {
  legality: MoveLegality;
  result: AttemptResult;
  /** Запись хода: SAN для легального, «Qh8?» для невозможного. */
  san: string;
  piece: PieceType | null;
  isCheck: boolean;
  isCheckmate: boolean;
  /** Заполняется только для отклонённых ходов. */
  reason: IllegalReason | null;
}

/** Одна попытка ребёнка. Хранится целиком — по ней виден ход мысли. */
export interface ChessAttempt {
  attemptNumber: number;
  from: string;
  to: string;
  piece: PieceType | null;
  move: string;
  legality: MoveLegality;
  result: AttemptResult;
  reason: IllegalReason | null;
  isCheck: boolean;
  isCheckmate: boolean;
  at: string;
  /** Мс от открытия задачи. */
  elapsedTimeMs: number;
  /** Мс с предыдущей попытки: видно, думал ребёнок или перебирал наугад. */
  timeSincePreviousAttemptMs: number;
}

export interface PuzzleRecord {
  puzzleId: number;
  solved: boolean;
  solvedFirstTry: boolean;
  attempts: ChessAttempt[];
  startedAt: string;
  completedAt: string | null;
  timeSpentMs: number;
}

export interface ChessProgress {
  /** Ключ — id задачи. */
  puzzles: Record<number, PuzzleRecord>;
  /** Текущая серия задач, решённых с первой попытки. */
  streak: number;
  bestStreak: number;
}

/** Сводка для экрана прогресса и родительской аналитики. */
export interface ChessStats {
  solved: number;
  attempted: number;
  solvedFirstTry: number;
  firstTryAccuracy: number;
  averageAttempts: number;
  averageTimeMs: number;
  medianTimeMs: number;
  fastestMs: number | null;
  slowestMs: number | null;
  illegalMoves: number;
  legalNonMateMoves: number;
  checkmates: number;
  bestStreak: number;
}
