import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['ko', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ko';

/**
 * **여기는 medifinder-web 과 다르게 URL 접두사를 쓰지 않는다.**
 *
 * medifinder 는 `/en-us/...` 처럼 경로로 언어를 고정한다. 검색엔진이 긁는 콘텐츠 사이트라
 * "같은 URL = 같은 내용"이 지켜져야 하기 때문이다.
 *
 * 이 도구에는 색인할 콘텐츠가 없다. 화면은 전부 로그인 뒤에만 의미가 있고, 공유되는 링크도
 * 첫 화면 하나뿐이다. 그래서 URL 을 언어로 쪼개는 대신 브라우저 언어를 그대로 따른다 —
 * 처음 온 사람이 자기 언어로 바로 읽는 게 이 앱에서는 더 중요하다.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    // `en-US` 같은 지역 서브태그를 `en` 으로 접어서 리소스 키와 맞춘다.
    load: 'languageOnly',
    lowerCaseLng: true,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'telegram-chat-exporter:lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
