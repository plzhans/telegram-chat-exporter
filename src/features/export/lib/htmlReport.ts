import { SITE_URL, SOURCE_URL, VERSION_LABEL } from '@/shared/config/app';
import { dateKeyOf, formatDisplayDate, formatExportTimestamp } from '@/shared/lib/date';
import type { MessageSummary } from '@/features/dialogs/api';

/**
 * 백업 안에 들어가는 `index.html` 을 만든다.
 *
 * ## 왜 필요한가
 *
 * `messages.jsonl` 은 기계가 읽는 것이고 `messages.txt` 는 한 줄씩 늘어놓은 것이다. 둘 다
 * **대화로는 안 읽힌다.** 누가 무엇에 답했는지, 사진이 어느 말 뒤에 붙었는지가 눈에 안 들어온다.
 * 근거로 내밀 자료라면 읽는 사람이 화면에서 보던 것과 같은 모양이어야 한다.
 *
 * ## 세 가지 원칙
 *
 * 1. **파일 하나로 완결된다.** 모든 스타일이 안에 박혀 있어서 인터넷 없이, 이 도구 없이,
 *    십 년 뒤에도 브라우저로 열면 그대로 보인다. 바깥에서 받아 오는 것이 하나라도 있으면
 *    그것이 사라진 날 이 문서도 무너진다.
 *
 * 2. **스크립트가 없다.** 검색 상자 같은 걸 붙이면 편하겠지만, 근거로 제출하는 문서는
 *    **열 때마다 같은 것을 보여줘야** 한다. 코드가 들어 있는 문서는 "열어 보니 그때는
 *    이렇게 나왔다"는 반박의 여지를 만든다. 이 파일은 열면 그냥 글과 그림이다.
 *
 * 3. **원문을 고치지 않는다.** 링크로 바꾸거나 이모지를 그림으로 바꾸는 따위를 하지 않는다.
 *    보이는 글자가 곧 저장된 글자다.
 *
 * ## 스트리밍
 *
 * 메시지를 훑는 도중에 한 조각씩 뱉는다. 다 모아서 만들면 24만 건짜리 대화방에서 메모리가
 * 터진다. 그래서 상태(마지막 날짜, 직전 발신자, 진행 중인 앨범)를 이 객체가 들고 있다.
 */

/**
 * HTML 에서 뜻을 갖는 글자를 무해하게 바꾼다.
 *
 * **대화 내용은 남이 쓴 글이다.** `<script>` 를 보낸 사람이 있으면 그대로 실행된다. 근거로
 * 쓸 문서가 열 때마다 다르게 동작하면 문서로서 가치가 없어진다.
 *
 * 작은따옴표까지 바꾸는 이유는 속성값에도 같은 함수를 쓰기 때문이다. 쓰는 자리마다 다른
 * 함수를 고르게 하면 언젠가 하나를 틀린다.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 발신자마다 고정된 색.
 *
 * 이름이 같으면 언제 열어도 같은 색이 나와야 한다. **id 로 정한다** — 이름은 바뀌지만 id 는
 * 안 바뀌고, 이름이 같은 두 사람도 색으로 갈린다.
 */
const AVATAR_COLORS = [
  '#DC2626',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#0891B2',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
];

