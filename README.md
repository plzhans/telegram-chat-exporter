# Telegram Chat Exporter

[![Open the app](https://img.shields.io/badge/Telegram-ChatExporter-26A5E4?logo=telegram&logoColor=white)](https://telegram-exporter.plzhans.com)
[![Release](https://img.shields.io/github/v/release/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/releases)
[![Downloads](https://img.shields.io/github/downloads/plzhans/telegram-chat-exporter/latest/total)](https://github.com/plzhans/telegram-chat-exporter/releases/latest)

**Save your whole Telegram history to your own computer.**

It runs right in your browser. Nothing to install, no account to create. Your phone number and
your messages never pass through a server of ours — because there is no such server to pass
through.

### ▶ [Open the app](https://telegram-exporter.plzhans.com/)

한국어 안내: [README.ko.md](README.ko.md)

---

## What it looks like

|  |  |  |
| :---: | :---: | :---: |
| <img src="public/landing/shot-03.png" width="230" alt="Choosing how to start" /> | <img src="public/landing/shot-06.png" width="230" alt="Entering the login code" /> | <img src="public/landing/shot-08.png" width="230" alt="Reading a chat with stickers" /> |
| <img src="public/landing/shot-09.png" width="230" alt="Reading a chat, jumping to a date" /> | <img src="public/landing/shot-11.png" width="230" alt="Choosing what to export" /> | <img src="public/landing/shot-12.png" width="230" alt="Export in progress" /> |

## What you get

A zip file you can open without this tool, without the internet, and years from now.

| File | What it is |
| --- | --- |
| `index.html` | Reads like the conversation itself. Open this one first. |
| `messages.jsonl` | One message per line. The raw form, for machines to read again. |
| `messages.txt` | Human-readable, oldest first. |
| `meta.json` | Chat info, message count, export timestamp. |

Photos and stickers can be included. You can also **anonymize participants** — names become
A, B, C and IDs become 1, 2, 3, so you can hand the file to someone else.

## Two ways to use it

**1. Open the site** — [telegram-exporter.plzhans.com](https://telegram-exporter.plzhans.com/)

**2. Download and run it yourself** —
[grab the zip](https://github.com/plzhans/telegram-chat-exporter/releases/latest/download/telegram-exporter.zip),
unpack it, and open `index.html`. No web server, no installation. It still needs internet access
to reach Telegram.

## Don't trust it — check it

This tool asks for your phone number and your Telegram login code. Telegram tells you never to
share that code with anyone, and **that advice is right**. Be just as suspicious of this site.

So instead of asking for trust, here is how to verify:

- **The browser blocks it from talking to anyone else.** The page ships a Content Security
  Policy that allows exactly one network destination — Telegram:

  ```
  connect-src wss://*.web.telegram.org wss://*.web.telegram.org:443
  ```

  Even if this code were malicious, it could not send your messages anywhere. The author cannot
  break that rule either.

- **See it yourself.** Press <kbd>F12</kbd> (<kbd>⌥⌘I</kbd> on a Mac) and open the Network tab.
  Every address the page actually contacts is listed there.

- **Read the code.** It is all in this repository.

- **Check that the download really came from this code.** Every release is signed with a build
  provenance attestation, so you can confirm the zip was built by this repository's workflow from
  a specific commit — not swapped out somewhere along the way:

  ```
  gh attestation verify telegram-exporter.zip --repo plzhans/telegram-chat-exporter
  ```

- **Or don't use our copy at all.** Download the release above and run it from your own machine.
  That build contains no analytics at all — not a visitor counter, nothing.

> The hosted site does use Google Analytics to count visits. That means it connects to Google as
> well as Telegram, and the policy above shows it. Your conversations, phone number and login
> code are never part of that. The downloaded copy has none of it.

## What stays in your browser

| What | Where | Until when |
| --- | --- | --- |
| Signed-in state | This tab only, and only if you tick "stay signed in" | You close the tab · 60 minutes idle · you sign out |
| Sticker images | This browser | You sign out · oldest first past 20MB |

**Never kept:** conversations, photos, attachments, phone number, contacts, login code.

## Languages

15 languages. The address decides which one you see — `/en-us/`, `/ja-jp/`, and so on.

## Something's wrong?

Open an [issue](https://github.com/plzhans/telegram-chat-exporter/issues).

## License

[AGPL-3.0](LICENSE). Free to use, including at work — the licence only asks something of you if
you modify it and offer it to others over a network. A
[commercial licence](COMMERCIAL-LICENSE.md) is available if you need to do that without
publishing your changes.

## For developers

Build, deploy, architecture and the reasoning behind it: **[DEVELOP.md](DEVELOP.md)**
([한국어](DEVELOP.ko.md))
