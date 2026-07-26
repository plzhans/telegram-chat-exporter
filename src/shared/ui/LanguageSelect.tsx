import { useTranslation } from 'react-i18next';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { countryFlag } from '@/shared/lib/phone';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  nativeNameOf,
  switchLanguage,
  type SupportedLanguage,
} from '@/shared/i18n';

/**
 * 언어 이름을 `언어 (지역)` 형태로, **그 언어 자신의 말로** 적는다.
 * `한국어 (대한민국)`, `English (United States)`, `қазақ тілі (Қазақстан)`.
 *
 * 지금 화면의 언어로 번역하면 안 된다. 한국어 화면에서 목록이 전부 한국어로 나오면,
 * 한국어를 못 읽는 사람은 자기 언어가 어느 줄인지 찾을 수가 없다.
 *
 * **브라우저가 그 언어를 모르면 로케일 파일이 밝힌 이름을 쓴다.** `Intl.DisplayNames` 는
 * 데이터가 없을 때 오류를 내지 않고 조용히 기본 로케일로 떨어진다 - 카자흐어를 물었는데
 * 한국어로 "카자흐어" 라고 답하는 식이다. 그래서 답만 보고는 맞는지 알 수 없고,
 * `resolvedOptions().locale` 로 **실제로 그 언어로 답했는지** 확인해야 한다.
 */
function languageLabel(lang: SupportedLanguage): string {
  // 한국어는 `한국어(대한민국)` 처럼 붙여 내주고 영어는 이미 띄운다. 한 칸으로 맞춘다.
  // 전각 괄호를 쓰는 언어(`中文（中國）`)는 건드리지 않는다 - 그쪽은 붙이는 게 맞다.
  const spaced = (v: string) => v.replace(/\s*\(/, ' (');
  const base = (v: string) => v.toLowerCase().split('-')[0];
  try {
    const names = new Intl.DisplayNames([lang], { type: 'language', languageDisplay: 'standard' });
    if (base(names.resolvedOptions().locale) === base(lang)) {
      const value = names.of(lang);
      if (value) return spaced(value);
    }
  } catch {
    // Intl.DisplayNames 자체가 없는 아주 오래된 브라우저.
  }
  return nativeNameOf(lang);
}

/**
 * 헤더의 언어 선택 드롭다운. 앱(MainLayout)과 방식 고르기 화면(MethodScreen)이 함께 쓴다.
 *
 * 언어가 늘어도 헤더 폭을 더 먹지 않도록 나열 대신 셀렉트로 둔다.
 */
export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? DEFAULT_LANGUAGE) as SupportedLanguage;

  // 글자만 바꾸면 주소와 문서의 신원이 이전 언어로 남는다. 문서를 다시 연다.
  const switchTo = (next: string) => {
    if (next === current) return;
    switchLanguage(next as SupportedLanguage);
  };

  return (
    <Select.Root value={current} onValueChange={switchTo}>
      <Select.Trigger
        aria-label={t('common.language')}
        title={t('common.language')}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      >
        <span aria-hidden className="text-base leading-none">
          {countryFlag(current.split('-')[1] ?? '')}
        </span>
        {/* 좁은 화면에서는 아이콘만 남긴다. 헤더에는 제목과 소스 버튼이 이미 있다. */}
        <span className="hidden sm:inline">
          <Select.Value />
        </span>
        <Select.Icon>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          align="end"
          className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {/*
            언어가 열 몇 개가 되면서 목록이 화면보다 길어질 수 있다. Radix 가 알려주는
            "이 위치에서 쓸 수 있는 높이"까지만 쓰고 그 안에서 스크롤시킨다 — 없으면 목록이
            화면 밖으로 나가서 아래쪽 언어를 고를 방법이 없어진다.
          */}
          <Select.Viewport className="max-h-[--radix-select-content-available-height] overflow-y-auto p-1">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Select.Item
                key={lang}
                value={lang}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 data-[state=checked]:font-bold data-[state=checked]:text-slate-900"
              >
                {/* 자리를 잡아 두지 않으면 고를 때마다 글자가 좌우로 밀린다. */}
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <Select.ItemIndicator>
                    <Check className="h-4 w-4 text-primary" />
                  </Select.ItemIndicator>
                </span>
                {/*
                  국기는 이름보다 먼저 눈에 들어온다. 자기 언어를 못 읽는 글자로 찾는
                  사람에게는 이게 유일한 단서일 수 있다.

                  `aria-hidden` 인 이유는 화면 낭독기가 "대한민국 국기 한국어" 처럼 두 번
                  읽지 않게 하려는 것이다. 바로 뒤에 이름이 있으므로 정보가 빠지지 않는다.
                */}
                <span aria-hidden className="shrink-0 text-base leading-none">
                  {countryFlag(lang.split('-')[1] ?? '')}
                </span>
                <Select.ItemText>{languageLabel(lang)}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
