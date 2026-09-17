#!/usr/bin/env node
/*
  랜딩 스크린샷 PNG 를 WebP 로 다시 만드는 MCP 서버다.

  왜 있나. `landing/src/sections/Screenshots.tsx` 는 `<picture>` 로 WebP 를 먼저 걸고 PNG 는
  폴백으로만 남긴다. 그래서 PNG 만 고치면 사실상 모든 브라우저가 옛 그림을 계속 본다 -
  고친 사람 화면에서도 그대로라 눈치채기 어렵다. 짝을 자동으로 맞춰 그 실수를 없앤다.

  인코딩 설정(q=82, m=6)은 기존 36장에서 역산한 값이다. 이 값으로 다시 누르면 저장소에 있던
  파일과 바이트 단위로 같은 결과가 나온다 - 그래서 아래 '같은지' 판정을 mtime 이 아니라 내용
  비교로 한다. mtime 은 git checkout 한 번에 전부 갱신돼 믿을 수 없다.

  MCP SDK 를 쓰지 않는다. 의존성을 하나 들이면 `mcp/` 가 루트·landing 에 이은 세 번째 독립
  pnpm 프로젝트가 되는데, 프로토콜은 줄 단위 JSON-RPC 라 직접 받는 편이 싸다.

  두 가지로 쓴다.
    - MCP 서버:  node mcp/landing-webp/server.mjs         (.mcp.json 이 이렇게 띄운다)
    - 손으로:    node mcp/landing-webp/server.mjs --sync  (= make landing-webp)
                 node mcp/landing-webp/server.mjs --check (고칠 게 있으면 exit 1)
*/

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/*
  저장소의 WebP 를 만든 설정이다. 바꾸면 36장이 전부 다시 써지니, 바꿀 때는 한 번에 전부
  다시 만들고 커밋해서 파일과 이 값이 어긋나 있지 않게 둔다.
*/
const QUALITY = 82;
const METHOD = 6;

/*
  바이트 동일성은 libwebp 버전에도 달려 있다. 버전이 다르면 내용이 안 바뀐 그림까지 전부
  '고칠 것'으로 잡히는데, 그 자체는 문제가 아니고(같은 설정이니 품질은 그대로다) 왜 36장이
  한꺼번에 바뀌었는지 몰라 당황하는 게 문제라 결과에 버전을 적어 둔다.
*/
const KNOWN_LIBWEBP = '1.6.0';

// 랜딩이 실제로 쓰는 스크린샷 폴더. 언어판이 늘어 폴더가 생기면 여기 추가한다.
const SHOT_DIRS = ['landing/public', 'landing/public/en'];

const SHOT_RE = /^shot-\d+\.png$/;

