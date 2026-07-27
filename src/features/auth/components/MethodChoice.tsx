import { useTranslation } from 'react-i18next';
import { QrCode, Smartphone } from 'lucide-react';
import type { AuthMethod } from '@/shared/auth/useAuth';

/**
 * 로그인 수단(문자/QR) 고르기 화면.
 *
 * **첫 화면(자격증명) 다음, 연결 전**이다. 전에는 전화번호로 먼저 들어간 뒤 화면 안에서 QR 로
 * 바꾸는 버튼을 뒀는데, 그 전환이 연결을 통째로 다시 맺느라 "접속 중" 이 또 떴다. 고르는 일을
 * 연결 앞으로 빼면 그 재접속이 사라진다 — 한 번 고르면 그 수단으로 곧장 이어진다.
 *
 * 타일 모양은 자격증명 화면(`CredentialsForm`)의 선택 타일과 맞춘다 — 같은 고르기니 같게 보인다.
 */
export function MethodChoice({ onChoose }: { onChoose: (method: AuthMethod) => void }) {
  const { t } = useTranslation();

  const options = [
    { value: 'phone', title: 'auth.method.phone', hint: 'auth.method.phoneHint', icon: Smartphone },
    { value: 'qr', title: 'auth.method.qr', hint: 'auth.method.qrHint', icon: QrCode },
  ] as const;

  return (
    <div className="space-y-4 edge-card bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{t('auth.method.title')}</h2>

      <div className="grid gap-2 mobile:grid-cols-2">
        {options.map(({ value, title, hint, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChoose(value)}
            className="flex flex-col rounded-xl border border-slate-200 p-3 text-start transition-colors hover:border-primary hover:bg-primary-50"
          >
            <span className="flex items-center gap-2">
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-semibold text-slate-900">{t(title)}</span>
            </span>
            <span className="mt-1 text-xs leading-relaxed text-slate-500">{t(hint)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
