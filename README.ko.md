# telegram-chat-exporter

[![ChatExporter](https://img.shields.io/badge/Telegram-ChatExporter-26A5E4?logo=telegram&logoColor=white)](https://telegram-exporter.plzhans.com)
[![Release](https://github.com/plzhans/telegram-chat-exporter/actions/workflows/release.yml/badge.svg)](https://github.com/plzhans/telegram-chat-exporter/actions/workflows/release.yml)
[![Deploy Pages](https://github.com/plzhans/telegram-chat-exporter/actions/workflows/deploy.yml/badge.svg)](https://github.com/plzhans/telegram-chat-exporter/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/releases)

[![Issues](https://img.shields.io/github/issues/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/issues)
[![Last Commit](https://img.shields.io/github/last-commit/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/commits/main)
[![Downloads](https://img.shields.io/github/downloads/plzhans/telegram-chat-exporter/latest/total)](https://github.com/plzhans/telegram-chat-exporter/releases/latest)
[![Stars](https://img.shields.io/github/stars/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/stargazers)

브라우저에서만 동작하는 텔레그램 대화 백업 도구. 백엔드가 없고, 정적 사이트로 배포되며,
사용자 인증 정보를 어디에도 보관하지 않는다.

배포본: <https://telegram-exporter.plzhans.com/>

English: [README.md](README.md)

---

## 개요

### 이게 뭔지

텔레그램 대화를 **zip 파일로 내려받는 웹페이지**다. 서버가 없다 — HTML·JS·CSS 몇 개가
전부고, 텔레그램과의 통신은 사용자 브라우저가 직접 한다.

- **넣는 것** — api_id/api_hash, 전화번호, 인증코드(필요하면 2단계 인증 비밀번호)
- **나오는 것** — `telegram-<대화방이름>-<날짜>.zip`
  - `index.html` — 대화 모양 그대로 읽히는 문서. 압축을 풀면 이걸 먼저 연다
  - `messages.jsonl` — 한 줄에 메시지 하나. 다시 기계로 읽기 위한 원본
  - `messages.txt` — 사람이 읽는 형태, 시간순
  - `attachments.jsonl` · `meta.json` — 첨부 기록, 대화방 정보와 내보낸 시각
- **안 되는 것** — 첨부 파일 실물 다운로드(지금은 첨부의 *종류*만 기록한다)

### 왜 만들었는지

세 가지가 동시에 필요했다.

1. **봇으로는 안 된다.** 텔레그램 Bot API 는 과거 대화 기록을 읽을 수 없고, 개인 대화는
   접근 자체가 불가능하다. 백업을 하려면 사람 계정으로 붙는 **MTProto 클라이언트 API** 를
   써야 한다.

2. **설치 없이 쓰고 싶었다.** MTProto 도구는 대개 파이썬·Node 스크립트라 런타임을 깔고
   터미널을 열어야 한다. 브라우저에서 바로 되면 그 단계가 사라진다. `web.telegram.org` 가
   실제로 하는 방식(WebSocket)이 그대로 쓰이므로 중계 서버도 필요 없다.

3. **인증 정보를 남한테 넘기고 싶지 않았다.** 이런 도구를 "서비스"로 만들면 사용자의
   전화번호와 로그인 코드가 남의 서버를 지나간다. 서버를 아예 두지 않으면 지나갈 곳이
   없고, 그 사실을 **사용자가 개발자도구로 직접 확인**할 수 있다 — CSP 가
   `connect-src` 를 텔레그램 WebSocket 으로만 열어두기 때문에, 설령 이 코드가 악의적이어도
   다른 서버로 내보낼 수 없다. 자세한 근거는 아래 [신뢰 모델](#신뢰-모델) 참고.

---

## 빌드

### 빌드 환경

| | 버전 | 근거 |
| --- | --- | --- |
| Node | **24.18.0** | `.nvmrc` |
| pnpm | **11.10.0** | `package.json` 의 `packageManager` |

**pnpm 전용이다.** `preinstall` 에 `only-allow pnpm` 이 걸려 있어서 npm·yarn 으로 설치하면
거부된다. 락파일이 `pnpm-lock.yaml` 하나뿐이라 다른 도구로 설치하면 의존성 버전이 달라진다 —
특히 `telegram` 패키지는 **2.26.21 에 정확히 고정**되어야 브라우저에서 동작한다
(이유는 아래 "`telegram` 버전을 올리지 말 것" 참고).

OS 의존성은 없다. 네이티브 빌드가 필요한 의존성(`bufferutil` 등)은 `pnpm-workspace.yaml`
에서 전부 꺼 두었다 — 브라우저로만 번들하므로 필요가 없다.

```bash
# Node 준비 (nvm 을 쓴다면)
nvm install && nvm use     # .nvmrc 를 읽는다

# pnpm 준비 (둘 중 하나)
corepack enable            # Node 에 딸린 corepack 사용 — 버전이 자동으로 맞는다
npm install -g pnpm        # 전역 설치

# 의존성 설치
pnpm install
```

### 환경변수

전부 **선택 사항**이다. 하나도 설정하지 않아도 앱은 동작한다.

```bash
cp .env.example .env.local   # Vite 가 자동으로 읽는다. gitignore 되어 있다.
```

| 변수 | 없을 때 | 설정하면 |
| --- | --- | --- |
| `VITE_TELEGRAM_API_ID` | 첫 화면에 "내 api_id 직접 입력"만 나온다 | "바로 시작" 선택지가 함께 뜬다 |
| `VITE_TELEGRAM_API_HASH` | 위와 같음 (둘은 항상 같이 넣는다) | 위와 같음 |
| `VITE_SOURCE_URL` | 이 저장소 주소가 기본값 | 헤더의 "소스 보기" 링크가 바뀐다 |

`VITE_*` 는 **빌드 시점에 번들에 박힌다.** 실행 중에 바꿀 수 없고, 감춰지지도 않는다.
공용 api_id 를 넣을지 말지는 정책 판단이라 아래 [api_id 정책](#api_id-정책)에 따로 적었다.

`.env.local` 에 넣지 않는 빌드 변수가 하나 더 있다. **배포할 때만** 쓴다.

| 변수 | 없을 때 (로컬) | 설정하면 (CI) |
| --- | --- | --- |
| `SITE_ORIGIN` | canonical·hreflang 을 상대 경로로 둔다 | 절대 주소로 완성한다 |

로컬 빌드는 어디에도 게시되지 않으므로 정식 주소라는 게 없다. 그래서 기본값을 지어내지 않고
비워 둔다 — 도메인은 소스가 아니라 배포하는 쪽이 아는 사실이다.

### 빌드 실행

```bash
pnpm build
```

이게 전부다. 옵션도 환경변수도 붙일 게 없다.

`tsc -b` 로 타입체크를 먼저 하고(**타입 오류가 하나라도 있으면 빌드가 멈춘다**),
`vite build` 가 `dist/` 를 만든다. 기존 `dist/` 는 지워지고 다시 생성된다.

빌드 결과물은 정적 파일뿐이라 아무 웹서버에나 올리면 된다. `dist/` 는 gitignore 되어 있다.

빌드 중 뜨는 청크 크기 경고는 정상이다. MTProto 라이브러리 하나가 수백 KB 라
기준을 1500KB 로 올려 뒀다.

### 하위 경로 배포

`vite.config.ts` 의 `base` 는 `'/'` 다. **로컬에서는 건드릴 일이 없다.**

저장소 이름이 경로에 끼는 곳(GitHub Pages 등)에 올릴 때만 빌드 쪽에서 넘긴다.

```bash
pnpm exec vite build --base=/보낼-경로/
```

경로를 소스에 적어 두지 않는 이유는, 어디에 올라가는지는 코드가 아니라 배포 설정이 아는
사실이기 때문이다. 포크하거나 옮길 때 소스를 고칠 일이 없다.

라우터는 이 값을 `import.meta.env.BASE_URL` 로 읽으므로 따로 맞출 게 없다.

### 받아서 실행하는 배포본 (standalone)

웹서버 없이 **`index.html` 을 더블클릭해서** 쓰는 형태다. 릴리스에 zip 으로 올리는 물건이
이것이다.

```bash
pnpm build:standalone
```

`dist-standalone/` 이 나온다. 폴더째 압축을 풀어 `index.html` 을 열면 그대로 동작한다
(`assets/` 는 같이 있어야 한다 — 링크가 상대경로다).

`file://` 로 열리는 문서라 웹 배포본과 세 가지가 다르다. **셋 다 파일 하나로 합쳐서 푼 게
아니라, 브라우저가 `file://` 에서 막는 것만 피해 간 것이다.**

| | 웹 배포 (`pnpm build`) | standalone |
| --- | --- | --- |
| 스크립트 | `<script type="module">` | 일반 스크립트 한 덩어리 (`assets/app.js`) |
| 라우터 | 주소 (`/dialogs`) | 해시 (`#/dialogs`) |
| 언어 | 주소 접두사 (`/en-us/`) | 고른 값을 저장 · 없으면 브라우저 설정 |

- **모듈이 아니다.** `file://` 은 `<script type="module">` 을 CORS 로 막는다(크롬·파이어폭스
  공통). 그래서 IIFE 한 덩어리로 뽑고 `type="module"`·`crossorigin` 을 떼어낸다.
  화면 코드의 `lazy(() => import(...))` 는 그대로 두고 `inlineDynamicImports` 로 합친다.
- **해시 라우터다.** 주소가 파일 경로라 히스토리 API 로 바꿀 대상이 없다. 웹 배포는
  그대로 둔다 — 해시는 검색엔진이 별개 주소로 보지 않아서 언어별 색인이 깨진다.
- **언어를 주소에 담을 수 없다.** 그래서 고른 값을 `localStorage` 에 두고 문서를 다시 연다
  (`src/shared/i18n/index.ts` 의 `switchLanguage`). 처음 열 때는 브라우저 설정을 따른다.
- **CSP 에 `file:` 이 열린다.** `file://` 문서의 출처는 이름 없는(opaque) 출처라 `'self'` 가
  아무것도 가리키지 못해서, 옆에 있는 자기 파일조차 못 읽는다. **정작 중요한
  `connect-src` 는 그대로다** — 이 배포본도 텔레그램 말고는 아무 데도 연결하지 못한다.
- **애널리틱스·광고는 값이 있어도 꺼진다.** 내려받아 자기 컴퓨터에서 여는 사람에게까지
  추적을 딸려 보내지 않는다. 그래야 아래 [애널리틱스와 광고](#애널리틱스와-광고)의
  "직접 받아서 실행하면 둘 다 꺼진다"가 빈말이 아니게 된다.

---

## 실행

### 개발 모드

```bash
pnpm dev     # http://localhost:5175
```

포트 5175 는 **고정**이다(`strictPort`). 이미 쓰이고 있으면 다른 포트로 비켜가지 않고
그냥 실패한다 — 조용히 옮겨가면 지금 어느 프로젝트를 보고 있는지 헷갈리기 때문이다.
같은 이유로 preview 는 5176 이다.

`host: true` 라 같은 네트워크의 다른 기기(폰 등)에서도 접속할 수 있다. 터미널에 찍히는
Network 주소를 쓰면 된다.

**개발 모드에는 CSP 가 적용되지 않는다.** Vite HMR 이 `ws://localhost` 로 붙고 React Fast
Refresh 가 인라인 스크립트를 끼워넣어서, 배포본과 같은 정책을 걸면 dev 서버가 아예 안 뜬다.
그래서 **CSP 관련 변경은 dev 에서 검증되지 않는다** — 아래 preview 로 확인해야 한다.

### dist 결과물로 실행

빌드해 둔 `dist/` 를 실제 배포본과 같은 조건으로 띄운다.

```bash
pnpm build
pnpm preview     # http://localhost:5176
```

**CSP 를 건드렸다면 반드시 이쪽으로 확인한다.** 배포본에만 들어가는 `<meta>` CSP 가 여기서는
실제로 걸리므로, 개발자도구 콘솔에 CSP 위반이 찍히는지 보면 된다. 위반을 코드로 세려면:

```js
// 개발자도구 콘솔에 붙여넣고 앱을 조작해 본다
addEventListener('securitypolicyviolation', (e) =>
  console.warn('CSP 위반:', e.violatedDirective, e.blockedURI),
);
```

`vite preview` 대신 다른 정적 서버를 써도 되지만 두 가지를 맞춰야 한다.

- **SPA 폴백** — `createBrowserRouter` 를 쓰므로 `/dialogs` 로 새로고침해도 `index.html` 을
  돌려줘야 한다. 안 그러면 404 가 뜬다.
- **`file://` 로 열면 안 된다** — 자산 경로가 절대경로이고, 모듈 스크립트는 `file://` 에서
  CORS 로 막힌다. 반드시 HTTP 로 띄운다. 파일을 직접 열어 쓸 목적이라면 이 결과물이 아니라
  [standalone 빌드](#받아서-실행하는-배포본-standalone)를 쓴다.

예를 들어 파이썬 기본 서버로는 SPA 폴백이 안 되므로, 첫 화면만 보고 싶을 때가 아니면 쓰지 않는다.

---

## 다국어

화면과 검색용 메타 정보 양쪽을 번역한다. 현재 **14개 언어**를 지원한다.

번역 파일: [`src/shared/i18n/locales/`](src/shared/i18n/locales/)

| 코드 | 언어 |
| --- | --- |
| [`ko-kr`](src/shared/i18n/locales/ko-kr.json) | 한국어 (기본) |
| [`en-us`](src/shared/i18n/locales/en-us.json) | 영어 |
| [`ja-jp`](src/shared/i18n/locales/ja-jp.json) | 일본어 |
| [`hi-in`](src/shared/i18n/locales/hi-in.json) | 힌디어 |
| [`ru-ru`](src/shared/i18n/locales/ru-ru.json) | 러시아어 |
| [`id-id`](src/shared/i18n/locales/id-id.json) | 인도네시아어 |
| [`pt-br`](src/shared/i18n/locales/pt-br.json) | 포르투갈어 (브라질) |
| [`ar-eg`](src/shared/i18n/locales/ar-eg.json) | 아랍어 |
| [`vi-vn`](src/shared/i18n/locales/vi-vn.json) | 베트남어 |
| [`es-mx`](src/shared/i18n/locales/es-mx.json) | 스페인어 (멕시코) |
| [`uk-ua`](src/shared/i18n/locales/uk-ua.json) | 우크라이나어 |
| [`tr-tr`](src/shared/i18n/locales/tr-tr.json) | 터키어 |
| [`fil-ph`](src/shared/i18n/locales/fil-ph.json) | 필리핀어 |
| [`kk-kz`](src/shared/i18n/locales/kk-kz.json) | 카자흐어 |

목록의 순서가 곧 **언어 선택 상자의 순서**다. 앞의 셋은 이 도구가 먼저 챙기는 사용자들이고,
그 뒤는 텔레그램 사용자 수가 많은 순서다.

**한 언어를 여러 나라가 써도 판을 나누지 않는다.** 인도·필리핀·나이지리아의 영어는 `en-us`
한 벌이 받고, 우크라이나·카자흐스탄의 러시아어는 `ru-ru` 가 받는다. 같은 글을 두 주소에 두면
번역이 갈라지고 검색 색인도 서로를 갉아먹는다. 지역별 매칭은 각 로케일의 `hreflang` 이
포괄 태그(`en` · `ru`)로 처리한다.

언어 목록과 접두사 규칙은 [`src/shared/i18n/languages.ts`](src/shared/i18n/languages.ts),
초기화는 [`src/shared/i18n/index.ts`](src/shared/i18n/index.ts) 에 있다.

### 주소가 언어를 정한다

```
/            한국어  (기본 언어라 접두사가 없다)
/en-us/      영어
/ar-eg/      아랍어
/en-us/dialogs
```

**기본 언어에만 접두사가 없다.** `/` 와 `/ko-kr/` 을 둘 다 두면 같은 내용이 두 주소에
걸리고, 검색엔진이 어느 쪽을 보여줄지 스스로 정한다. 그 판단을 넘길 이유가 없다.

**브라우저 설정보다 주소가 우선한다.** `/en-us/` 링크를 받은 사람은 브라우저가 한국어여도
영어를 본다 — 링크를 준 쪽이 그걸 의도했고, 검색엔진이 그 주소에 무엇이 있다고 색인해 둔
것과도 맞아야 한다.

접두사는 라우트 트리가 아니라 **라우터의 `basename`** 에 들어간다(`src/app/App.tsx`).
그래서 화면 코드의 `to="/dialogs"` 를 하나도 고치지 않아도 된다. 대신 `basename` 은 라우터를
만들 때 정해지므로 **언어 전환은 주소를 바꿔 다시 여는 방식**이다. 그게 맞다 — 언어마다
`index.html` 이 따로 있고 거기에 그 언어의 `<html lang>` 과 검색용 메타가 박혀 있다.

**예외는 [standalone 빌드](#받아서-실행하는-배포본-standalone)다.** 주소가 파일 경로라
언어를 담을 수 없어서, 고른 값을 `localStorage` 에 두고 문서를 다시 연다. 처음 열 때는
가리키는 주소가 없으니 브라우저 설정을 따른다 — 이때만 "주소가 우선"이 성립하지 않는다.

### 언어 코드에 지역을 붙인다

`en` 이 아니라 `en-us` 다. `en` 하나로 두면 나중에 영국 영어를 넣을 자리가 없고, 이미 나간
`/en/` 주소를 그때 쪼개면 색인된 주소가 바뀌고 받아 둔 링크가 깨진다.

`hreflang` 은 언어당 여러 개를 낸다. `en-US` 만 내보내면 영국·호주 사용자에게 매칭되지
않으므로, 영어판이 하나뿐인 동안은 포괄적인 `en` 도 함께 낸다. `en-gb` 가 생기는 날
`en-us` 의 `hreflang` 배열에서 `en` 만 빼면 된다. 같은 방식으로 `fil-ph` 는 옛 코드 `tl` 도
함께 낸다 — 안드로이드가 아직 그 이름으로 알려주는 기기가 있다.

### 언어 추가하기

두 군데만 손대면 된다.

1. `src/shared/i18n/locales/<코드>.json` 을 만든다. 기존 파일을 복사해서 번역하고,
   맨 위 `seo` 블록(`tag` · `ogLocale` · `hreflang` · `title` · `description` ·
   `shareDescription`)을 그 언어로 채운다.
2. `languages.ts` 의 `SUPPORTED_LANGUAGES` 에 코드를 한 줄 추가한다.

나머지는 자동이다 — 번역 파일은 `import.meta.glob` 이 끌어모으고, 언어 선택 목록의 이름은
`Intl.DisplayNames` 가 **그 언어 자신의 이름**으로 뽑고(`한국어`, `English`), 빌드는
`dist/<코드>/index.html` 을 하나 더 찍는다. `SUPPORTED_LANGUAGES` 에 넣은 자리가 곧 선택
상자에서의 자리다.

언어 이름을 그 언어로 적는 이유는, 자기 언어를 못 읽는 사람은 목록에서 자기 언어를 찾을 수
없기 때문이다.

### 오른쪽에서 왼쪽으로 읽는 언어

아랍어(`ar-eg`)가 들어오면서 `<html dir>` 이 필요해졌다. `languages.ts` 의 `dirOf()` 가
언어의 기본 부분을 보고 정하고, 빌드는 그 값을 언어별 `index.html` 에 박아 넣는다
(`localizedPages`). 실행 시점에도 앱이 다시 맞춘다 — 404 폴백으로 다른 언어의 셸이 올 수
있기 때문이다.

화면 쪽은 Tailwind 의 **논리 속성**으로 적어 둔다. `ml-`·`pr-`·`left-`·`text-left`·
`float-right` 대신 `ms-`·`pe-`·`start-`·`text-start`·`float-end` 를 쓴다 — 이쪽은 `dir` 을
보고 스스로 뒤집힌다. 방향이 의미인 아이콘(이전·다음 · 뒤로가기 화살표)에는 `rtl:rotate-180`
을 붙인다. 재생 삼각형처럼 **방향이 의미가 아닌 아이콘은 뒤집지 않는다.**

### 언어별로 진짜 HTML 파일이 나온다

```
dist/index.html               첫 화면 (정적)   <html lang="ko-KR">  canonical → /
dist/en-us/index.html         첫 화면 (정적)   <html lang="en-US">  canonical → /en-us/
dist/start/index.html         앱 셸
dist/en-us/start/index.html   앱 셸
dist/404.html                 앱 셸 (SPA 폴백)
dist/en-us/404.html           앱 셸 (SPA 폴백)
```

SPA 폴백(`404.html`)으로 때울 수도 있지만 그 주소는 **응답 코드가 404** 라 검색엔진이
색인하지 않는다. 언어별 주소를 만드는 목적이 색인이므로 실제 파일이 있어야 한다.
`vite.config.ts` 의 `localizedPages` 플러그인이 여섯 가지를 전부 만든다.

로그인 뒤 경로(`/en-us/dialogs`)는 실제 파일이 없어 404 폴백으로 뜬다. 어차피 색인 대상이
아니라 문제되지 않지만, 그 경우에도 `<html lang>` 이 틀리지 않도록 앱이 실행 시점에
문서의 언어를 실제 언어로 맞춘다.

### 첫 화면은 React 가 아니라 정적 HTML 이다

색인되는 주소는 `/` 와 `/<언어>/` 뿐이다. 즉 **크롤러가 실제로 읽는 문서가 그것들**이라,
거기에 빈 `<div id="root">` 만 있으면 곤란하다. 구글은 JS 를 실행하긴 하지만 크롤과 렌더가
다른 큐라 며칠씩 밀리고, 네이버·다음·GPTBot 은 사실상 못 읽는다.

무게도 이유다. 앱 번들에는 MTProto 라이브러리가 들어 있어 gzip 530KB 인데, 홍보 한 장
보여주려고 그걸 받게 하면 LCP·INP 가 나빠진다 — 둘 다 검색 순위에 직접 들어가는 신호다.

| | 첫 화면 (`/`) | 앱 (`/start/`) |
| --- | --- | --- |
| HTML | 26KB (본문 포함) | 6KB |
| CSS | 28KB | 28KB |
| JS | **0.5KB**(애널리틱스만) | 1.76MB |

`build/landing.ts` 가 문자열만 다룬다. React 컴포넌트로 두고 `renderToStaticMarkup` 하는
방법도 있지만, 그러면 i18n·라우터·zustand 를 Node 에서 돌릴 준비를 해야 한다 — 얻는 것에
비해 딸려 오는 게 너무 많다.

**문구는 로케일 JSON 의 `landing` 블록이다.** 앱 화면과 같은 파일, 같은 키를 쓴다.
없는 언어는 **한국어가 아니라 영어**로 떨어진다 — 일본어 주소에 한국어 홍보문이 뜨는 건
영어가 뜨는 것보다 나쁘다. 블록을 채우는 순간 저절로 그 언어를 쓰므로 코드는 안 고쳐도 된다.

화면에 적히는 `connect-src` 한 줄은 **방금 심은 CSP 에서 뽑아 온다.** 손으로 적으면
애널리틱스를 켜고 끌 때마다 어긋나는데, 하필 그 문장이 이 앱의 신뢰 근거다.

**개발 모드에서는 이 화면을 볼 수 없다.** 정적 랜딩은 빌드 때만 찍히고, dev 에서는 CSS 도
JS 가 주입하므로 스크립트 없는 문서는 아예 스타일이 없다. `pnpm build && pnpm preview` 로
확인한다 — CSP 와 같은 이유다.

---

## 애널리틱스와 광고

**둘 다 배포 환경변수가 있을 때만 켜진다.** 로컬 빌드에는 관련 코드가 아예 들어가지 않는다.

| 변수 | 켜지면 |
| --- | --- |
| `VITE_GOOGLE_ANALYTICS_ID` | 구글 애널리틱스. `connect-src` 에 구글 수집 호스트가 열린다 |
| `VITE_GOOGLE_ADSENSE_ID` | 구글 애드센스. script·frame·img·connect 가 광고망까지 열린다 |

### 켜면 무엇이 깨지는가

이 앱의 신뢰 근거는 **`connect-src` 가 텔레그램 하나뿐**이라는 것이다. 사용자가 개발자도구
네트워크 탭만 열면 확인되는 사실이고, 화면 안내도 그걸 근거로 삼는다.

애널리틱스나 광고를 켜면 **그 문장이 더는 참이 아니다.** 브라우저가 막아 주던 보장이
"우리가 안 보낸다"는 약속으로 내려앉는다. 그래서 값 하나가 세 가지를 동시에 가른다.

1. 기능이 들어간다
2. CSP 가 그만큼 열린다
3. **첫 화면에 외부 연결 고지가 뜬다**

셋이 한 스위치에 묶여 있어야 "켜 놓고 안 알리는" 상태가 생기지 않는다.

### 고지 내용

`trust.analytics` · `trust.ads` (로케일 JSON). 켜진 것만 화면에 나온다.

- 어디로 연결하는지 호스트 이름까지 밝힌다
- 보내는 것(첫 화면 방문·언어)과 보내지 않는 것(대화 내용·전화번호·로그인 코드·대화방 id)을 나눠 적는다
- 차단해도 도구는 동작한다고 알린다
- **원하지 않으면 내려받아 직접 실행하라고 안내한다.** 직접 빌드하면 둘 다 꺼지므로 이건 빈말이 아니다

### 대화방 id 를 보내지 않는다

`/dialogs/123456789` 의 숫자는 텔레그램 대화방 id 다. 기본 설정의 gtag 는 주소를 통째로
보내므로 그대로 두면 **어떤 대화방을 열었는지가 구글에 쌓인다.** `send_page_view: false` 로
자동 수집을 끄고 첫 화면 경로만 보낸다(`src/shared/analytics/gtag.ts`).

같은 이유로 **로그인 화면과 대화 화면에는 광고를 넣지 않는다.** 전화번호와 인증코드를 받는
자리에 남의 iframe 을 띄우는 것은 이 도구가 요구하는 신뢰와 정면으로 어긋난다.

### CSP 를 어디까지 여는가 — 근거 문서

두 제품의 요구 사항이 **완전히 다르다.** 애널리틱스는 도메인 몇 개만 열면 되지만, 애드센스는
사실상 script-src 를 포기해야 한다.

| | 근거 문서 | 여는 범위 |
| --- | --- | --- |
| 애널리틱스 | [Google 태그 CSP 가이드](https://developers.google.com/tag-platform/security/guides/csp?hl=ko) | 도메인 3종 |
| 애드센스 | [AdSense 콘텐츠 보안 정책](https://support.google.com/adsense/answer/16283098?hl=ko) | `https:` 전체 + `unsafe-eval` |

**애널리틱스** — 문서가 지정한 그대로 넣었다. 와일드카드가 호스트 왼쪽에만 붙는 형태라
`region1.google-analytics.com` 같은 지역 엔드포인트도 `*.google-analytics.com` 에 덮인다.

```
script-src  https://*.googletagmanager.com
img-src     https://*.google-analytics.com https://*.googletagmanager.com
connect-src https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com
```

구글이 주는 스니펫은 `<script>` 안에 설정 코드가 들어 있어 `script-src 'unsafe-inline'` 을
요구하는데, **그건 내주지 않았다.** 인라인이 허용되는 순간 XSS 한 방이 곧 인증코드 탈취가
된다. 같은 일을 번들 코드가 하게 만들어(`src/shared/analytics/gtag.ts`) `script-src 'self'` 로
덮고, 바깥에서 받아 오는 스크립트 호스트만 열었다.

### ⚠️ 애드센스는 이 사이트의 CSP 와 양립하지 않는다

문서가 지원한다고 밝힌 **유일한** 형태는 nonce 기반이고, 요구 사항이 이렇다.

```
script-src 'nonce-{매 응답마다 새 값}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https:
```

같은 문서가 **도메인 허용목록은 권장하지 않는다**고 명시한다 — 광고가 쓰는 도메인이 수시로
바뀌기 때문이다. 그리고 **이 사이트는 서버가 없어서 nonce 를 만들 수 없다.** 정적 파일은
응답마다 값을 바꿔 줄 주체가 없다.

남는 선택지는 `https:` 를 통째로 여는 것뿐이고, 그러면 script-src 는 사실상 없는 것과 같다.
아무 https 출처의 스크립트가 실행되고 `eval` 도 열린다. 전화번호와 로그인 코드를 받는
화면에서 그 대가는 특히 크다.

`VITE_GOOGLE_ADSENSE_ID` 를 넣으면 그 정책이 그대로 적용된다. 숨기지 않지만, 넣기 전에
**광고를 다른 출처의 페이지로 분리하는 쪽**을 먼저 검토할 것을 권한다 — 소개 페이지에만
광고를 싣고 도구는 지금 CSP 를 지키는 구성이다.

### dev 모드에서는 안 보낸다

`.env.local` 에 값이 있어도 `pnpm dev` 는 아무것도 보내지 않는다(`import.meta.env.PROD` 로
막는다). 개발 중 새로고침이 방문 수로 잡히면 통계가 오염된다. 배포본과 같은 화면을 보려면
빌드해서 `pnpm preview` 로 확인한다.

---

## 배포

**GitHub Actions 로 GitHub Pages 에 올린다.** `.github/workflows/deploy.yml` 이
`main` 브랜치 푸시마다 빌드→배포를 돌린다. 빌드 결과물을 저장소에 커밋하지 않는다.

저장소 설정에서 한 번만 해 두면 된다: **Settings → Pages → Source 를 `GitHub Actions`** 로.

주소를 워크플로에 적어 두지 않는다. `actions/configure-pages` 가 **Pages 설정에서 실제
주소를 읽어 오고**, 거기서 나온 값을 빌드에 넘긴다. 그래서 커스텀 도메인을 붙이거나 떼도,
포크하거나 저장소를 옮겨도 손댈 곳이 없다.

| 넘기는 값 | 커스텀 도메인일 때 | `github.io` 일 때 |
| --- | --- | --- |
| `--base` | `/` | `/<저장소이름>/` |
| `SITE_ORIGIN` | `https://<커스텀 도메인>` | `https://<소유자>.github.io` |

`VITE_SOURCE_URL` 도 CI 가 자기 저장소 주소로 채운다 — 배포본과 같은 커밋이 올라간 곳을
가리켜야 하기 때문이다.

**이 저장소는 커스텀 도메인을 쓴다.** 그래서 실제 배포는 `--base` 없이(루트) 나가고
canonical 은 `https://telegram-exporter.plzhans.com/` 을 가리킨다.

**SPA 폴백(`404.html`)은 워크플로가 아니라 빌드가 만든다.** Pages 에는 리라이트 규칙이
없어서 `/dialogs` 로 새로고침하면 없는 파일이 되고, 그때 Pages 가 `404.html` 을 내준다.
그 내용이 앱 셸이면 라우터가 경로를 읽고 정상 렌더한다. (응답 코드는 404 로 남지만 화면은
정상이다.)

예전에는 이 자리에서 `cp dist/index.html dist/404.html` 로 만들었다. 지금은 `index.html`
이 **스크립트가 없는 정적 첫 화면**이라 그 복사가 성립하지 않는다 — 앱이 아예 안 뜨는
폴백이 된다. 어느 문서가 앱 셸인지는 빌드만 아는 사실이라 `localizedPages` 가 함께 찍는다.

**언어별 디렉터리도 각자 자기 `404.html` 을 갖는다.** 루트 것 하나로 때우면
`/en-us/dialogs` 새로고침에서 한국어판 셸이 떠서 언어가 조용히 리셋된다.

공용 api_id 를 쓸 거라면 **Settings → Secrets and variables → Actions → Variables** 에
`VITE_TELEGRAM_API_ID` / `VITE_TELEGRAM_API_HASH` 를 넣는다. Secrets 가 아니라 Variables 인
이유는 어차피 클라이언트 번들에 그대로 박히는 값이라 감춰도 의미가 없기 때문이다 —
아래 [공용 키 운영](#공용-키-운영--난독화는-하지-않는다) 참고.

### ⚠️ GitHub Pages 는 CSP 를 헤더로 못 건다

이 앱의 신뢰 근거는 CSP 인데, **Pages 는 커스텀 응답 헤더를 지원하지 않는다.** 그래서
`index.html` 의 `<meta>` CSP 만 적용되고, 다음 차이가 생긴다.

- `frame-ancestors` 가 **동작하지 않는다** (meta 태그에서 지원되지 않는 지시자다).
  즉 다른 사이트가 이 페이지를 iframe 으로 감쌀 수 있다.
- meta CSP 는 **HTML 파싱이 시작된 뒤**에 걸린다. 헤더보다 적용 시점이 늦다.
- `X-Content-Type-Options`, `Referrer-Policy` 등 나머지 보안 헤더도 빠진다.

핵심인 `connect-src`(= 텔레그램 외 어디로도 못 보낸다)는 meta 로도 그대로 강제되므로
가장 중요한 약속은 유지된다. 그래도 **진짜 헤더가 필요하면 Cloudflare Pages 를 쓴다** —
`public/_headers` 에 정책이 이미 들어 있고, `public/_redirects` 가 SPA 폴백을 처리한다.
두 파일은 Pages 에서는 그냥 무시된다(빌드 결과물에 포함은 되지만 아무 효과가 없다).

Cloudflare 는 루트 배포라 `--base` 없이 `pnpm build` 그대로 올리면 된다.

### 릴리스 — 내려받아 실행하는 배포본

`.github/workflows/release.yml` 이 **`release/v*` 태그**에 반응한다. 태그가 붙으면
[standalone 빌드](#받아서-실행하는-배포본-standalone)를 돌려 zip 으로 묶고, 그 이름의
릴리스를 만들어 첨부한다.

```bash
# version 을 올리고, 커밋하고, 태그까지 한 번에.
pnpm release minor          # patch · minor · major, 또는 1.0.0 같은 정확한 값
git push --follow-tags
```

`pnpm release` 는 `pnpm version` 에 `--tag-version-prefix=release/v` 를 붙인 것뿐이다.
`package.json` 을 고치고, 그 버전만 적힌 커밋을 만들고, `release/v1.0.0` 태그를 단다 —
셋이 항상 같이 움직이니 버전을 어긋나게 밀어 넣을 수가 없다. (프리픽스를 `.npmrc` 의
`tag-version-prefix` 에 적어 두는 방법은 **pnpm 이 읽지 않아서** 안 된다. 그래서 스크립트다.)

태그는 annotated 라 `--follow-tags` 로 커밋과 함께 올라간다. 작업 트리가 지저분하면
`pnpm version` 이 먼저 멈춘다.

**태그와 `package.json` 의 버전이 다르면 워크플로가 멈춘다.** 화면 하단과 내보낸 문서에
찍히는 버전은 `package.json` 에서 오기 때문이다 — 태그만 올리면 `v1.0.0` 이라는 이름으로
`v0.1.0` 이라 적힌 파일이 나가고, 받은 사람은 어느 쪽을 믿어야 할지 알 수 없다.

zip 안은 `telegram-exporter-v1.0.0/` 폴더 하나다. 압축을 풀면 `index.html`, `assets/`,
그리고 실행 방법과 "무엇이 어디로 가는가"를 적은 `README.txt`(`.github/release-assets/`)가
들어 있다.

**애널리틱스·광고는 이 경로에 아예 넘기지 않는다.** 넘겨도 standalone 빌드가 무시하지만,
워크플로에서도 빼 두어 두 군데가 같은 말을 하게 한다. 공용 api_id(Variables)는 웹 배포와
같은 규칙으로 들어간다 — 받은 사람이 전화번호만 넣고 바로 쓸 수 있어야 하기 때문이다.

---

## 설계 배경

이 아래는 "왜 이렇게 만들었는가"에 대한 기록이다. 쓰기만 할 거라면 읽지 않아도 된다.

## 어떻게 서버 없이 되는가

텔레그램 **Bot API 가 아니라 MTProto 클라이언트 API** 를 쓴다. 봇은 과거 대화 기록을 읽을 수
없어서(개인 대화는 접근 자체가 불가) 백업 용도로 못 쓴다.

브라우저에서 MTProto 를 태우는 건 `web.telegram.org` 가 실제로 하는 방식 그대로다 —
WebSocket(`wss://*.web.telegram.org/apiws`)으로 붙는다. WebSocket 은 CORS 정책 대상이 아니라서
중계 서버가 필요 없다.

## 왜 GramJS(`telegram`)인가

`telegram` 패키지는 archived 되었고 `teleproto` 라는 포크가 유지보수되고 있다. 그럼에도
GramJS 를 쓴다 — **teleproto 는 브라우저 지원을 걷어낸 Node 지향 포크**이기 때문이다.

| | `telegram` (GramJS) | `teleproto` |
| --- | --- | --- |
| 브라우저 감지 | `platform.ts` 의 `isBrowser` | 없음 |
| 암호화 | `crypto.subtle` (WebCrypto) | Node `crypto` 전용 |
| 기본 전송 | 브라우저면 WSS | `PromisedNetSockets` (raw TCP) |
| 브라우저 번들 | 783KB (gzip 234KB) | 2.6MB (gzip 455KB) |

teleproto 로 옮기려면 전송 계층을 수동으로 갈아끼우고 순수 JS 암호화를 감수해야 한다(2FA 의
PBKDF2-SHA512 가 특히 느려진다). 그래서 archived 리스크를 안고 GramJS 에 남는다.

### ⚠️ `telegram` 버전을 올리지 말 것 — `2.26.21` 고정

GramJS 는 **같은 패키지로 Node 빌드와 브라우저 빌드를 따로 배포한다.**

| dist-tag | 버전 | `CryptoFile.js` 가 가리키는 것 |
| --- | --- | --- |
| `latest` | 2.26.22 | `require("crypto")` — Node 전용 |
| `browser` | **2.26.21** | `require("./crypto/crypto")` — WebCrypto |

`latest` 를 브라우저에서 쓰면 인증키 교환 단계에서
`a.default.randomBytes is not a function` 으로 죽는다. 브라우저 빌드는 `CryptoFile` 뿐 아니라
`fs`·`os`·`path`·`net`·`socks` 도 자체 껍데기로 바꿔 배포하고, zlib 대신 pako 를 쓴다.

그래서 `package.json` 에 캐럿 없이 **정확히 `"telegram": "2.26.21"`** 로 고정돼 있다.
`^` 를 붙이거나 `pnpm update` 로 올리면 2.26.22(Node 빌드)로 넘어가 같은 버그가 재발한다.

이 고정 덕분에 Vite 쪽에서 Node 모듈을 수동으로 껍데기 처리할 필요가 없어졌고,
node 폴리필도 `buffer` 하나만 남았다.

## 신뢰 모델

사용자 입장에서 이 사이트는 "전화번호와 로그인 코드를 요구하는 처음 보는 웹페이지"다.
텔레그램이 코드 메시지에 직접 "누구에게도 알려주지 마세요"라고 써서 보내므로, 의심하는 게
정상이다. 이 프로젝트는 그 의심에 **검증 가능한 답**을 내놓는 걸 최우선으로 설계했다.

1. **CSP 로 브라우저가 강제한다.** `connect-src` 가 텔레그램 WebSocket 으로만 열려 있어서,
   설령 이 코드가 악의적이어도 전화번호·인증코드·대화 내용을 다른 서버로 보낼 수 없다.
   개발자도구 → 네트워크 탭에서 누구나 확인할 수 있다.

   ```
   default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob:; font-src 'self';
   connect-src wss://*.web.telegram.org wss://*.web.telegram.org:443;
   form-action 'none'; base-uri 'none'; frame-ancestors 'none'
   ```

2. **외부 리소스를 기본적으로 두지 않는다.** CDN·웹폰트를 쓰지 않는다. 하나라도 늘면 위 CSP 가
   느슨해져서 약속이 깨진다. (medifinder-web 이 쓰는 Google Fonts 를 여기서만 빼고 시스템
   폰트를 쓰는 이유다.)

   **예외는 애널리틱스와 광고다.** 둘 다 배포 환경변수로만 켜지고, 켜지면 그만큼 CSP 가
   열린다 — 아래 [애널리틱스와 광고](#애널리틱스와-광고) 참고. 직접 빌드하면 둘 다 꺼진다.

3. **`eval` 이 번들에 없다.** `script-src 'self'` 에 `unsafe-eval` 을 넣지 않아도 되도록
   node 폴리필을 `buffer` 하나로 좁혔다. `crypto` 를 폴리필하면 crypto-browserify 가
   asn1.js → `vm` → `eval` 을 끌고 들어와 CSP 에 걸린다. 브라우저 빌드는 WebCrypto 를
   쓰므로 애초에 필요 없다.

4. **세션을 localStorage 에 두지 않는다.** "이 탭에서 로그인 유지"를 켜면 세션 문자열이
   **sessionStorage** 에만 들어간다. 브라우저가 탭을 닫을 때 알아서 지우므로, 새로고침은
   살아남고 며칠씩 남지는 않는다. 끄면 메모리에만 두고 새로고침 시 다시 로그인한다.

   sessionStorage 를 고른 이유는 localStorage 와의 차이가 **수명**이기 때문이다. 세션
   문자열은 인증키 그 자체라, 명시적으로 지울 때까지 남는 저장소에 두면 공용 PC 나 프로필을
   공유하는 상황에서 그대로 계정이 넘어간다.

   저장본에는 **유휴 만료(기본 60분)** 가 붙는다. 탭이 살아 있는 동안 1분마다(그리고 탭이
   다시 보일 때) 만료 시각을 밀어주므로 작업 중에 끊기지는 않고, 손을 놓으면 만료된다.
   sessionStorage 만으로는 **탭을 켜둔 채 자리를 비운 경우**에 아무 보호가 없어서 넣었다.

   **다만 "브라우저를 닫으면 반드시 지워진다"고 약속하지는 않는다.** 크롬·파이어폭스의
   세션 복원("계속하기", 비정상 종료 후 복구)은 sessionStorage 까지 되살리고, 탭 복제도
   내용을 복사한다. TTL 은 이 중 **시간이 흐른 경우만** 막는다 — 크래시 직후 즉시 복원이나
   탭 복제처럼 시간이 안 흐른 경우는 여전히 통과한다. 노출 창을 좁힐 뿐 없애지는 못한다.
   확실히 없애는 유일한 방법은 로그아웃이다(계정에서 세션까지 종료된다).

5. **세션 이름이 식별 가능하다.** 텔레그램 활성 세션 목록에 `Telegram Exporter (browser)` 로
   뜨므로, 사용자가 백업 후 어느 세션을 종료해야 할지 알 수 있다. 앱 안의 "로그아웃 및 세션
   종료" 버튼은 `auth.LogOut` 을 호출해 계정에서 이 세션을 지운다.

이걸 다 해도 의심하는 사용자는 남는다. 없앨 수 없는 한계이고, 안내 문구에서 숨기지 않는다.

## api_id 정책

공용 키와 사용자 직접 입력을 **둘 다** 지원한다.

- `VITE_TELEGRAM_API_ID` / `VITE_TELEGRAM_API_HASH` 가 설정되어 있으면 "바로 시작" 선택지가
  뜬다. 사용자는 전화번호만 넣으면 된다.
- 설정하지 않으면 사용자가 my.telegram.org 에서 발급한 키를 넣는 화면만 나온다.
- 공용 키가 있어도 "내 api_id 직접 입력" 경로는 항상 열려 있다.

공용 키 단독으로 가지 않는 이유는 **단일 장애점**이라서다. 공개된 api_id 는 스팸에 재사용되기
쉽고, 텔레그램이 폐기하면(`API_ID_PUBLISHED_FLOOD`) 전 사용자가 동시에 막힌다. 그 에러가 뜨면
안내 문구가 직접 입력으로 유도한다.

사용자가 넣은 api_id 는 localStorage 에 남긴다. 이건 앱 식별자일 뿐 계정 접근 권한이 아니라서
세션과 정책이 다르다.

### 공용 키 운영 — 난독화는 하지 않는다

공용 api_id 를 번들 안에서 base64 등으로 감추자는 아이디어가 나올 수 있는데, **효과가 없다.**

GramJS 는 모든 연결마다 `InvokeWithLayer(InitConnection({ apiId, deviceModel, ... }))` 을
보낸다(`client/telegramBaseClient.js`). 즉 텔레그램은 소스를 크롤링할 필요 없이 **자기 서버
로그에서** "이 api_id 가 서로 다른 계정 N개·IP M개에서 쓰이고 있다"를 그대로 본다.
`API_ID_PUBLISHED_FLOOD` 를 유발하는 건 소스 노출이 아니라 그 사용 패턴이다.

게다가 우리는 같은 요청에 `deviceModel: "Telegram Exporter (browser)"` 를 실어 보낸다.
사용자가 활성 세션 목록에서 이 도구를 알아보게 하려는 의도적 선택이고, 그 덕에 텔레그램은
이 도구를 이미 한 줄로 특정할 수 있다. 서버에 앱 이름을 broadcast 하면서 번들 안의 숫자를
숨기는 건 앞뒤가 맞지 않는다.

무엇보다 난독화는 **속이고 싶은 쪽(텔레그램)은 못 속이고 설득해야 할 쪽(사용자)만 잃는다.**
전화번호를 요구하는 페이지에서 난독화된 상수를 발견한 사람이 그 사이트를 믿을 이유가 없다.
이 프로젝트의 신뢰 근거가 "검증 가능성"인 이상 이건 순손실이다.

실제로 하는 것:

1. **키를 저장소에 넣지 않는다.** `.env.local` 은 gitignore 되어 있고, 배포 시에는
   빌드 환경변수로만 넣는다(GitHub Actions 의 Variables, Cloudflare Pages 의 환경변수).
   번들에는 남지만 소스 유통 경로는 막힌다. 난독화와 달리 이건 실제 방어다.
2. **공용 키를 소모품으로 본다.** 폐기되면 환경변수를 바꾸고 재배포하면 끝이다.
   "내 api_id 직접 입력" 폴백이 항상 열려 있어 서비스가 멈추지 않는다.
3. **사용량이 곧 위험이다.** 차단 신호가 사용 패턴이므로, 트래픽이 커지면 공용 키를 빼고
   직접 발급만 남기는 선택지를 고려한다.

## 스택

medifinder-web 과 동일하게 맞췄다.

pnpm · Vite 6 · React 19 · TypeScript(strict) · Tailwind 3 · zustand · TanStack Query ·
react-router-dom 7 · react-hook-form · zod · i18next · lucide-react

구조도 같은 FSD-lite다.

```
src/
  app/          라우터, 레이아웃
  features/
    auth/       api_id 입력 → 전화번호 → 코드 → 2FA
    dialogs/    대화방 목록, 대화 보기
    export/     기간 지정 내보내기, zip 쓰기, HTML 문서 생성
  shared/
    auth/       zustand 인증 스토어 (GramJS 콜백 ↔ 폼 제출 연결)
    telegram/   클라이언트 수명주기, api_id 해석, 에러 정규화
    ui/ lib/ i18n/ config/
```

medifinder 와 다른 점은 두 가지뿐이고, 각 파일 주석에 이유를 적어 뒀다.

- 웹폰트를 쓰지 않는다 (CSP)
- i18n 에 URL 접두사를 쓰되 **기본 언어만 빼고** 붙인다 — 위 [다국어](#다국어) 참고

## 현재 상태

동작하는 범위:

- api_id 입력 (공용 / 직접 두 방식)
- api_id 발급 안내 + `ERROR` 만 뜰 때의 문제 해결 목록 (앱 화면 안에 내장)
- 전화번호 → 인증코드 → 2단계 인증 비밀번호 로그인
- 코드 오류·번호 오류 시 화면 이동 없이 재입력, "다른 번호로" 되감기
- FLOOD_WAIT 남은 시간 표시
- 대화방 목록 조회 (최대 200개) + 이름 검색, 프로필 사진
- **대화 보기** (`/dialogs/:id`) — 달력으로 날짜 점프, 양방향(이전/이후) 더 보기
- **내보내기** (`/dialogs/:id/export`) — 기간 지정 zip, 진행률 표시와 중단 지원
- **읽히는 HTML 문서**(`index.html`) — 대화 모양 그대로. 파일 하나로 완결되고 스크립트가 없다
- 한국어·영어 (주소 접두사로 나뉜다)
- 화면 하단과 내보낸 문서에 같은 버전 문자열 (`v0.1.0 · 커밋해시 · 빌드날짜`)
- 로그아웃 시 텔레그램 계정에서 세션 삭제

### 대화 보기와 내보내기를 나눈 이유

한 화면에 있을 때는 "기간"이 두 가지 뜻이었다 — 보고 싶은 지점과 내려받을 범위. 실제로는
전자는 **점 하나**(그 날로 이동)고 후자는 **구간**이다. 섞어 두니 어느 쪽을 조작하는지
헷갈렸다. 그래서 보기는 날짜 점프만, 내보내기는 구간만 다루도록 페이지를 갈랐다.

**달력에 메시지가 있는 날만 표시된다.** `messages.GetSearchResultsCalendar` 가 기간별 버킷
(`periods[]`: 날짜·개수·메시지 id 범위)을 한 번에 준다. 날짜마다 조회해 볼 필요가 없다.
메시지가 없는 날은 아예 못 누르게 한다 — 눌러도 빈 화면만 나오는 날짜를 고를 수 있으면
"이동이 안 되네"로 읽힌다. 이 API 를 거부하는 대화방도 있어서, 그런 경우 표시만 생략하고
날짜 이동 자체는 계속 되게 두었다.

**날짜로 점프하면 대화 중간에 선다.** 그래서 메시지 조회를 양방향 infinite query 로 바꿨다
(`fetchPreviousPage` = 이전, `fetchNextPage` = 이후). 방향 이름은 렌더링 순서(위가 과거)에
맞춰 두어서, `pages.flatMap(p => p.messages)` 하나로 시간순 목록이 나온다.

점프에 메시지 id 대신 **날짜(`offsetDate`)를 쓴다.** id 는 경계 포함 여부가 애매해서 그 날의
첫 메시지를 하나 빠뜨리기 쉽다.

### 프로필 사진 — 2단계로 받는다

**1단계(공짜):** 대화방 목록·메시지 응답의 엔티티에 `strippedThumb` 이 딸려 온다. 수백 바이트
짜리 초소형 JPEG 로, GramJS 의 `strippedPhotoToJpg` 로 복원해 바로 쓴다. 추가 요청이 없다.
다만 원본이 가로세로 수십 px 라 **확대하면 뿌옇다.**

**2단계(요청 있음):** `downloadProfilePhoto(peer, { isBig: false })` 로 선명한 판을 받는다.
이건 **대화방 하나당 요청 하나**라 200개를 한꺼번에 쏘면 FLOOD_WAIT 을 정면으로 맞는다.
그래서 IntersectionObserver 로 **화면에 보이는 것만**, 그마저도 동시 3개까지만 받는다
(`lib/profilePhoto.ts`). 실패하면 `null` 을 캐시에 굳혀 재시도를 막는다 — 안 그러면 스크롤할
때마다 실패하는 요청을 계속 쏜다.

메시지 목록에서는 2단계를 끈다. 같은 사람이 수백 번 반복될 뿐이라 요청을 쓸 값어치가 없다.

blur 필터는 쓰지 않는다. 저해상도 원본만으로도 충분히 부드럽고, 거기에 블러를 더하면 그냥
초점 안 맞은 사진이 된다.

### 내보내기 결과물

```
telegram-<대화방이름>-<날짜>.zip
├── index.html         압축을 푼 사람이 먼저 여는 것. 대화 모양 그대로 읽힌다
├── messages.jsonl     한 줄에 메시지 하나. 다시 기계로 읽기 위한 원본
├── messages.txt       사람이 읽는 형태. 오래된 것부터 시간순
├── attachments.jsonl  첨부의 종류·크기 기록
└── meta.json          대화방 정보, 메시지 수, 내보낸 시각
```

`index.html` 은 **파일 하나로 완결된다.** 스타일이 전부 안에 박혀 있어 인터넷 없이도,
이 도구 없이도 열린다. 스크립트가 없어서 열 때마다 같은 것을 보여준다 — 근거로 내미는
문서에 코드가 들어 있으면 "그때는 이렇게 나왔다"는 반박의 여지가 생긴다.

압축은 **fflate 의 동기 스트리밍 API**(`Zip` + `ZipDeflate`)로 한다. JSZip 이나 fflate 의
비동기 API 는 Web Worker 를 blob URL 로 띄우는데, 그러려면 CSP 에 `worker-src blob:` 을
열어야 해서 쓰지 않았다. 동기 API 라 메인 스레드를 잡는 대신, 메시지 200개마다 이벤트 루프에
제어를 넘겨 진행률 갱신과 중단 버튼이 살아 있게 한다.

### 긴 히스토리 대응

오래된 대화방을 통째로 내보내면 세 군데서 깨진다. 각각을 이렇게 막았다.

**1. 시작 전에 규모를 알려준다.** 요청 두 번이면 "총 몇 개, 언제부터 언제까지"가 나온다
(`useChatStatsQuery`).
- 전체 개수: `getMessages(limit: 1)` 응답의 `TotalList.total`
- 가장 오래된 메시지: `reverse: true` 면 GramJS 가 `offsetId = 1` 로 맨 앞부터 읽는다

**2. 기간을 나눠 받을 수 있다.** 시작·끝 날짜를 고르면 `offsetDate` 로 시작 지점을 잡고,
끝은 시간순으로 오는 메시지의 날짜를 보고 우리가 멈춘다(API 에 끝 경계 파라미터가 없다).

기본값은 **최근 30일**이다. 전체 기간을 기본으로 두면 몇 시간짜리 작업이 클릭 한 번에
시작돼 버린다. 대화 보기에서 날짜를 고르고 넘어왔다면(`?date=`) 그 날부터 30일로 잡는다 —
사용자가 이미 "여기가 궁금하다"고 표시한 지점이다.

**3. FLOOD_WAIT 으로 죽지 않는다.** 평소 `floodSleepThreshold` 는 60초인데, 그 값이면
텔레그램이 긴 히스토리를 훑을 때 거는 수백 초짜리 제한에서 GramJS 가 자는 대신 예외를
던진다 — 한 시간짜리 작업이 90초 대기 때문에 통째로 날아간다. 내보내는 동안만 15분으로
올리고 끝나면 되돌린다.

**4. 메모리에 다 쌓지 않는다.** File System Access API(`showSaveFilePicker`)가 있으면 압축된
청크를 **디스크로 바로 흘려보낸다.** 없으면(파이어폭스·사파리) 예전처럼 모았다가 Blob 으로
내려받고, 그 사실을 화면에 적어 둔다. picker 는 사용자 제스처를 요구하므로 **클릭 핸들러에서
가장 먼저** 부른다 — 내보내기가 시작된 뒤에 부르면 제스처가 소진돼 거절당한다.

**5. "멈춘 것처럼 보이는" 문제.** FLOOD_WAIT 대기 중에는 GramJS 가 조용히 자기 때문에 숫자가
안 움직인다. 8초 넘게 진행이 없으면 "제한으로 대기 중, 멈춘 게 아니다"를 띄운다. 이게 없으면
사용자가 정상 동작을 고장으로 오해하고 탭을 닫는다.

메시지는 `reverse: true` 로 **오래된 것부터** 훑는다. 텔레그램 기본은 최신순인데 그대로 쓰면
파일이 역순으로 쌓여 읽을 수가 없고, 메모리에 모아 뒤집으면 스트리밍하는 의미가 없어진다.
요청 사이에 `waitTime: 1` 로 1초를 둔다 — 없으면 큰 대화방에서 FLOOD_WAIT 을 거의 확실히 밟는다.

`a[download]` + blob URL 다운로드가 `default-src 'none'` 에서도 막히지 않는 것은
프로덕션 빌드를 `vite preview` 로 띄우고 `securitypolicyviolation` 이벤트를 잡아 확인했다
(위반 0건). 다운로드는 CSP 의 fetch 지시자 대상이 아니다.

아직 없는 것:

- **미디어 다운로드** — `upload.getFile` 청크 조립. 지금은 첨부의 *종류*만 기록한다
- **대용량 스트리밍 저장** — 지금은 zip 전체를 Blob 으로 만들어 한 번에 내려받는다.
  아주 큰 대화방에서는 File System Access API(`showSaveFilePicker`)로 디스크에 흘려 쓰는
  방식이 필요하다. Chrome/Edge 전용이라 Firefox/Safari 는 현재 방식이 폴백이 된다
- **중단 지점 재개** — `offset_id` 를 IndexedDB 에 남기면 끊겨도 이어받을 수 있다
- **QR 로그인** — GramJS 의 `signInUserWithQrCode`. 사용자가 폰의 텔레그램 앱으로 스캔하므로
  **로그인 코드를 이 사이트에 입력할 필요가 없어진다.** 위 "신뢰 모델" 문제를 가장 크게
  줄이는 방법이라 우선순위가 높다.

## 검증되지 않은 부분

빌드·타입체크·헤드리스 렌더링까지는 확인했다. **실제 텔레그램 계정으로 로그인해서 대화방
목록을 받아오는 것까지는 아직 돌려보지 않았다** — 실제 api_id 와 전화번호가 필요하기 때문이다.
`pnpm dev` 로 직접 확인이 필요하다.
