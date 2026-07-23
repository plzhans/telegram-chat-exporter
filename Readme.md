# telegram-chat-exporter

브라우저에서만 동작하는 텔레그램 대화 백업 도구. 백엔드가 없고, 정적 사이트로 배포되며,
사용자 인증 정보를 어디에도 보관하지 않는다.

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

2. **외부 리소스가 하나도 없다.** CDN·웹폰트·애널리틱스를 전부 쓰지 않는다. 하나라도 있으면
   위 CSP 가 느슨해져서 약속이 깨진다. (medifinder-web 이 쓰는 Google Fonts 를 여기서만
   빼고 시스템 폰트를 쓰는 이유다.)

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
   Cloudflare Pages 의 환경변수에만 넣는다. 번들에는 남지만 소스 유통 경로는 막힌다.
   난독화와 달리 이건 실제 방어다.
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
    dialogs/    대화방 목록
  shared/
    auth/       zustand 인증 스토어 (GramJS 콜백 ↔ 폼 제출 연결)
    telegram/   클라이언트 수명주기, api_id 해석, 에러 정규화
    ui/ lib/ i18n/ config/
```

medifinder 와 다른 점은 두 가지뿐이고, 각 파일 주석에 이유를 적어 뒀다.

- 웹폰트를 쓰지 않는다 (CSP)
- i18n 에 URL 접두사를 쓰지 않는다 (색인할 콘텐츠가 없다)

## 실행

```bash
pnpm install
cp .env.example .env.local   # 공용 api_id 를 쓸 거라면 값을 채운다. 비워도 동작한다.
pnpm dev                     # http://localhost:5175
pnpm build                   # tsc -b && vite build → dist/
```

Node 24.18.0 (`.nvmrc`), pnpm 전용(`only-allow pnpm`).

## 배포

정적 호스팅이면 어디든 되지만 **Cloudflare Pages 를 권한다.** `public/_headers` 로 진짜 HTTP
응답 헤더 CSP 를 걸 수 있기 때문이다. GitHub Pages 는 커스텀 헤더를 지원하지 않아
`index.html` 의 `<meta>` CSP 만 적용되고, 그건 파싱 시작 후에 걸리며 `frame-ancestors` 를
지원하지 않는다.

빌드 결과물 `dist/` 를 그대로 올리면 된다. `public/_redirects` 가 SPA 폴백을 처리한다.

공용 api_id 를 쓴다면 `VITE_TELEGRAM_API_ID` / `VITE_TELEGRAM_API_HASH` 를
**호스팅의 환경변수 설정에만** 넣는다. `.env.local` 을 저장소에 커밋하지 않는다 —
위 "공용 키 운영" 참고.

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
├── messages.jsonl   한 줄에 메시지 하나. 다시 기계로 읽기 위한 원본
├── messages.txt     사람이 읽는 형태. 오래된 것부터 시간순
└── meta.json        대화방 정보, 메시지 수, 내보낸 시각
```

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
