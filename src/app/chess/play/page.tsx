import { Suspense } from 'react';
import ChessSession from '@/modules/chess/components/ChessSession';

export default function ChessPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center text-slate-500">
          Расставляем фигуры…
        </div>
      }
    >
      <ChessSession />
    </Suspense>
  );
}
