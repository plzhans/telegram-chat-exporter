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
 * 여러 쪽으로 나뉜 문서의 쪽 사이 이동 정보.
 *
 * 분할 내보내기일 때만 넘어온다 — `exportChat` 이 파일명을 정하므로 여기서 받아 네비를 그린다.
 * 없으면(통으로) 네비 자체가 안 그려진다.
 */
export interface PageNav {
  /** 이 쪽 번호(1부터). 총 쪽수는 스트리밍이라 미리 모르므로 싣지 않는다. */
  page: number;
  /** 더 과거(이전) 쪽 파일명. 첫 쪽이면 없다. */
  prev?: string;
  /** 더 최신(다음) 쪽 파일명. 마지막 쪽이면 없다. */
  next?: string;
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
 * ## 치수는 앱 화면에서 그대로 가져온다
 *
 * 같은 대화를 앱에서 보다가 이 파일을 열면 **같은 것으로 보여야 한다.** 그래서 말풍선의
 * 크기·색·여백·글자 크기를 눈대중으로 비슷하게 맞추지 않고, 앱이 쓰는 Tailwind 값을 그대로
 * 옮겨 적었다(px-3 py-2 = 0.75rem 0.5rem, rounded-2xl = 1rem, bg-slate-100, ...).
 *
 * 그래서 **루트 글자 크기를 17px 로 둔다.** 앱이 `globals.css` 에서 그렇게 정해 놨고,
 * Tailwind 의 값은 전부 rem 이라 이 하나가 어긋나면 대화 폭(48rem)부터 말풍선 글자까지
 * 6% 씩 작아진다. 실제로 그랬다 - 앱은 816px 칸에 14.3px 글자, 이 문서는 768px 칸에
 * 13.5px 글자였다.
 *
 * 픽셀로 적힌 값(사진 256/320px 처럼)은 앱에서도 픽셀이라 그대로 픽셀로 둔다.
 *
 * ## 왜 이런 규칙인가
 *
 * - **대화 자리에 테두리(.chat)** - 바탕을 희게 바꾸고 나니 대화가 어디서 시작해 어디서
 *   끝나는지가 사라졌다. 선 한 줄이면 "여기부터 저기까지가 그 대화"라고 말해 준다.
 *
 * - **열(.col)이 줄의 남은 자리를 다 차지한다** - 말풍선의 `max-width:74%` 가 무엇의 74%
 *   인지를 정하는 값이다. 열이 내용만큼만 넓으면 그 74% 는 **글 자신의 너비**의 74% 가
 *   되어, 옆이 텅 비어 있는데도 모든 말풍선이 1.4줄로 접힌다. 실제로 그랬다. 열이 줄을
 *   가득 채우면 74% 는 대화 폭의 74% 가 되고, 말풍선은 `align-items` 덕에 여전히 자기
 *   내용만큼만 넓어진다.
 *
 * - **머리말 접기(details)** - 브라우저가 원래 하는 일이라 코드가 필요 없고, 페이지 내
 *   찾기(Ctrl+F)가 접힌 안쪽까지 뒤져서 펴 준다. 인쇄할 때는 접혀 있어도 펼쳐 찍는다 -
 *   종이에 남는 문서에서 출처가 빠지면 안 된다.
 *
 * - **아바타는 contain** - 메시지에 딸려 온 미리보기는 몇십 px 이라, cover 로 잘리면 남는
 *   게 없다. 네모난 그림에는 둘이 같으므로 손해 보는 경우가 없다.
 *
 * - **말풍선 색도 앱 그대로** - 받은 말은 회색(slate-100), 보낸 말은 파랑. 한때 받은 말을
 *   연한 파랑에 테두리까지 둘렀는데, 앱과 나란히 놓으면 다른 프로그램에서 나온 것처럼
 *   보였다. 흰 바탕에서 회색 말풍선이 묻히지 않는다는 건 앱 화면이 이미 증명한다.
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
/*
  The column width is shared: the jump button anchors to this column, not the window.
  17px is the app's root size; every rem below is one of the app's own values.
*/
:root{--col:48rem;font-size:17px}
body{margin:0;background:#fff;color:#0F172A;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  font-size:13.5px;line-height:1.6;-webkit-text-size-adjust:100%}
.wrap{max-width:var(--col);margin:0 auto;padding:1rem}
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
  background-size:contain;background-repeat:no-repeat;background-position:center;
  overflow:hidden;position:relative}
.head summary{cursor:pointer;list-style:none;margin-top:6px;font-size:13px;color:#64748B}
.head summary::-webkit-details-marker{display:none}
.head summary::before{content:"\\25B8\\A0"}
.head details[open] summary::before{content:"\\25BE\\A0"}
.head dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:8px 0 0;font-size:13px}
.head dt{color:#64748B}
.head dd{margin:0;font-weight:600}
.head dd a{color:#2563EB}
/* conversation */
.chat{border:1px solid #E2E8F0;border-radius:1rem;padding:0.75rem}
.chat>:first-child{margin-top:0}
/* date divider: a pill between two rules, as in the app */
.day{display:flex;align-items:center;gap:0.75rem;margin-top:0.5rem;padding:0.25rem 0}
.day::before,.day::after{content:"";flex:1 1 0;height:1px;background:#E2E8F0}
.day span{background:#F1F5F9;color:#64748B;font-size:0.75rem;font-weight:600;
  padding:0.25rem 0.625rem;border-radius:999px}
.sys{text-align:center;color:#94A3B8;font-size:0.75rem;margin-top:0.5rem;padding:0.25rem 0}
.row{display:flex;gap:0.5rem;margin-top:0.5rem;align-items:flex-end}
.row.own{flex-direction:row-reverse}
/*
  The column fills the rest of the row. A shrink-to-fit column would make the bubble's
  percentage max-width resolve against the text's own width, wrapping every line early.
*/
.col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:0.125rem;
  align-items:flex-start}
.row.own .col{align-items:flex-end}
/* avatar: contain, never crop */
.av{width:1.75rem;height:1.75rem;border-radius:999px;flex:0 0 1.75rem;color:#fff;
  font-size:0.7rem;font-weight:600;display:flex;align-items:center;justify-content:center;
  background-size:contain;background-repeat:no-repeat;background-position:center;overflow:hidden;
  position:relative}
.av.hole{background:none}
/*
  The photo sits in an overlay on top of the initial letter, not as the element's own
  background. If neither the sharp nor the blurry file loads, the overlay stays transparent
  and the letter underneath shows - a floor that needs no file to exist. Layered background
  images give sharp-then-blurry fallback; a broken/missing layer reveals the one below.
*/
.pic{position:absolute;inset:0;border-radius:inherit;
  background-size:contain;background-repeat:no-repeat;background-position:center}
.who{font-size:0.75rem;font-weight:600;color:#64748B;padding:0 0.25rem}
/* sender name: first line inside the bubble */
/* max-content keeps a name longer than the message from wrapping inside a narrow bubble. */
.nmline{display:block;width:max-content;max-width:100%;font-size:0.75rem;
  color:#1D4ED8;margin-bottom:0.125rem}
.nm{font-weight:600}
.bot{background:#E2E8F0;color:#475569;border-radius:4px;padding:0 0.25rem;
  font-size:0.65rem;font-weight:700;margin-left:0.25rem;vertical-align:1px}
/* bubbles */
/*
  The bubble stops well short of the column, like the app does. A bubble that runs the
  full width reads as a paragraph, not as one person's turn - the ragged right edge is
  what makes a conversation scannable.
  flow-root makes the floated timestamp count towards the bubble's height.
*/
.bub{display:flow-root;background:#F1F5F9;color:#1E293B;border-radius:1rem;
  padding:0.5rem 0.75rem;max-width:74%;font-size:0.84375rem;line-height:1.5;
  white-space:pre-wrap;overflow-wrap:break-word}
.row.own .bub{background:#2563EB;color:#fff}
.at{float:right;margin-left:0.5rem;margin-top:0.25rem;
  font-size:0.7rem;line-height:1;color:#94A3B8}
.row.own .at{color:#DBEAFE}
.edit{font-style:normal;font-size:0.7rem;color:#B45309;margin-right:0.25rem}
.row.own .edit{color:#FDE68A}
/* media sits outside the bubble */
/* 256/320 are pixels in the app too - they size the picture, not the type. */
.med{position:relative;width:min(256px,100%)}
.med img{display:block;width:100%;height:auto;max-height:320px;border-radius:1rem;
  border:1px solid rgba(15,23,42,.15);background:#E2E8F0}
.med.stick{width:clamp(120px,30vw,220px)}
.med.stick img{border:0;border-radius:0;background:none;max-height:none}
/* album: two per row, each row as tall as the photos' own ratios make it */
.alb{border-radius:1rem;overflow:hidden;border:1px solid rgba(15,23,42,.15)}
.arow{display:flex}
.alb .zoom{min-width:0}
.alb img{width:100%;height:100%;object-fit:cover;border:0;border-radius:0;max-height:none}
.cnt{font-size:0.65rem;color:#94A3B8;padding:0 0.25rem}
/* the time sits on the picture when there is no bubble to carry it */
.ovt{position:absolute;bottom:0.375rem;right:0.375rem;background:rgba(15,23,42,.55);
  color:#fff;border-radius:999px;padding:0.125rem 0.375rem;font-size:0.7rem;line-height:1}
.ovt .edit{color:#FDE68A}
/* click to enlarge, CSS only (:target) */
.face{display:block;cursor:default;text-decoration:none}
.head .face{flex:0 0 44px}
.zoom{display:block;cursor:zoom-in}
/* the enlarged portraits stay hidden until their anchor is targeted */
.zoom.face-view{display:none}
.zoom.face-view:target{display:block}
/* the enlarged avatar is a background box (not an <img>) so the sharp/blurry fallback works */
.bigav{position:relative;display:block;width:min(320px,90vw);height:min(320px,90vw);
  border-radius:16px;overflow:hidden;background:#E2E8F0}
.cl{display:none}
.zoom:target{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
  z-index:99;max-width:96vw;max-height:96vh;cursor:default}
.zoom:target img{max-width:96vw;max-height:96vh;width:auto;height:auto;
  border-radius:0;background:none}
.zoom:target ~ .cl{display:flex;position:fixed;inset:0;z-index:98;
  background:rgba(15,23,42,.92);align-items:flex-start;justify-content:flex-end;
  padding:12px 16px;color:#fff;font-size:28px;line-height:1;text-decoration:none;cursor:zoom-out}
/* attachment kept out of this backup */
.miss{max-width:100%;border:1px dashed #CBD5E1;border-radius:1rem;padding:0.5rem 0.75rem;
  background:#F8FAFC;color:#475569;font-size:0.84375rem}
.fid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#64748B;
  word-break:break-all}
.foot{margin:24px 0 8px;text-align:center;color:#94A3B8;font-size:12px;line-height:1.8}
.foot a{color:#2563EB}
.ver{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#CBD5E1}
/* page navigation, only present when the export is split across files */
.pg{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;font-size:13px}
.pg a{color:#2563EB;text-decoration:none;font-weight:600}
.pg>span{color:#64748B}
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
  .chat{border-radius:0;border-inline:0;padding:0.375rem}
  .bub{max-width:82%}
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

/**
 * zip 안의 프로필 사진 경로.
 *
 * 사람마다 선명본 `avatars/{id}.jpg` 과 흐림본 `avatars/{id}.b.jpg` 이 있을 수 있다. HTML 은
 * 둘을 CSS 배경으로 겹쳐(`url(선명), url(흐림)`) 선명 우선·흐림 폴백을 하고, 둘 다 없으면
 * 이니셜로 떨어진다. **`exportChat` 이 파일을 담을 때 이 함수로 같은 경로를 쓴다** — 규칙과
 * 파일이 어긋나면 안 된다. id 는 파일명에 안전한 글자만 남긴다(클래스 이름과 같은 규칙).
 */
export function avatarFile(id: string, sharp: boolean): string {
  // 대시까지 밑줄로 바꾼다 — 채널·그룹 id 는 음수라, 두면 `-100…jpg` 처럼 대시로 시작하는
  // 파일명이 되어 압축을 푼 뒤 쉘에서 플래그로 오인된다.
  return `avatars/${id.replace(/[^A-Za-z0-9_]/g, '_')}.${sharp ? 'jpg' : 'b.jpg'}`;
}

export class HtmlReport {
  private lastDayKey?: string;
  private lastSenderId?: string;
  private album: Album | null = null;
  /**
   * **사진이 있는 사람들.** (id → 미리보기 data URL, 그런데 지금은 **키만** 쓴다.)
   *
   * 예전엔 이 data URL 을 문서 끝 CSS 에 base64 로 박았는데, 분할하면 쪽마다 그 데이터가
   * 되풀이돼 부풀었다. 이제 그림은 `avatars/{id}.jpg`·`.b.jpg` **파일**로 담고(exportChat),
   * 문서는 경로만 가리킨다. 그래서 여기 필요한 건 "누가 사진을 가졌나" 뿐 — 그 키로 어떤
   * 사람에게 아바타 규칙(`.pic` 배경)과 확대 판을 낼지 정한다. 값(data URL)은 안 쓴다.
   */
  private readonly senderPhotos = new Map<string, string>();

  constructor(private readonly meta: HtmlReportMeta) {}

  /**
   * 쪽 사이 이동 막대. 분할 내보내기의 각 쪽 위·아래에 붙는다.
   *
   * 첫 쪽엔 이전이, 마지막 쪽엔 다음이 없다. 빈 자리는 빈 span 으로 채워 `space-between`
   * 이 무너지지 않게 한다(이전=왼쪽, 쪽번호=가운데, 다음=오른쪽).
   *
   * 글자는 이 문서의 다른 곳과 같이 영어로 고정한다(head 주석 참고). index.html 이 가장
   * 과거라 "다음" 이 더 최신이다 — Older/Newer 로 그 방향을 말해 준다.
   */
  private navBar(nav: PageNav): string {
    const prev = nav.prev
      ? `<a href="${escapeHtml(nav.prev)}">&larr; Older</a>`
      : '<span></span>';
    const next = nav.next
      ? `<a href="${escapeHtml(nav.next)}">Newer &rarr;</a>`
      : '<span></span>';
    return `<nav class="pg">${prev}<span>Page ${nav.page}</span>${next}</nav>`;
  }

  /** 문서의 머리. 무엇을 언제 누가 받은 백업인지 먼저 밝힌다. */
  head(nav?: PageNav): string {
    const m = this.meta;
    /*
      분할이면 쪽마다 첫 줄에 날짜 구분선과 발신자 이름·아바타가 **다시** 나와야 한다.
      어느 쪽을 열든 문맥이 잡히게. 그래서 쪽이 열릴 때 두 상태를 비운다.
    */
    if (nav) {
      this.lastDayKey = undefined;
      this.lastSenderId = undefined;
    }
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
    )}">${escapeHtml(initialOf(m.dialogTitle))}${
      m.dialogPhoto ? '<span class="pic"></span>' : ''
    }</div></a>
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
${nav ? this.navBar(nav) : ''}<div class="chat">
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

  /** 마지막에 남은 앨범을 비우고 문서를 닫는다. 분할이면 아래쪽 이동 막대도 붙인다. */
  foot(nav?: PageNav): string {
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
    /*
      아바타 그림은 base64 로 박지 않고 **파일 경로**로 가리킨다(첨부 사진과 같다). 분할이면
      쪽마다 이 규칙이 되풀이되는데, 경로는 짧아서(수십 바이트) 예전 base64(장당 수십 KB)처럼
      쪽마다 부풀지 않는다.

      `.pic` 오버레이에 **선명본, 흐림본 순으로 겹친다.** 선명본이 있으면 그것이, 없으면 흐림본이,
      둘 다 없으면(로드 실패·파일 없음) 오버레이가 비어 밑의 이니셜 글자가 드러난다 — 3단 방어.
      배경을 `.pic`(자식)에 두므로 대화방 아이콘도 `.head .icon` 의 셈과 다툴 일이 없다.
    */
    const photoRules = [...this.senderPhotos.keys()]
      .map((id) => {
        const cls = avatarClass(id);
        const rule = `.${cls} .pic{background-image:url(${avatarFile(id, true)}),url(${avatarFile(
          id,
          false,
        )})}`;
        /*
          **사진이 있는 사람만 눌러 볼 수 있다.** 사진이 없는 아바타는 기본 커서라 누를 것이
          아님이 드러난다.
        */
        return `${rule}a.face[href="#u${id}"]{cursor:zoom-in}`;
      })
      .join('');

    /*
      아바타 확대용 판. 사진이 있는 사람만 만든다.

      문서 끝에 모아 두는 이유는 **한 사람당 한 벌**로 끝내기 위해서다. 메시지마다 두면
      같은 그림이 대화 길이만큼 늘어난다.
    */
    const faceViews = [...this.senderPhotos.keys()]
      .map(
        (id) =>
          `<a class="zoom face-view" id="u${escapeHtml(id)}" href="#u${escapeHtml(
            id,
          )}"><span class="bigav ${avatarClass(id)}"><span class="pic"></span></span></a>` +
          `<a class="cl" href="#_">&times;</a>`,
      )
      .join('');

    return `${this.flushAlbum()}</div>${nav ? this.navBar(nav) : ''}${faceViews}${
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
    const classes = ['row', own ? 'own' : ''].filter(Boolean);
    out += `<div class="${classes.join(' ')}">`;

    if (repeated) {
      out += '<div class="av hole"></div>';
    } else {
      const id = message.senderId;
      // 사진이 있는 사람만 기록해 둔다 — 문서 끝에서 이 목록으로 아바타 규칙·확대 판을 낸다.
      if (id && message.senderPhoto && !this.senderPhotos.has(id)) {
        this.senderPhotos.set(id, message.senderPhoto);
      }
      const classes = ['av', id ? avatarClass(id) : ''].filter(Boolean);
      // 사진이 있는 사람만 오버레이를 둔다. 없으면 이니셜 글자만 남는다.
      const pic = id && message.senderPhoto ? '<span class="pic"></span>' : '';
      const face = `<div class="${classes.join(' ')}" style="background-color:${colorOf(
        id,
      )}">${escapeHtml(initialOf(message.senderName))}${pic}</div>`;

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
    /*
      이름 색은 **모두 같다.** 한때 발신자마다 다른 색을 줬는데, 앱 화면은 이름을 한 가지
      파랑으로 적고 사람을 가르는 일은 아바타 색이 맡는다 - 이 문서에도 그 아바타가 그대로
      있으므로, 이름까지 색을 달리하면 같은 구실을 두 번 하면서 앱과 달라 보이기만 했다.
    */
    const label =
      !repeated && !own
        ? `<b class="nm">${escapeHtml(message.senderName ?? '')}</b>${
            message.senderKind === 'bot' ? '<span class="bot">BOT</span>' : ''
          }`
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

    /*
      글이 없으면 시각을 실어 줄 말풍선이 없다. 그때는 **사진 위 오른쪽 아래**에 얹는다 -
      앱이 하는 그 자리다. 사진 아래에 한 줄로 적으면 그 줄이 다음 메시지의 이름처럼 보인다.
      그릴 사진이 없는 경우(파일을 안 담은 백업)에만 아래 줄로 물러난다.
    */
    const stamp = message.text
      ? ''
      : `<span class="ovt">${
          message.editDate ? '<i class="edit">edited</i>' : ''
        }${escapeHtml(timeOf(message.date))}</span>`;

    let stamped = false;
    if (message.mediaType) {
      const media = this.renderMedia(message, group, stamp);
      out += media.html;
      stamped = media.stamped;
    }

    if (!message.text && !stamped) {
      out += `<div class="who">${
        message.editDate ? '<i class="edit">edited</i>' : ''
      }${escapeHtml(timeOf(message.date))}</div>`;
    }

    return `${out}</div></div>`;
  }

  /**
   * 첨부를 그린다.
   *
   * `stamp` 는 글이 없는 메시지의 시각 표시다. **그림을 실제로 그린 경우에만** 그 위에
   * 얹고(`stamped: true`), 그리지 못했으면 부르는 쪽이 아래 줄로 적게 돌려준다.
   */
  private renderMedia(
    message: MessageSummary,
    group: MessageSummary[] | undefined,
    stamp: string,
  ): { html: string; stamped: boolean } {
    const items = group ?? [message];
    const drawable = items.filter((item) => this.pathOf(item));

    /*
      **파일이 담기지 않았어도 자리는 남긴다.** 아무것도 안 그리면 "사진이 없던 대화"처럼
      읽힌다. 종류와 파일 id 를 적어 두면, 나중에 원본을 구했을 때 어느 자리에 들어갈
      사진인지 이 문서만 보고도 맞출 수 있다.
    */
    if (drawable.length === 0) {
      return {
        html: `<div class="miss">${items
          .map((item) => {
            const info = item.mediaInfo;
            const size = formatBytes(info?.size);
            return `not included · ${escapeHtml(item.mediaType ?? '')}${
              size ? ` · ${escapeHtml(size)}` : ''
            }${
              info?.fileName ? ` · ${escapeHtml(info.fileName)}` : ''
            }<div class="fid">id=${escapeHtml(info?.id ?? 'unknown')}</div>`;
          })
          .join('<hr>')}</div>`,
        stamped: false,
      };
    }

    const sticker = message.mediaType === 'sticker';

    /*
      **담겼다고 다 그릴 수 있는 건 아니다.** 움직이는 스티커는 `.tgs`(압축된 벡터 데이터)나
      `.webm` 이라 `<img>` 로는 안 나온다. 깨진 그림 아이콘을 보여주느니, 파일이 어디 있는지
      적어 두는 편이 낫다 — 열어 볼 방법은 받은 사람이 안다.
    */
    const playable = drawable.filter((item) =>
      /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(this.pathOf(item)!),
    );
    if (playable.length === 0) {
      return {
        html: `<div class="miss">${drawable
          .map(
            (item) =>
              `${escapeHtml(item.mediaType ?? '')} · <span class="fid">${escapeHtml(
                this.pathOf(item)!,
              )}</span>`,
          )
          .join('<hr>')}</div>`,
        stamped: false,
      };
    }

    const tagOf = (item: MessageSummary, style = '') => {
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
      return `<a class="zoom" id="${anchor}" href="#${anchor}"${style}>${img}</a><a class="cl" href="#_">&times;</a>`;
    };

    if (playable.length > 1) {
      /*
        **앨범은 두 장씩 한 줄이다.** 앱과 같은 셈을 쓴다 - 줄의 높이를 하나로 두고 가로를
        사진 비율대로 나누면, 칸의 비율이 사진 비율과 같아져서 **잘리지도 빈 자리가 남지도
        않는다.** 폭 W 를 두 장이 나눠 갖고 높이 h 가 같다면 `W = h·r₁ + h·r₂` 이므로
        줄의 가로세로비가 곧 비율의 합이다.

        치수를 모르는 사진은 1:1 로 본다. 짐작이지만 격자가 무너지지는 않는다.
      */
      const ratioOf = (item: MessageSummary) =>
        item.mediaWidth && item.mediaHeight ? item.mediaWidth / item.mediaHeight : 1;

      let grid = '';
      for (let index = 0; index < playable.length; index += 2) {
        const row = playable.slice(index, index + 2);
        const total = row.reduce((sum, item) => sum + ratioOf(item), 0);
        grid += `<div class="arow" style="aspect-ratio:${total.toFixed(4)}">${row
          .map((item) => tagOf(item, ` style="flex:${ratioOf(item).toFixed(4)}"`))
          .join('')}</div>`;
      }

      return {
        // 몇 장짜리 묶음인지 적어 둔다. 앱과 같다 - 잘려 보이는 장이 있어도 수는 남는다.
        html: `<div class="med"><div class="alb">${grid}</div>${stamp}</div><div class="cnt">${playable.length} photos</div>`,
        stamped: Boolean(stamp),
      };
    }

    return {
      html: `<div class="med${sticker ? ' stick' : ''}">${tagOf(playable[0])}${stamp}</div>`,
      stamped: Boolean(stamp),
    };
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
