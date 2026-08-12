import { Suspense } from 'react';
import AnatomySession from '@/modules/anatomy/components/AnatomySession';

export default function AnatomyPlayPage() {
  return (
    <Suspense
      fallback={<div className="grid min-h-dvh place-items-center text-slate-400">Загружаем…</div>}
    >
      <AnatomySession />
    </Suspense>
  );
}
