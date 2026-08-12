import { Suspense } from 'react';
import ChineseSession from '@/modules/chinese/components/ChineseSession';

export default function ChinesePlayPage() {
  return (
    <Suspense
      fallback={<div className="grid min-h-dvh place-items-center text-slate-500">加载中…</div>}
    >
      <ChineseSession />
    </Suspense>
  );
}
