import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/**
 * 눌러서 펴는 구역.
 *
 * `<details>` 를 쓴다. 직접 상태를 들고 여닫아도 되지만, 브라우저가 이미 하는 일이다 —
 * 키보드로 열고 닫히고, 화면 읽기 프로그램이 접힌 상태를 읽어 주고, **브라우저의 페이지
 * 내 찾기가 접힌 안쪽까지 뒤져서 펴 준다.** 직접 만들면 마지막 것을 잃는다.
 *
 * 접어 두는 기준은 "읽지 않아도 쓸 수 있는가"다. 신뢰를 확인하려는 사람에게는 꼭 필요한
 * 글이지만 모두가 매번 읽어야 하는 건 아니고, 그 글이 길어서 **정작 쓸 것이 화면 아래로
 * 밀려나면** 도구로서 불편해진다. 감추는 게 아니라 순서를 정하는 것이다.
 */
export function Disclosure({
  title,
  summary,
  children,
  defaultOpen = false,
  bare = false,
  className,
}: {
  title: string;
  /** 접힌 상태에서 제목 아래 한 줄. 펴 볼지 말지를 여기서 판단하게 한다. */
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /**
   * 자기 테두리를 두르지 않는다.
   *
   * 여러 개를 붙여 놓을 때 쓴다. 각자 상자를 두르면 카드 세 개가 되어 자리를 그만큼 더
   * 먹고, 서로 다른 이야기처럼 보인다. 하나로 묶고 가운데만 선으로 나누는 편이 낫다.
   */
  bare?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn('group', !bare && 'edge-card bg-white', className)}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-start gap-2 px-4 py-3',
          !bare && 'rounded-2xl',
          // 사파리는 기본 삼각형을 이 가상 요소로 그린다. 없애야 우리 아이콘만 남는다.
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-slate-900">{title}</span>
          {/* 펴면 본문이 같은 말을 더 자세히 하므로, 접혔을 때만 보여준다. */}
          {summary && (
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 group-open:hidden">
              {summary}
            </span>
          )}
        </span>
      </summary>
      <div className="px-4 pb-3">{children}</div>
    </details>
  );
}