function colorOf(id: string | undefined): string {
  if (!id) return '#64748B';
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** 아바타에 넣을 글자. 사진은 담지 않으므로(대화 내용이다) 이름 첫 글자로 대신한다. */
function initialOf(name: string | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? [...trimmed][0].toUpperCase() : '?';
}

/**
 * 문서 하단의 출처 줄.
 *
 * 파일만 건네받은 사람이 "이게 어디서 나온 것인가"를 따라갈 수 있어야 한다. 그래서
 * **코드가 있는 곳(GitHub)과 도구가 돌아가는 곳(사이트)을 둘 다** 적는다. 사이트 주소는
 * `VITE_SITE_URL` 이 있을 때만 나온다 - 직접 빌드해 쓰는 경우에는 가리킬 사이트가 없다.
 *
 * 아이콘은 인라인 SVG 다. 이 문서는 인터넷 없이 열려야 하므로 밖에서 그림을 받아올 수 없다.
 */
const GITHUB_MARK =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';

function footLinks(): string {
  const source = escapeHtml(SOURCE_URL);
  const parts = [
    `<a class="ico" href="${source}" target="_blank" rel="noreferrer noopener" aria-label="Source code">${GITHUB_MARK}</a>` +
      `<a href="${source}" target="_blank" rel="noreferrer noopener">telegram-chat-exporter</a>`,
  ];

  if (SITE_URL) {
    // 보이는 글자에서는 스킴을 뗀다. 읽을 사람에게 `https://` 는 잡음이다.
    const shown = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    parts.push(
      `<a href="${escapeHtml(SITE_URL)}" target="_blank" rel="noreferrer noopener">${escapeHtml(shown)}</a>`,
    );
  }

  return parts.join(' &middot; ');
}

/** 24시간제 `HH:mm`. 화면과 같은 표기다. */
function timeOf(unix: number): string {
  const date = new Date(unix * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface HtmlReportMeta {
  dialogTitle: string;
  dialogId: string;
  rangeLabel: string;
  timezone: string;
  exportedAt: string;
  /**
   * 대화방 아이콘(data URL).
   *
   * 메시지에 딸려 온 초저해상도 미리보기라 **따로 받아 오는 요청이 없다.** 뿌옇지만 누구와
   * 나눈 대화인지 한눈에 알아보게 하는 데는 충분하다.
   */
  dialogPhoto?: string;
  /**
   * 내 메시지를 오른쪽에 둘지.
   *
   * 메신저 화면은 내 말을 오른쪽에 놓아 읽기 쉽게 만든다. 다만 그 배치 자체가 **"이쪽이
   * 나다"라는 주장**이라, 제3자에게 내미는 자료에서는 한쪽 편에 서서 편집한 것처럼 보일 수
   * 있다. 끄면 모두가 같은 줄에 서고, 누가 말했는지는 이름만이 말한다.
   */
  alignOwnRight: boolean;
  /**
   * 첨부 파일을 함께 담았는가.
   *
   * 담긴 것이 하나도 없으면 경로를 물어볼 필요조차 없다. 담았더라도 종류마다 다르므로,
   * 실제로 그릴지는 그 메시지의 경로가 등록됐는지로 판단한다(`paths`).
   */
  photosIncluded: boolean;
}

/**
 * 스타일.
 *
 * 앱 화면의 규칙을 그대로 옮겼다 — 내가 보낸 말은 오른쪽 파란 말풍선, 받은 말은 왼쪽 흰
 * 말풍선, 날짜가 바뀌면 가운데 알약, 시각은 말풍선 안 오른쪽 아래.
 *
 * **미디어는 말풍선 밖에 둔다.** 앱에서 정한 규칙이고 이유도 같다 — 사진에 말풍선 배경이
 * 깔리면 사진 자체의 경계가 어디까지인지 흐려진다.
 *
 * 웹폰트를 쓰지 않는다. 앱과 같은 이유이자, 이 파일이 인터넷 없이 열려야 하기 때문이다.
 */
/**
 * 내보낸 문서에 박히는 스타일.
 *
 * ## 여기 한글을 쓰지 않는다
 *
 * 이 문자열은 그대로 `index.html` 안으로 들어간다. **파일에 실려 나가는 코드는 영어만
 * 쓴다** - 이 문서는 어느 나라의 어떤 프로그램이 열지 알 수 없고, 글자 인코딩을 잘못
 * 잡는 뷰어나 검사 도구를 만나면 주석 한 줄 때문에 파일 전체가 깨져 보일 수 있다.
 * 대화 내용은 원문이어야 하니 어쩔 수 없지만, **코드는 우리가 고를 수 있다.**
 *
 * 그래서 "왜 이렇게 했는가"는 전부 이 주석에 남기고, 나가는 CSS 에는 짧은 영어 표시만 둔다.
 *
 * ## 왜 이런 규칙인가
 *
 * - **대화 자리에 테두리(.chat)** - 바탕을 희게 바꾸고 나니 대화가 어디서 시작해 어디서
 *   끝나는지가 사라졌다. 선 한 줄이면 "여기부터 저기까지가 그 대화"라고 말해 준다.
 *   위아래 안쪽 여백이 다른 이유는 메시지마다 위쪽에만 간격이 붙어 있어서다(.row).
 *
 * - **머리말 접기(details)** - 브라우저가 원래 하는 일이라 코드가 필요 없고, 페이지 내
 *   찾기(Ctrl+F)가 접힌 안쪽까지 뒤져서 펴 준다. 인쇄할 때는 접혀 있어도 펼쳐 찍는다 -
 *   종이에 남는 문서에서 출처가 빠지면 안 된다.
 *
 * - **아바타는 contain** - 메시지에 딸려 온 미리보기는 몇십 px 이라, cover 로 잘리면 남는
 *   게 없다. 네모난 그림에는 둘이 같으므로 손해 보는 경우가 없다.
 *
 * - **말풍선이 스스로 색을 갖는다** - 바탕이 흰색이라 흰 말풍선은 묻혀 사라진다. 받은 말은
 *   연한 파랑, 보낸 말은 진한 파랑. 같은 계열의 밝기 차이로 나누면 조용하면서 구별은
 *   확실하고, 평평하게 놓은 문서에서는 모두 연한 파랑으로 통일되어 어느 쪽도 안 도드라진다.
 *
 * - **미디어는 말풍선 밖** - 앱 화면과 같은 규칙이다. 사진에 말풍선 배경이 깔리면 사진
 *   자체의 경계가 흐려진다.
 *
 * - **눌러서 크게 보기(.zoom)** - 스크립트 없이 한다. 주소 끝의 #이름이 가리키는 요소에
 *   :target 이 걸리는 것을 쓴다. 그림을 누르면 자기를 가리키게 해 가운데로 띄우고, 바로
 *   뒤에 둔 어두운 판(.cl)이 그때 함께 나타난다. 그 판을 누르면 #_ 로 옮겨 가 닫힌다.
 *   뒤로 가기로도 닫힌다 - 주소만 바뀌었을 뿐이라 방문 기록에 그대로 남는다.
 *   스티커에는 걸지 않는다. 작게 쓰라고 만든 그림이라 키워 봐야 뭉개진다.
 */
const STYLE = `
*,*::before,*::after{box-sizing:border-box}
/* The column width is shared: the jump button anchors to this column, not the window. */
:root{--col:48rem}
body{margin:0;background:#fff;color:#0F172A;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  font-size:16px;line-height:1.6;-webkit-text-size-adjust:100%}
.wrap{max-width:var(--col);margin:0 auto;padding:16px}
/* provenance line, always visible but never loud */
.brand{margin:0 0 8px;font-size:11px;color:#94A3B8;text-align:right}
.brand a{color:#64748B;text-decoration:none}
.brand a:not(.ico){border-bottom:1px solid #CBD5E1}
/* header */
.head{display:flex;gap:12px;align-items:flex-start;background:#F8FAFC;
  border:1px solid #E2E8F0;border-radius:16px;padding:16px;margin-bottom:16px}
.head h1{margin:0;font-size:20px}
.head .body{min-width:0;flex:1}
.head .icon{width:44px;height:44px;border-radius:999px;flex:0 0 44px;color:#fff;
  font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;
  background-size:contain;background-repeat:no-repeat;background-position:center}
.head summary{cursor:pointer;list-style:none;margin-top:6px;font-size:13px;color:#64748B}
.head summary::-webkit-details-marker{display:none}
.head summary::before{content:"\\25B8\\A0"}
.head details[open] summary::before{content:"\\25BE\\A0"}
.head dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:8px 0 0;font-size:13px}
.head dt{color:#64748B}
.head dd{margin:0;font-weight:600}
.head dd a{color:#2563EB}
/* conversation */
.chat{border:1px solid #E2E8F0;border-radius:16px;padding:4px 12px 12px}
.day{display:flex;justify-content:center;margin:20px 0 12px}
.day span{background:#CBD5E1;color:#1E293B;font-size:13px;font-weight:700;
  padding:3px 12px;border-radius:999px}
.sys{text-align:center;color:#64748B;font-size:13px;margin:8px 0}
.row{display:flex;gap:8px;margin-top:8px;align-items:flex-end}
.row.own{flex-direction:row-reverse}
.row.tight{margin-top:2px}
.col{min-width:0;max-width:calc(100% - 40px);display:flex;flex-direction:column}
.row.own .col{align-items:flex-end}
/* avatar: contain, never crop */
.av{width:28px;height:28px;border-radius:999px;flex:0 0 28px;color:#fff;
  font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;
  background-size:contain;background-repeat:no-repeat;background-position:center;overflow:hidden}
.av.hole{background:none}
.who{font-size:13px;color:#475569;margin-bottom:2px}
/* sender name: first line inside the bubble */
/* max-content keeps a name longer than the message from wrapping inside a narrow bubble. */
.nmline{display:block;width:max-content;max-width:100%;font-size:13px;margin-bottom:1px}
.nm{font-weight:700}
.bot{background:#E2E8F0;color:#475569;border-radius:4px;padding:0 4px;
  font-size:11px;font-weight:700;margin-left:4px;vertical-align:1px}
/* bubbles */
.bub{background:#EFF6FF;border:1px solid #DBEAFE;border-radius:16px;padding:6px 10px;
  max-width:100%;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.row.own .bub{background:#2563EB;border-color:#2563EB;color:#fff}
.at{font-size:12px;color:#64748B;margin-left:8px;float:right;position:relative;top:6px}
.row.own .at{color:#BFDBFE}
.edit{font-style:normal;font-size:12px;color:#B45309;margin-right:4px}
.row.own .edit{color:#FDE68A}
/* media sits outside the bubble */
.med{margin-top:4px;max-width:min(320px,100%)}
.med img{display:block;width:100%;height:auto;border-radius:12px;background:#E2E8F0}
.med.stick img{border-radius:0;background:none;max-width:180px}
.alb{display:grid;grid-template-columns:1fr 1fr;gap:2px;border-radius:12px;overflow:hidden}
.alb img{border-radius:0}
/* click to enlarge, CSS only (:target) */
.face{display:block;cursor:default;text-decoration:none}
.head .face{flex:0 0 44px}
.zoom{display:block;cursor:zoom-in}
/* the enlarged portraits stay hidden until their anchor is targeted */
.zoom.face-view{display:none}
.zoom.face-view:target{display:block}
.face-view img{max-width:min(320px,90vw);max-height:90vh;border-radius:16px;display:block}
.cl{display:none}
.zoom:target{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
  z-index:99;max-width:96vw;max-height:96vh;cursor:default}
.zoom:target img{max-width:96vw;max-height:96vh;width:auto;height:auto;
  border-radius:0;background:none}
.zoom:target ~ .cl{display:flex;position:fixed;inset:0;z-index:98;
  background:rgba(15,23,42,.92);align-items:flex-start;justify-content:flex-end;
  padding:12px 16px;color:#fff;font-size:28px;line-height:1;text-decoration:none;cursor:zoom-out}
/* attachment kept out of this backup */
.miss{border:1px dashed #CBD5E1;border-radius:12px;padding:8px 10px;background:#F8FAFC;
  color:#475569;font-size:13px}
.fid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#64748B;
  word-break:break-all}
.foot{margin:24px 0 8px;text-align:center;color:#94A3B8;font-size:12px;line-height:1.8}
.foot a{color:#2563EB}
.ver{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#CBD5E1}
/* The mark is drawn inline - this file must open with no network. */
.ico{display:inline-flex;vertical-align:-3px;margin-right:2px}
.ico svg{width:14px;height:14px;fill:currentColor}
/* Jump to the newest message. A plain anchor link - this document stays script-free. */
.jump{position:fixed;bottom:16px;z-index:50;width:40px;height:40px;
  /*
    Anchor to the text column, not the window. On a wide screen a button pinned to the
    window corner sits far from the conversation and reads as part of the browser, not
    the document. max() keeps it on screen when the window is narrower than the column.
  */
  right:max(16px, calc(50% - var(--col) / 2 + 16px));
  border-radius:999px;background:#fff;border:1px solid #CBD5E1;
  box-shadow:0 2px 8px rgba(15,23,42,.18);display:flex;align-items:center;
  justify-content:center;color:#334155;text-decoration:none;font-size:18px;line-height:1}
.jump:hover{background:#F1F5F9;color:#0F172A;border-color:#94A3B8}
/*
  Narrow screens: let the conversation reach the edges. Side padding and a rounded frame
  cost width that the messages need, and a border drawn at the very edge of the screen
  reads as a cut-off, not as a frame.
*/
@media (max-width:640px){
  .wrap{padding:8px 0}
  .brand{padding:0 8px}
  .head{border-radius:0;border-inline:0;padding:12px 10px}
  .chat{border-radius:0;border-inline:0;padding:2px 6px 8px}
  .col{max-width:calc(100% - 34px)}
  .foot{padding:0 8px}
}
@media print{.wrap{max-width:none}.row{break-inside:avoid}.jump{display:none}
  .zoom:target{position:static;transform:none}.zoom:target ~ .cl{display:none}
  .head details{display:block}.head dl{display:grid}.head summary{display:none}}
`;

/**
 * 시스템 메시지를 사람이 읽는 문장으로.
 *
 * 이 문서의 글자는 영어로 고정한다(head 참고). 이름 뒤에 그대로 이어 붙일 수 있도록
 * 앞에 공백을 둔 조각으로 적어 둔다.
 */
const ACTION_PHRASES: Record<string, string> = {
  chatadduser: ' joined the chat',
  chatdeleteuser: ' left the chat',
  chatjoinedbylink: ' joined via invite link',
  chatjoinedbyrequest: ' was approved to join',
  chatcreate: ' created the chat',
  channelcreate: ' created the channel',
  chatedittitle: ' changed the chat name',
  chateditphoto: ' changed the chat photo',
  chatdeletephoto: ' removed the chat photo',
  pinmessage: ' pinned a message',
  chatmigrateto: 'The chat became a supergroup',
  channelmigratefrom: 'The chat became a supergroup',
  historyclear: 'The history was cleared',
  phonecall: ' made a call',
  groupcall: 'There was a voice chat',
  invitetogroupcall: ' invited someone to a voice chat',
  screenshottaken: ' took a screenshot',
  contactsignup: ' joined Telegram',
  setmessagesttl: 'The auto-delete timer changed',
  setchattheme: ' changed the chat theme',
  giftpremium: ' gifted Premium',
  topiccreate: ' created a topic',
  topicedit: ' edited a topic',
  suggestprofilephoto: ' suggested a profile photo',
  webviewdatasent: ' sent a form',
  paymentsent: 'Payment completed',
};

/** 한 앨범 안에 모인 사진들. 같은 `groupedId` 를 가진 메시지가 여기 쌓인다. */
interface Album {
  groupedId: string;
  messages: MessageSummary[];
}

/**
 * CSS 클래스 이름으로 쓸 수 있게 다듬는다.
 *
 * 발신자 id 는 숫자이거나 음수(채널)일 수 있다. 클래스 이름은 숫자로 시작할 수 없으므로
 * 앞에 `av-` 를 붙이고, 나머지 글자도 안전한 것만 남긴다.
 */
function avatarClass(id: string): string {
  return `av-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export class HtmlReport {
  private lastDayKey?: string;
  private lastSenderId?: string;
  private album: Album | null = null;
  /**
   * 발신자 id → 프로필 사진(data URL).
   *
   * **같은 그림을 메시지마다 되풀이해 넣으면 안 된다.** 한 장이 1KB 남짓이라도 24만 건이면
   * 문서가 몇백 MB 로 부푼다. 사람마다 한 번씩만 모아 뒀다가, 문서 끝에서 CSS 규칙으로
   * 한 번만 내보낸다 — 그러면 같은 사람의 아바타 백 개가 그림 한 장을 나눠 쓴다.
   */
  private readonly senderPhotos = new Map<string, string>();
  /**
   * 아바타가 필요한 사람들.
   *
   * 메시지에 딸려 온 그림은 **몇십 px 짜리 미리보기**라 아무리 키워도 뿌옇다. 원본을 따로
   * 받아야 선명해지는데, 그건 사람 하나당 요청 하나다. 여기 모아 뒀다가 훑기가 끝난 뒤에
   * 한 번씩만 받는다 — 참여자 수만큼이라 대화가 길어도 요청이 늘지 않는다.
   */
  readonly avatarIds = new Set<string>();

  constructor(private readonly meta: HtmlReportMeta) {}

  /**
   * 선명한 원본으로 갈아 끼운다.
   *
   * 미리보기가 이미 들어가 있어도 덮어쓴다. 같은 사람의 같은 얼굴이고, 이쪽이 훨씬 낫다.
   */
  setAvatar(id: string, dataUrl: string): void {
    this.senderPhotos.set(id, dataUrl);
  }

  /** 문서의 머리. 무엇을 언제 누가 받은 백업인지 먼저 밝힌다. */
  head(): string {
    const m = this.meta;
    this.avatarIds.add(m.dialogId);
    if (m.dialogPhoto) this.senderPhotos.set(m.dialogId, m.dialogPhoto);
    /*
      **화면 글자는 영어만 쓴다.**

      이 문서는 어디로든 건네질 수 있다. 받는 사람의 언어를 알 수 없고, 그렇다고 언어별로
      뽑게 하면 "같은 대화의 백업이 두 벌인데 글자가 다르다"는 상황이 생긴다. 근거로 쓸
      자료에서 그건 설명거리가 하나 느는 일이다.

      영어로 고정하면 문서가 한 가지 모양으로만 존재한다. 대신 **아는 단어만 쓴다** —
      Chat, Period, Exported 수준이면 사전 없이 읽힌다. 나머지 자리는 전부 대화 내용이다.
    */
    /*
      대화방 이름은 **여기 넣지 않는다.** 바로 위 제목이 이미 그 이름이라, 표에 또 적으면
      같은 글자가 두 줄 연달아 나온다.

      남은 것들은 대화를 읽는 데 필요한 값이 아니라 **출처를 따질 때 필요한 값**이다.
      늘 펼쳐 두면 문서를 열자마자 대화가 아니라 표부터 읽게 된다.
    */
    const rows: [string, string][] = [
      ['Chat ID', m.dialogId],
      ['Period', m.rangeLabel],
      ['Time zone', m.timezone],
      ['Exported', m.exportedAt],
    ];
    /*
      **받은 계정은 이 문서에 적지 않는다.**

      index.html 은 남에게 건네지는 얼굴이다. 거기 계정 이름과 id 가 박혀 있으면, 대화를
      평평하게 놓아(layout: flat) 누구 편도 아닌 것처럼 만들어 놔도 머리말 한 줄이 곧바로
      "이 백업을 만든 사람"을 지목한다.

      그렇다고 기록에서 지우지는 않는다. 어느 계정에서 뽑았는지는 자료의 출처라 **`meta.json`
      에는 그대로 남는다.** 보여주는 것과 기록하는 것을 나눈 것이지, 감춘 것이 아니다.
    */

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(m.dialogTitle)}</title>
<style>${STYLE}</style></head><body><div class="wrap">
<!--
  A thin line above the document, not a banner. It states what produced this file and
  where that tool lives - part of the provenance, on the same footing as the timestamp
  below it. Kept small and grey so it never competes with the conversation.
-->
<p class="brand">${footLinks()}</p>
<div class="head"><a class="face" href="#u${escapeHtml(
      m.dialogId,
    )}"><div class="icon ${avatarClass(m.dialogId)}" style="background-color:${colorOf(
      m.dialogId,
    )}">${escapeHtml(initialOf(m.dialogTitle))}</div></a>
<div class="body"><h1>${escapeHtml(m.dialogTitle)}</h1>
<details><summary>Details</summary><dl>${rows
      .map(([k, v]) => {
        const value =
          k === 'Made with'
            ? `<a href="${escapeHtml(
                SOURCE_URL,
              )}" target="_blank" rel="noreferrer noopener">${escapeHtml(v)}</a>`
            : escapeHtml(v);
        return `<dt>${escapeHtml(k)}</dt><dd>${value}</dd>`;
      })
      .join('')}</dl></details></div></div>
