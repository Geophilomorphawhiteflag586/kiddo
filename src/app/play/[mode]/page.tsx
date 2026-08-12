import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import PlaySession from '@/components/PlaySession';
import { MODES, MODE_BY_SLUG } from '@/lib/modes';

export function generateStaticParams() {
  return MODES.map((mode) => ({ mode: mode.slug }));
}

export default async function PlayPage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!MODE_BY_SLUG.has(mode)) notFound();

  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center text-slate-400">Загружаем миссию…</div>
      }
    >
      <PlaySession slug={mode} />
    </Suspense>
  );
}
