# Security Policy

This tool asks people for their phone number and their Telegram login code. That makes security
reports especially welcome — please send them.

## Reporting a vulnerability

**Use [private vulnerability reporting](https://github.com/plzhans/telegram-chat-exporter/security/advisories/new).**
It is enabled on this repository, so the report stays between us until a fix is out.

Please do not open a public issue for anything that could put someone's account or messages at
risk.

Include what you can: what you did, what happened, and why it matters. A rough note is better
than no report.

## What is in scope

The whole point of this project is that your messages never leave your machine. Anything that
breaks that promise is in scope:

- A way to make the app send phone numbers, login codes or message content anywhere other than
  Telegram — that is, a way around the Content Security Policy.
- Script execution in an **exported** `index.html` (message text is written into that document,
  so an escaping mistake there runs code on whoever opens the file).
- Anything stored where the README says nothing is stored.
- Build or release tampering: a way to make the deployed site differ from this source.
- Anything that misleads a user into handing their login code to someone else.

## What is out of scope

- Telegram itself, and the safety of your Telegram account.
- The machine you run this on. If your browser or computer is compromised, nothing here can help.
- The hosted site connecting to Google Analytics. That is deliberate and documented in the
  [README](README.md) — the downloadable build contains none of it.
- Reports from automated scanners with no explanation of actual impact.

## Supported versions

The [latest release](https://github.com/plzhans/telegram-chat-exporter/releases/latest) is the
only supported one. Fixes go into a new release rather than being backported.

## How this project is checked

- **CodeQL** scans every push for vulnerable code patterns.
- **Secret scanning with push protection** blocks credentials from ever entering the repository.
- **Dependabot** watches dependencies and opens pull requests for known vulnerabilities.
- Releases fail if a dependency has a known high-severity vulnerability (`pnpm audit`).
- Release tags cannot be moved or deleted, so a version you verified stays that version.

None of this is a substitute for reading the code, and the README tells you how to do that.

---

## 한국어 요약

취약점을 발견하셨다면 **[비공개 신고](https://github.com/plzhans/telegram-chat-exporter/security/advisories/new)**
를 이용해 주세요. 계정이나 대화 내용이 위험해질 수 있는 내용은 공개 이슈로 올리지 말아
주시기 바랍니다.

특히 다음은 중요하게 다룹니다 — 텔레그램 외의 주소로 데이터가 나갈 수 있는 경로(CSP 우회),
내보낸 `index.html` 에서 스크립트가 실행되는 경우, README 가 "저장하지 않는다"고 적은 것이
저장되는 경우, 그리고 배포본이 이 소스와 달라질 수 있는 경로입니다.

텔레그램 자체의 문제, 사용자 기기가 이미 감염된 경우, 그리고 문서에 밝혀 둔 애널리틱스
연결은 대상이 아닙니다.
