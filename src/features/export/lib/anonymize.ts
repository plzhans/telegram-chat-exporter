/**
 * 내보내기에서 참여자 신원을 가린다.
 *
 * 요구는 하나다 - 제3자에게 대화를 내밀 때 **누가 누구인지 드러나지 않아야** 한다. 그래서
 * 발신자 셋을 한 번에 갈아 끼운다.
 *
 * - 이름  → `A`, `B`, `C` … (26 명을 넘으면 `AA`, `AB` …)
 * - 회원번호(id) → `1`, `2`, `3` …
 * - 프로필 사진 → 뗀다. HTML 아바타는 사진이 없으면 이름 첫 글자를 그리므로, 자연히
 *   `A`·`B` 가 동그라미 안에 남아 가독성이 좋다(`htmlReport` 참고).
 *
 * **원본 발신자 하나가 언제나 같은 라벨을 받는다.** 처음 본 사람을 map 에 등록하며 번호를
 * 발급하고, 다음부터는 그 번호를 돌려준다. 그래서 같은 사람의 말풍선은 문서 전체에서 같은
 * `A` 로 묶이고, 아바타 색도 그대로 유지된다.
 *
 * 이미지·이모티콘·스티커 같은 **내용은 건드리지 않는다.** 여기서 가리는 것은 신원뿐이다.
 *
 * ## 왜 파일을 쓰기 직전 한 곳에서 하나
 *
 * JSONL·TXT·HTML·첨부 인덱스가 모두 같은 `MessageSummary` 에서 갈라져 나온다
 * (`exportChat` 의 쓰기 지점). 그 직전에 요약 하나를 갈아 끼우면 네 포맷이 전부 따라온다 -
 * 포맷마다 따로 가리면 한 곳을 빠뜨렸을 때 조용히 실명이 샌다.
 */

import type { MessageSummary } from '@/features/dialogs/api';

/** 익명화된 문서에서 대화방을 가리키는 이름·id. 실제 제목·id 자리를 대신한다. */
const PLACEHOLDER_TITLE = 'Chat';
const PLACEHOLDER_ID = 'chat';

/** 내보내기가 다루는 대화방 신원. `exportChat` 이 제목·id·아이콘을 이 모양으로 넘긴다. */
export interface DialogIdentity {
  title: string;
  id: string;
  /** 대화방 아이콘(data URL). 익명화하면 뗀다. */
  photo?: string;
}

export interface Anonymizer {
  /** 켜졌는지. 파일명·요약 표시처럼 밖에서 분기할 자리가 있어 노출한다. */
  readonly enabled: boolean;
  /** 발신자 신원(id·이름·사진)을 가린 사본을 준다. 나머지 필드는 그대로다. */
  message(summary: MessageSummary): MessageSummary;
  /** 대화방 제목·id·아이콘을 가린다. */
  dialog(identity: DialogIdentity): DialogIdentity;
  /** meta.json 의 "받은 계정". 익명화하면 통째로 지운다. */
  account<T>(account: T | undefined): T | undefined;
}

/**
 * 1→A, 26→Z, 27→AA, 28→AB … 스프레드시트 열 이름과 같은 규칙.
 *
 * 26 진법이지만 0 이 없는 **양방향(bijective)** 이라, `A0` 같은 빈자리 없이 A·B·… 로만
 * 채워진다.
 */
function letterLabel(n: number): string {
  let label = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/**
 * 익명화기를 만든다.
 *
 * 꺼져 있으면 모든 메서드가 받은 값을 그대로 돌려준다 - 부르는 쪽은 켜짐 여부를 몰라도
 * 되고, 코드 경로가 하나로 유지된다.
 */
export function createAnonymizer(enabled: boolean): Anonymizer {
  if (!enabled) {
    return {
      enabled: false,
      message: (summary) => summary,
      dialog: (identity) => identity,
      account: (account) => account,
    };
  }

  /**
   * 원본 발신자 키 → 발급된 순번(1 부터).
   *
   * 신규 키면 등록하며 `map 크기 + 1` 을 준다. 그래서 문서에 처음 등장한 순서대로 A, B, C
   * 가 매겨진다 - 시간순으로 훑으므로 곧 대화에 나타난 순서다.
   */
  const issued = new Map<string, number>();

  const labelFor = (key: string): { id: string; name: string } => {
    let seq = issued.get(key);
    if (seq === undefined) {
      seq = issued.size + 1;
      issued.set(key, seq);
    }
    return { id: String(seq), name: letterLabel(seq) };
  };

  return {
    enabled: true,

    message(summary) {
      /*
        같은 사람을 한 라벨로 묶는 열쇠. id 가 가장 믿을 만하고, 없으면 이름으로 대신한다.
        내 메시지도 내 id 로 자연히 한 라벨에 묶인다 - 따로 처리하지 않는다.
      */
      const key =
        summary.senderId ?? (summary.senderName ? `name:${summary.senderName}` : null);

      // 행위자가 없는 시스템 메시지 등. 가릴 신원이 없으니 사진만 확실히 뗀다.
      if (key === null) {
        return summary.senderPhoto ? { ...summary, senderPhoto: undefined } : summary;
      }

      const { id, name } = labelFor(key);
      return { ...summary, senderId: id, senderName: name, senderPhoto: undefined };
    },

    dialog() {
      return { title: PLACEHOLDER_TITLE, id: PLACEHOLDER_ID };
    },

    account() {
      return undefined;
    },
  };
}
