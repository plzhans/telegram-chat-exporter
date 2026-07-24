/**
 * 커밋 메시지 규약 검사(Conventional Commits).
 *
 * `.husky/commit-msg` 가 커밋할 때마다 이 규칙으로 검사한다. 규약을 문서에만 적어 두면
 * 곧 어긋나므로, 어기면 커밋이 아예 안 되게 한다.
 *
 * 규약 설명은 DEVELOP.md 의 "커밋 규약" 참고.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    /**
     * 쓸 수 있는 타입.
     *
     * 기본 목록에서 `style` 을 뺐다 - 이 저장소는 포매터를 쓰지 않아서 "서식만 고침" 이
     * 성립하는 자리가 없고, 있으면 `refactor` 와 헷갈린다.
     */
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],

    /**
     * 제목 대소문자 검사를 끈다.
     *
     * 기본값은 영어 문장을 가정하고 소문자로 시작하길 요구하는데, 이 저장소의 제목은
     * 한국어라 대소문자라는 것이 없다. 켜 두면 모든 커밋이 걸린다.
     */
    'subject-case': [0],

    // 본문이 한국어라 한 줄에 담기는 정보량이 영어와 다르다. 조금 넉넉하게 둔다.
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 120],
  },
};
