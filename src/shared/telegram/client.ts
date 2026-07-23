import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Logger } from 'telegram/extensions/Logger';
import { LogLevel } from 'telegram/extensions/Logger';
import type { ApiCredentials } from './credentials';
import { formatPersonName } from '@/shared/lib/name';

/**
 * 텔레그램 "활성 세션" 목록에 이 이름으로 뜬다.
 *
 * 사용자가 백업을 끝낸 뒤 **어느 세션을 종료해야 하는지 한눈에 알아보게** 하는 게 목적이다.
 * 이름이 모호하면(예: 그냥 "Chrome") 사용자는 자기 진짜 웹 세션과 구분하지 못한다.
 */
const DEVICE_MODEL = 'Telegram Exporter (browser)';
const APP_VERSION = '0.1.0';

let client: TelegramClient | null = null;
/**
 * `client.session` 은 추상 `Session` 타입이라 `save()` 가 `void` 로 잡힌다. 문자열을 얻으려면
 * StringSession 인스턴스를 직접 들고 있어야 한다.
 */
let session: StringSession | null = null;

export function getClient(): TelegramClient {
  if (!client) throw new Error('클라이언트가 아직 만들어지지 않았습니다.');
  return client;
}

export function hasClient(): boolean {
  return client !== null;
}

/** 현재 세션을 문자열로 뽑는다. 이 값 자체가 계정 접근 권한이다. */
export function exportSession(): string | null {
  return session ? session.save() : null;
}

/**
 * @param saved 이전 세션 문자열. 주면 로그인 상태를 그대로 복원하고, 없으면 새로 인증한다.
 */
export async function createClient(
  { apiId, apiHash }: ApiCredentials,
  saved?: string,
): Promise<TelegramClient> {
  await destroyClient();

  /**
   * 세션 문자열은 인증키 그 자체다. 그래서 **localStorage 에는 절대 두지 않고**
   * sessionStorage 에만 둔다(shared/telegram/session.ts 참고). 저장할지 말지는 사용자가
   * 로그인 화면에서 고르고, 여기서는 받은 값을 그대로 복원할 뿐이다.
   */
  session = new StringSession(saved ?? '');

  client = new TelegramClient(session, apiId, apiHash, {
    /**
     * **브라우저에서는 반드시 WSS 다.**
     *
     * GramJS 기본값은 `isBrowser ? location.protocol === 'https:' : false` 라서, 개발 중
     * `http://localhost` 로 열면 false 가 되어 raw TCP(PromisedNetSockets → node `net`)를
     * 시도하다 죽는다. 우리는 브라우저 전용이므로 무조건 켠다.
     */
    useWSS: true,
    connectionRetries: 5,
    autoReconnect: true,
    /**
     * 이보다 짧은 FLOOD_WAIT 은 GramJS 가 알아서 자고 재시도한다. 60초로 두면 짧은 제한은
     * 사용자가 눈치채지 못한 채 지나가고, 그보다 긴 것만 화면에 남은 시간으로 뜬다.
     */
    floodSleepThreshold: 60,
    deviceModel: DEVICE_MODEL,
    systemVersion: navigator.userAgent.slice(0, 64),
    appVersion: APP_VERSION,
    langCode: 'ko',
    systemLangCode: 'ko',
    // GramJS 는 기본적으로 콘솔에 꽤 많이 찍는다. 인증 관련 값이 섞여 나갈 이유가 없다.
    baseLogger: new Logger(LogLevel.ERROR),
  });

  await client.connect();
  return client;
}

/** 현재 로그인한 사용자. 로그인 직후 화면 상단에 누구로 붙었는지 보여주는 용도. */
export interface MeInfo {
  id: string;
  name: string;
  username?: string;
  /**
   * 국제 형식 전화번호.
   *
   * 텔레그램은 **자기 계정에 한해** 이 값을 내려준다(남의 계정은 설정에 따라 가려진다).
   * `+` 없이 오므로 붙여서 돌려준다.
   */
  phone?: string;
}

export async function fetchMe(): Promise<MeInfo> {
  const me = await getClient().getMe();
  if (!(me instanceof Api.User)) {
    throw new Error('사용자 계정으로 로그인한 상태가 아닙니다.');
  }
  const name = formatPersonName(me.firstName, me.lastName);
  return {
    id: me.id.toString(),
    name: name || me.username || me.id.toString(),
    username: me.username,
    phone: me.phone ? `+${me.phone}` : undefined,
  };
}

/** 연결만 끊는다. 텔레그램 쪽 활성 세션은 그대로 남는다. */
export async function destroyClient(): Promise<void> {
  session = null;
  if (!client) return;
  const current = client;
  client = null;
  try {
    await current.destroy();
  } catch {
    // 이미 끊긴 소켓을 닫는 중 나는 에러는 무시한다. 어차피 참조를 버렸다.
  }
}

/**
 * 텔레그램 계정에서 이 세션을 완전히 지운다.
 *
 * 단순 연결 해제(destroy)와 다르다. 이걸 불러야 사용자의 "활성 세션" 목록에서 사라진다.
 * 백업을 마친 사용자가 이 사이트에 남긴 흔적을 스스로 지울 수 있게 하는 게 핵심이다.
 */
export async function logOut(): Promise<void> {
  if (!client) return;
  try {
    await client.invoke(new Api.auth.LogOut());
  } finally {
    await destroyClient();
  }
}
