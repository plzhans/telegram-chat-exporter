import { QRCodeSVG } from 'qrcode.react';
import { Spinner } from '@/shared/ui/Spinner';

/**
 * QR 로그인 화면. `useAuth` 가 만든 `tg://login?token=...` 딥링크를 QR 로 그린다.
 *
 * **문구를 영어로 박아 둔다(i18n 키를 안 만든다).** QR 로그인은 텔레그램의 "기기 연결" 흐름을
 * 이미 아는 사람이 쓰는 곁가지 기능이라 13개 언어 문자열을 늘릴 만큼의 값이 없다. 대신 글을
 * 최소한으로 줄여, 번역이 없어도 화면이 막히지 않게 한다.
 *
 * 토큰은 ~30초마다 갱신되어 `url` 이 바뀌지만, 같은 로그인 세션이라 QR 만 조용히 다시 그려진다.
 * 아직 첫 토큰이 안 온 찰나에는 자리를 지키려고 스피너를 둔다.
 */
export function QrPanel({ url }: { url?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-lg font-bold text-slate-900">Log in by QR code</h2>

      {/* QR 은 검정/흰색이라 카드가 흰 바탕이어도 여백(quiet zone)을 위해 흰 칸을 따로 둔다. */}
      <div className="flex h-[232px] w-[232px] items-center justify-center rounded-xl border border-slate-200 bg-white">
        {url ? <QRCodeSVG value={url} size={200} marginSize={2} /> : <Spinner />}
      </div>

      <ol className="w-full list-decimal space-y-1 ps-5 text-sm leading-relaxed text-slate-600">
        <li>Open Telegram on your phone</li>
        <li>
          Go to <span className="font-medium text-slate-900">Settings → Devices → Link Desktop Device</span>
        </li>
        <li>Scan this code</li>
      </ol>
    </div>
  );
}
