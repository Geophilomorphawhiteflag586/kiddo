import { Suspense } from 'react';
import PeopleSession from '@/modules/people/components/PeopleSession';

// useSearchParams требует границы Suspense при пререндере страницы.
export default function PeoplePlayPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-slate-400">Загружаем…</div>}>
      <PeopleSession />
    </Suspense>
  );
}
