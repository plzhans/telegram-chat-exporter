Telegram Exporter — 내려받아 실행하는 배포본
============================================

실행 방법
---------
index.html 을 더블클릭한다. 끝이다. 웹서버도, 설치도, 실행 권한 설정도 필요 없다.

같이 들어 있는 assets/ 폴더는 index.html 이 읽는다. 폴더째 옮기는 건 괜찮지만
index.html 만 따로 빼내면 화면이 뜨지 않는다.

무엇이 필요한가
---------------
- 최신 브라우저(크롬, 엣지, 파이어폭스, 사파리)
- 인터넷 연결. 텔레그램에 직접 붙어서 대화를 받아오기 때문이다.

무엇이 어디로 가는가
--------------------
전화번호, 로그인 코드, 대화 내용은 텔레그램 외의 어디로도 나가지 않는다. 이 배포본에는
그것을 브라우저가 강제하도록 CSP 가 들어 있다 — 개발자도구(F12)의 Network 탭을 열어
직접 확인할 수 있다. 애널리틱스와 광고는 들어 있지 않다.

내려받은 대화는 zip 파일로 저장된다. 그 안의 index.html 은 인터넷 없이도 열린다.

소스와 최신 버전
----------------
https://github.com/plzhans/telegram-chat-exporter


Telegram Exporter — standalone build
====================================

How to run
----------
Double-click index.html. That is all — no web server, no installation.

The assets/ folder next to it is required. Move the whole folder if you like, but
index.html alone will not run.

Requirements
------------
- A recent browser (Chrome, Edge, Firefox, Safari)
- An internet connection, since the app talks to Telegram directly.

Where your data goes
--------------------
Your phone number, login code and messages never leave your browser except toward
Telegram itself. This build ships with a Content Security Policy that makes the
browser enforce it — open DevTools (F12) → Network and check for yourself. No
analytics, no ads are included.

Exported chats are saved as a zip file. The index.html inside it opens offline.

Source and latest version
-------------------------
https://github.com/plzhans/telegram-chat-exporter