<div class="chat">
`;
  }

  /**
   * 메시지 하나를 받아 HTML 조각을 돌려준다.
   *
   * 앨범이 진행 중이면 아직 아무것도 안 나올 수 있다 — 같은 묶음의 사진이 다 모여야 격자로
   * 그릴 수 있기 때문이다. 그래서 반환값이 빈 문자열일 수 있다.
   */
  push(message: MessageSummary): string {
    let out = '';

    /*
      앨범은 사진 여러 장이 각각의 메시지로 온다. 같은 묶음이 이어지는 동안 모아 뒀다가,
      다른 것이 오는 순간 한 덩어리로 그린다. 안 묶으면 사진 한 장짜리 말풍선이 줄줄이 선다.
    */
    if (this.album && message.groupedId !== this.album.groupedId) {
      out += this.flushAlbum();
    }
    if (message.groupedId) {
      if (!this.album) this.album = { groupedId: message.groupedId, messages: [] };
      this.album.messages.push(message);
      return out;
    }

    return out + this.renderOne(message);
  }

  /** 마지막에 남은 앨범을 비우고 문서를 닫는다. */
  foot(): string {
    /*
      아바타 그림은 **문서 끝에서** 한 번만 정의한다.

      머리에 넣을 수가 없다 — 그때는 아직 누가 말할지 모른다. body 안의 <style> 도 문서
      전체에 적용되므로, 앞쪽에 이미 그려 둔 아바타에도 그대로 걸린다.
    */
    /*
      **그림과 글자 감춤을 한 규칙에 묶는다.**

      전에는 `pic` 클래스를 마크업에 붙여 글자를 감췄는데, 그러면 그릴 때 이미 사진이 있어야
      한다. 선명한 원본은 훑기가 다 끝난 뒤에야 오므로 그 시점에는 알 수 없다. 규칙 하나로
      묶어 두면 **사진이 나중에 도착해도 글자가 함께 사라진다.**

      대화방 아이콘은 `.head .icon` 이 두 겹이라 더 셈이 세다. 같은 세기로 맞춰 줘야 이긴다.
    */
    const photoRules = [...this.senderPhotos]
      .map(([id, url]) => {
        const cls = avatarClass(id);
        const rule = `{background-image:url(${url});color:transparent}`;
        const paint = id === this.meta.dialogId ? `.head .icon.${cls}${rule}` : `.${cls}${rule}`;
        /*
          **사진이 있는 사람만 눌러 볼 수 있다.** 그릴 때는 사진이 올지 알 수 없어서
          마크업으로는 가릴 수 없다 - 여기서 손가락 모양을 되살려 준다. 사진이 없는
          아바타는 기본 커서라 누를 것이 아님이 드러난다.
        */
        return `${paint}a.face[href="#u${id}"]{cursor:zoom-in}`;
      })
      .join('');

    /*
      아바타 확대용 판. 사진이 있는 사람만 만든다.

      문서 끝에 모아 두는 이유는 **한 사람당 한 벌**로 끝내기 위해서다. 메시지마다 두면
      같은 그림이 대화 길이만큼 늘어난다.
    */
    const faceViews = [...this.senderPhotos]
      .map(
        ([id, url]) =>
          `<a class="zoom face-view" id="u${escapeHtml(id)}" href="#u${escapeHtml(
            id,
          )}"><img src="${url}" alt=""></a><a class="cl" href="#_">&times;</a>`,
      )
      .join('');

    return `${this.flushAlbum()}</div>${faceViews}${
      photoRules ? `<style>${photoRules}</style>` : ''
    }<p class="foot">${footLinks()}
<br><span class="ver">${escapeHtml(VERSION_LABEL)}</span></p>
<span id="end"></span></div>
<a class="jump" href="#end" title="Jump to the newest message" aria-label="Jump to the newest message">&darr;</a>
</body></html>
`;
  }

  private flushAlbum(): string {
    const album = this.album;
    this.album = null;
    if (!album || album.messages.length === 0) return '';
    // 앨범의 신원은 첫 장이 대표한다. 캡션도 보통 첫 장에 붙는다.
    return this.renderOne(album.messages[0], album.messages);
  }

  /** 날짜가 바뀌면 가운데 구분선. 앱 화면과 같은 규칙이다. */
  private daySeparator(message: MessageSummary): string {
    const key = dateKeyOf(message.date);
    if (key === this.lastDayKey) return '';
    this.lastDayKey = key;
    // 날짜가 바뀌면 발신자 묶음도 끊는다. 새 날의 첫 줄에는 이름이 나와야 한다.
    this.lastSenderId = undefined;
    return `<div class="day"><span>${escapeHtml(formatDisplayDate(message.date))}</span></div>`;
  }

  private renderOne(message: MessageSummary, group?: MessageSummary[]): string {
    let out = this.daySeparator(message);

    // 시스템 메시지는 누구의 말도 아니다. 가운데에 한 줄로 둔다.
    if (message.actionType && !message.text && !message.mediaType) {
      this.lastSenderId = undefined;
      /*
        `chatdeleteuser` 같은 내부 이름 대신 문장으로 적는다. 이 문서를 읽는 사람에게
        필요한 건 "누가 나갔다"이지 텔레그램의 클래스 이름이 아니다.

        모르는 종류는 원래 이름을 그대로 둔다 - 뭉개면 무슨 일이 있었는지 되짚을 수 없다.
      */
      const phrase = ACTION_PHRASES[message.actionType];
      const body = phrase
        ? `${escapeHtml(message.senderName ?? '')}${escapeHtml(phrase)}`
        : `${escapeHtml(message.actionType)}${
            message.actionClass ? ` (${escapeHtml(message.actionClass)})` : ''
          }`;
      return `${out}<div class="sys">${body} · ${escapeHtml(timeOf(message.date))}</div>`;
    }

    /*
      같은 사람이 이어서 말하면 이름과 아바타를 반복하지 않는다. 그래야 누가 바뀌었는지가
      눈에 띈다. 대신 자리는 남겨 둬야(av hole) 말풍선의 왼쪽 끝이 어긋나지 않는다.
    */
    const senderKey = `${message.out ? 'me' : ''}${message.senderId ?? message.senderName ?? ''}`;
    const repeated = senderKey === this.lastSenderId;
    this.lastSenderId = senderKey;

    /*
      한쪽으로 몰지 않기로 했으면 `own` 을 붙이지 않는다. 그러면 내 말도 남의 말과 같은
      줄에서 시작하고, 말풍선 색도 구별되지 않는다.
    */
    const own = message.out && this.meta.alignOwnRight;
    const classes = ['row', own ? 'own' : '', repeated ? 'tight' : ''].filter(Boolean);
    out += `<div class="${classes.join(' ')}">`;

    if (repeated) {
      out += '<div class="av hole"></div>';
    } else {
      const id = message.senderId;
      if (id) {
        this.avatarIds.add(id);
        // 미리보기는 **자리를 채워 두는 용도**다. 선명한 원본이 오면 그때 덮어쓴다.
        if (message.senderPhoto && !this.senderPhotos.has(id)) {
          this.senderPhotos.set(id, message.senderPhoto);
        }
      }
      const classes = ['av', id ? avatarClass(id) : ''].filter(Boolean);
      const face = `<div class="${classes.join(' ')}" style="background-color:${colorOf(
        id,
      )}">${escapeHtml(initialOf(message.senderName))}</div>`;

      /*
        아바타도 눌러서 크게 본다. 사진과 같은 방식(:target)이다.

        **사람마다 한 번만 큰 판을 만든다.** 같은 사람이 백 번 말했다고 확대용 그림을 백 개
        둘 이유가 없다 - 어느 말풍선 옆의 아바타를 누르든 같은 얼굴로 가면 된다. 그래서
        고정된 이름(`u{id}`)을 쓰고, 그 이름을 가진 판은 문서 끝에 한 벌만 둔다.

        사진이 없는 사람은 감싸지 않는다. 이름 첫 글자를 키워 봐야 볼 것이 없다.
      */
      out += id ? `<a class="face" href="#u${escapeHtml(id)}">${face}</a>` : face;
    }

    out += '<div class="col">';

    /*
      평평하게 놓을 때는 **내 메시지에도 이름을 적는다.** 오른쪽 정렬이 "이건 내 말"을
      대신하던 자리라, 그걸 없애면서 이름까지 빼면 누가 말했는지 알 수 없어진다.
    */
    /*
      이름은 **말풍선 안 첫 줄**에 둔다.

      밖에 두면 말풍선과 이름 사이에 틈이 생겨서, 이름이 그 말풍선의 것인지 바로 위
      미디어의 것인지 눈으로 한 번 더 짚어야 한다. 안에 넣으면 이름과 말이 한 덩어리가 된다.

      글이 없는 메시지(사진만 보낸 경우)는 담을 말풍선이 없으므로 위에 둔다.
    */
    const label =
      !repeated && !own
        ? `<b class="nm" style="color:${colorOf(message.senderId)}">${escapeHtml(
            message.senderName ?? '',
          )}</b>${message.senderKind === 'bot' ? '<span class="bot">BOT</span>' : ''}`
        : '';

    if (label && !message.text) out += `<div class="who">${label}</div>`;

    // 말풍선은 글이 있을 때만. 사진만 보낸 메시지에 빈 상자가 남으면 안 된다.
    if (message.text) {
      out += `<div class="bub">${
        label ? `<span class="nmline">${label}</span>` : ''
      }${escapeHtml(message.text)}<span class="at">${
        message.editDate ? '<i class="edit">edited</i>' : ''
      }${escapeHtml(timeOf(message.date))}</span></div>`;
    }

    if (message.mediaType) out += this.renderMedia(message, group);

    // 글이 없으면 시각을 실어 줄 말풍선이 없다. 미디어 아래에 따로 적는다.
    if (!message.text) {
      out += `<div class="who">${
        message.editDate ? '<i class="edit">edited</i>' : ''
      }${escapeHtml(timeOf(message.date))}</div>`;
    }

    return `${out}</div></div>`;
  }

  private renderMedia(message: MessageSummary, group?: MessageSummary[]): string {
    const items = group ?? [message];
    const drawable = items.filter((item) => this.pathOf(item));

    /*
      **파일이 담기지 않았어도 자리는 남긴다.** 아무것도 안 그리면 "사진이 없던 대화"처럼
      읽힌다. 종류와 파일 id 를 적어 두면, 나중에 원본을 구했을 때 어느 자리에 들어갈
      사진인지 이 문서만 보고도 맞출 수 있다.
    */
    if (drawable.length === 0) {
      return `<div class="med"><div class="miss">${items
        .map((item) => {
          const info = item.mediaInfo;
          const size = formatBytes(info?.size);
          return `not included · ${escapeHtml(item.mediaType ?? '')}${
            size ? ` · ${escapeHtml(size)}` : ''
          }${info?.fileName ? ` · ${escapeHtml(info.fileName)}` : ''}<div class="fid">id=${escapeHtml(
            info?.id ?? 'unknown',
          )}</div>`;
        })
        .join('<hr>')}</div></div>`;
    }

    const sticker = message.mediaType === 'sticker';

    /*
      **담겼다고 다 그릴 수 있는 건 아니다.** 움직이는 스티커는 `.tgs`(압축된 벡터 데이터)나
      `.webm` 이라 `<img>` 로는 안 나온다. 깨진 그림 아이콘을 보여주느니, 파일이 어디 있는지
      적어 두는 편이 낫다 — 열어 볼 방법은 받은 사람이 안다.
    */
    const playable = drawable.filter((item) => /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(this.pathOf(item)!));
    if (playable.length === 0) {
      return `<div class="med"><div class="miss">${drawable
        .map(
          (item) =>
            `${escapeHtml(item.mediaType ?? '')} · <span class="fid">${escapeHtml(
              this.pathOf(item)!,
            )}</span>`,
        )
        .join('<hr>')}</div></div>`;
    }

    const tags = playable
      .map((item) => {
        const path = this.pathOf(item)!;
        const alt = `${item.mediaType ?? ''} ${item.mediaInfo?.id ?? ''}`.trim();
        // loading=lazy 를 붙여야 사진 수천 장짜리 문서도 스크롤이 버틴다.
        const img = `<img src="${escapeHtml(path)}" alt="${escapeHtml(alt)}" loading="lazy">`;
        if (sticker) return img;
        /*
          닫기 판(.cl)을 그림 **바로 뒤**에 둔다. `~` 는 같은 부모의 뒤쪽 형제만 볼 수
          있어서, 떨어뜨려 놓으면 열려도 판이 안 나타난다.
        */
        const anchor = `m${item.id}`;
        return `<a class="zoom" id="${anchor}" href="#${anchor}">${img}</a><a class="cl" href="#_">&times;</a>`;
      })
      .join('');

    if (playable.length > 1) {
      return `<div class="med"><div class="alb">${tags}</div></div>`;
    }
    return `<div class="med${sticker ? ' stick' : ''}">${tags}</div>`;
  }

  /**
   * 이 문서에서 그림을 가리킬 상대 경로.
   *
   * `index.html` 이 zip 의 뿌리에 있고 사진은 `files/...` 에 있으니, 압축을 풀기만 하면
   * 그대로 이어진다. **절대 경로를 쓰면 안 된다** — 다른 사람 컴퓨터에서는 존재하지 않는다.
   */
  private pathOf(message: MessageSummary): string | undefined {
    return this.meta.photosIncluded ? this.paths.get(message.id) : undefined;
  }

  /** 메시지 id → zip 안의 사진 경로. exportChat 이 채워 준다. */
  readonly paths = new Map<number, string>();
}

export { escapeHtml, formatExportTimestamp };
