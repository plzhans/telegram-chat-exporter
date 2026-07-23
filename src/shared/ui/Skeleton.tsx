import { cn } from '@/shared/lib/utils';

/**
 * 자리를 잡아 두는 회색 덩어리.
 *
 * 스피너 대신 쓰는 이유는 **자리가 안 흔들리게** 하기 위해서다. 스피너는 크기가 내용과
 * 무관해서, 내용이 도착하는 순간 화면이 위아래로 튄다. 스켈레톤은 들어올 것과 같은 모양을
 * 미리 차지하고 있으므로 바뀌는 것이 색뿐이다.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />;
}

/**
 * 대화방 목록 한 줄. 아바타 동그라미와 두 줄짜리 글자.
 *
 * **로딩 단계마다 같은 것을 보여줘야 한다.** 새로고침 한 번에 코드 묶음 받기 → 세션 복원 →
 * 목록 조회가 잇따라 일어나는데, 단계마다 다른 것을 그리면 사용자 눈에는 화면이 서너 번
 * 갈아치워지는 것으로 보인다. 같은 스켈레톤을 계속 두면 한 번의 기다림으로 읽힌다.
 */
export function DialogListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* 제목 줄 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      {/* 검색창 */}
      <Skeleton className="h-11 w-full rounded-xl" />

      <ul className="edge-card divide-y divide-slate-100 overflow-hidden bg-white">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              {/*
                줄 길이를 조금씩 다르게 준다. 전부 같은 길이면 표처럼 보여서 "글이 들어올
                자리"로 읽히지 않는다.
              */}
              <Skeleton className={cn('h-3.5', i % 3 === 0 ? 'w-32' : i % 3 === 1 ? 'w-24' : 'w-40')} />
              <Skeleton className={cn('h-3', i % 2 === 0 ? 'w-48' : 'w-56')} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 대화 화면. 주고받은 말풍선이 번갈아 선다. */
export function MessageListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>

      <div className="edge-card min-h-0 flex-1 space-y-3 bg-white p-1.5 sm:p-3">
        {Array.from({ length: rows }, (_, i) => {
          const mine = i % 3 === 2;
          return (
            <div key={i} className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
              {!mine && <Skeleton className="h-7 w-7 shrink-0 rounded-full" />}
              <Skeleton
                className={cn(
                  'h-10 rounded-2xl',
                  i % 4 === 0 ? 'w-40' : i % 4 === 1 ? 'w-56' : i % 4 === 2 ? 'w-32' : 'w-48',
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 어느 화면이 올지 모를 때. 상자 몇 개로 자리만 잡는다. */
export function PageSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <div className="edge-card space-y-2 bg-white p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="edge-card space-y-2 bg-white p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
