import { z } from 'zod';

export interface ApiCredentials {
  apiId: number;
  apiHash: string;
}

/**
 * 빌드 시점에 박히는 공용 api_id.
 *
 * **두 가지 방식을 다 지원한다.**
 * - 공용 키가 있으면: 사용자는 전화번호만 넣으면 된다. UX 가 제일 좋다.
 * - 공용 키가 없거나(미설정) 죽었으면: 사용자가 my.telegram.org 에서 발급한 키를 넣는다.
 *
 * 공용 키를 단독으로 쓰지 않는 이유는 **단일 장애점**이기 때문이다. 공개된 api_id 는 스팸에
 * 재사용되기 쉽고, 텔레그램이 그런 키를 폐기(API_ID_PUBLISHED_FLOOD)하면 전 사용자가 동시에
 * 막힌다. 그때 사용자가 직접 키를 넣어 계속 쓸 수 있는 탈출구를 항상 열어 둔다.
 */
const shared: ApiCredentials | null = (() => {
  const id = import.meta.env.VITE_TELEGRAM_API_ID;
  const hash = import.meta.env.VITE_TELEGRAM_API_HASH;
  if (!id || !hash) return null;
  const apiId = Number(id);
  return Number.isInteger(apiId) && apiId > 0 ? { apiId, apiHash: hash } : null;
})();

export const SHARED_CREDENTIALS = shared;
export const hasSharedCredentials = shared !== null;

export const credentialsSchema = z.object({
  apiId: z
    .string()
    .trim()
    .min(1, 'required')
    .refine((v) => /^\d+$/.test(v), 'apiIdFormat'),
  // my.telegram.org 가 주는 api_hash 는 32자리 소문자 16진수다.
  apiHash: z
    .string()
    .trim()
    .min(1, 'required')
    .refine((v) => /^[0-9a-f]{32}$/i.test(v), 'apiHashFormat'),
});

export type CredentialsForm = z.infer<typeof credentialsSchema>;

const STORAGE_KEY = 'telegram-chat-exporter:api-credentials';

/**
 * 사용자가 직접 넣은 api_id 는 localStorage 에 남긴다.
 *
 * **이건 계정 접근 권한이 아니다.** api_id/api_hash 는 "어떤 앱이 붙었는가"를 가리키는 앱
 * 식별자일 뿐이고, 이것만으로는 누구의 대화도 읽을 수 없다. 로그인 세션(계정 접근 권한)과는
 * 성격이 다르므로 편의를 위해 저장한다. 로그인 세션은 반대로 절대 저장하지 않는다 —
 * shared/telegram/client.ts 의 `createClient` 주석 참고.
 */
export function loadStoredCredentials(): CredentialsForm | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = credentialsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function storeCredentials(value: CredentialsForm): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 사생활 보호 모드 등에서 localStorage 가 막혀 있을 수 있다. 저장 실패는 치명적이지 않다.
  }
}

export function clearStoredCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 위와 같다. */
  }
}

export function toApiCredentials(form: CredentialsForm): ApiCredentials {
  return { apiId: Number(form.apiId), apiHash: form.apiHash.trim() };
}
