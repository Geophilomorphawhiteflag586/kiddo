import { Suspense } from 'react';
import EnglishSession from '@/modules/english/components/EnglishSession';

export default function EnglishPlayPage() {
  return (
    <Suspense
      fallback={<div className="grid min-h-dvh place-items-center text-slate-400">Loading…</div>}
    >
      <EnglishSession />
    </Suspense>
  );
}