function cwebpVersion() {
  const r = spawnSync('cwebp', ['-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new Error('cwebp 를 찾지 못했다. `brew install webp` 로 설치한다.');
  }
  return r.stdout.trim().split('\n')[0].trim();
}

function encode(pngAbs, outAbs) {
  const r = spawnSync(
    'cwebp',
    ['-quiet', '-q', String(QUALITY), '-m', String(METHOD), pngAbs, '-o', outAbs],
    { encoding: 'utf8' },
  );
  if (r.error) throw new Error(`cwebp 실행 실패: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`cwebp 가 ${pngAbs} 에서 실패했다: ${r.stderr.trim()}`);
}

/*
  대상 PNG 목록. 인자가 없으면 스크린샷 폴더를 훑는다. 인자를 주면 저장소 안인지 확인한다 -
  MCP 로 열려 있는 입구라 바깥 경로를 그대로 받으면 안 된다.
*/
function targets(files) {
  if (files && files.length > 0) {
    return files.map((f) => {
      const abs = path.resolve(ROOT, f);
      const rel = path.relative(ROOT, abs);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`저장소 밖 경로다: ${f}`);
      }
      if (!abs.endsWith('.png')) throw new Error(`PNG 가 아니다: ${f}`);
      if (!existsSync(abs)) throw new Error(`없는 파일이다: ${f}`);
      return rel;
    });
  }
  return SHOT_DIRS.flatMap((dir) => {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs)
      .filter((name) => SHOT_RE.test(name))
      .sort()
      .map((name) => path.join(dir, name));
  });
}

function sync({ files, dryRun = false } = {}) {
  const version = cwebpVersion();
  const pngs = targets(files);
  const written = [];
  const stale = [];
  const missing = [];
  let ok = 0;

  for (const rel of pngs) {
    const pngAbs = path.join(ROOT, rel);
    const webpRel = rel.replace(/\.png$/, '.webp');
    const webpAbs = path.join(ROOT, webpRel);
    // 임시 파일을 같은 폴더에 둔다. tmpdir 은 다른 파일시스템일 수 있어 rename 이 안 된다.
    const tmpAbs = `${webpAbs}.tmp`;

    try {
      encode(pngAbs, tmpAbs);
      const fresh = readFileSync(tmpAbs);
      const had = existsSync(webpAbs);
      if (had && fresh.equals(readFileSync(webpAbs))) {
        ok += 1;
        continue;
      }
      (had ? stale : missing).push(webpRel);
      if (!dryRun) {
        copyFileSync(tmpAbs, webpAbs);
        written.push({ path: webpRel, bytes: fresh.length, png: statSync(pngAbs).size });
      }
    } finally {
      rmSync(tmpAbs, { force: true });
    }
  }

  return { version, count: pngs.length, ok, stale, missing, written, dryRun };
}

function report(r) {
  const lines = [];
  const needs = r.stale.length + r.missing.length;

  if (needs === 0) {
    lines.push(`WebP ${r.count}장이 모두 PNG 와 맞는다. 할 일 없음.`);
  } else if (r.dryRun) {
    lines.push(`${r.count}장 중 ${needs}장이 PNG 와 어긋난다 (dryRun - 파일은 안 건드렸다).`);
    for (const p of r.missing) lines.push(`  없음  ${p}`);
    for (const p of r.stale) lines.push(`  옛것  ${p}`);
  } else {
    lines.push(`${r.count}장 중 ${r.written.length}장을 다시 만들었다 (q=${QUALITY}, m=${METHOD}).`);
    for (const w of r.written) {
      lines.push(`  ${w.path}  ${w.bytes.toLocaleString()}B  (PNG ${w.png.toLocaleString()}B)`);
    }
  }

  lines.push(`인코더: ${r.version}`);
  if (!r.version.includes(KNOWN_LIBWEBP) && needs > 0) {
    lines.push(
      `참고: 저장소의 WebP 는 libwebp ${KNOWN_LIBWEBP} 로 만들었다. 버전이 달라서 내용이` +
        ` 그대로인 그림까지 다시 만들어졌을 수 있다 - 설정은 같으니 품질은 그대로다.`,
    );
  }
  return lines.join('\n');
}

/* ---------------------------------------------------------------- MCP 계층 */

const TOOL = {
  name: 'sync_webp',
  description:
    '랜딩 스크린샷 PNG 를 저장소 설정(cwebp -q 82 -m 6)으로 WebP 로 다시 만든다. ' +
    'landing/public 과 landing/public/en 의 shot-*.png 가 대상이고, 내용이 이미 같은 파일은 ' +
    '건드리지 않는다. landing/public 아래 PNG 를 고쳤다면 반드시 이걸 돌린다 - 화면은 ' +
    'WebP 를 먼저 쓰므로 PNG 만 고치면 바뀐 그림이 안 보인다.',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        description: '특정 PNG 만 처리한다(저장소 기준 상대경로). 생략하면 전부 훑는다.',
      },
      dryRun: {
        type: 'boolean',
        description: '어긋난 파일 목록만 알려 주고 아무것도 쓰지 않는다.',
      },
    },
    additionalProperties: false,
  },
};

const SERVER_INFO = { name: 'landing-webp', version: '1.0.0' };
const FALLBACK_PROTOCOL = '2025-06-18';

function handle(msg) {
  switch (msg.method) {
    case 'initialize':
      return {
        // 클라이언트가 말한 버전을 그대로 돌려준다. 우리가 쓰는 건 셋 다 같은 모양이다.
        protocolVersion: msg.params?.protocolVersion ?? FALLBACK_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: [TOOL] };
    case 'tools/call': {
      if (msg.params?.name !== TOOL.name) {
        throw new Error(`모르는 도구다: ${msg.params?.name}`);
      }
      return { content: [{ type: 'text', text: report(sync(msg.params.arguments ?? {})) }] };
    }
    default:
      return null; // 처리할 수 없는 메서드
  }
}

function serve() {
  const send = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

  createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // 우리가 응답할 id 조차 모르니 조용히 버린다
    }

    // 알림(id 없음)에는 답하지 않는다 - notifications/initialized 가 여기로 온다.
    if (msg.id === undefined || msg.id === null) return;

    try {
      const result = handle(msg);
      if (result === null) {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
        return;
      }
      send({ jsonrpc: '2.0', id: msg.id, result });
    } catch (err) {
      /*
        도구가 실패한 것은 프로토콜 오류가 아니라 '결과'다. isError 로 돌려줘야 모델이
        메시지를 읽고 스스로 고칠 수 있다 - JSON-RPC error 로 던지면 그러지 못한다.
      */
      if (msg.method === 'tools/call') {
        send({
          jsonrpc: '2.0',
          id: msg.id,
          result: { content: [{ type: 'text', text: String(err.message ?? err) }], isError: true },
        });
      } else {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String(err.message ?? err) } });
      }
    }
  });
}

/* ------------------------------------------------------------------- 진입점 */

const arg = process.argv[2];
if (arg === '--sync' || arg === '--check') {
  const r = sync({ dryRun: arg === '--check' });
  console.log(report(r));
  // --check 는 CI·훅에서 쓰라고 어긋나면 실패로 끝낸다.
  process.exit(arg === '--check' && r.stale.length + r.missing.length > 0 ? 1 : 0);
} else if (arg) {
  console.error('쓰는 법: server.mjs [--sync|--check]   (인자 없이 실행하면 MCP 서버)');
  process.exit(2);
} else {
  serve();
}
