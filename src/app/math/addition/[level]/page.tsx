import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import MathSession from '@/modules/mathematics/components/MathSession';
import { LEVELS, LEVEL_BY_SLUG, LEVEL_META } from '@/modules/mathematics/config';

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level: LEVEL_META[level].slug }));
}

export default async function MathLevelPage({
  params,
}: {
  params: Promise<{ level: string }>;
}) {
  const { level } = await params;
  if (!LEVEL_BY_SLUG.has(level)) notFound();

  return (
    <Suspense
      fallback={<div className="grid min-h-dvh place-items-center text-slate-400">Загрузка…</div>}
    >
      <MathSession slug={level} />
    </Suspense>
  );
}
