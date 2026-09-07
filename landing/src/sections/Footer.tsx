import { useLanding } from '../context';
import { ownerOf } from '../config/release';

/**
 * 만든 사람을 밝히는 자리.
 *
 * **이름에 링크를 건다.** 전에는 `© 2026 plzhans` 라는 글자뿐이라, 전화번호와 인증코드를
 * 넣으라고 하는 페이지치고 "이걸 누가 만들었는가" 를 확인할 길이 없었다. 소스 코드 링크는
 * 저장소를 가리키지 저장소 주인을 가리키지 않는다 - 물어보는 것이 다르다.
 *
 * 이름은 저장소 주소에서 뽑으므로(`ownerOf`) 구조화 데이터의 `author`·`publisher` 와 늘
 * 같은 사람이다. 주소 모양이 짐작과 달라 못 뽑으면 링크 없이 연도만 둔다.
 */
export function Footer() {
  const { env } = useLanding();
  const owner = ownerOf(env.sourceUrl);

  return (
    <footer className="mx-auto max-w-5xl px-4 pb-6">
      <div className="border-t border-slate-200 pt-2">
        <p className="truncate text-[0.65rem] text-slate-400">
          © {env.copyrightYear}
          {owner ? (
            <>
              {' '}
              <a
                href={owner.url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
              >
                {owner.name}
              </a>
            </>
          ) : null}
        </p>
      </div>
    </footer>
  );
}
