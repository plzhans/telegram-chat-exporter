import type { Config } from 'tailwindcss';

const config: Config = {
  /*
    빌드 때만 쓰이는 코드라도 **클래스를 적는 곳이면 여기 들어와야 한다.** 빠뜨리면
    조용히 깨진다 - 빌드는 통과하고, 그 파일이 쓰는 클래스 중 다른 데서 우연히 같이 쓰인
    것만 살아남는다. 실제로 랜딩이 `src/` 밖(`build/landing.ts`)에 있던 동안 모든 섹션의
    상하 여백(`py-12 sm:py-16`)과 데스크톱 가로 배치(`sm:flex-row`)가 빠져 있었다.

    랜딩(`src/landing/`)을 `src/` 안으로 들여온 이유가 이것이다 - 아래 한 줄이 이미
    덮고 있어서 같은 실수가 날 자리가 없다.
  */
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
      },
      /**
       * **웹폰트를 쓰지 않는다.** medifinder-web 은 Google Fonts 에서 Noto Sans KR 을 받아오지만,
       * 여기서는 CSP 를 `default-src 'none'` + `connect-src wss://*.web.telegram.org` 로 조이는 게
       * 이 앱의 신뢰 근거다. 폰트 하나라도 외부에서 받아오면 "텔레그램 외에는 아무 데도 연결하지
       * 않는다"는 검증 가능한 약속이 깨진다. 그래서 OS 기본 한글 폰트를 그대로 쓴다.
       */
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Pretendard',
          'Malgun Gothic',
          'Segoe UI',
          'sans-serif',
        ],
      },
      screens: {
        mobile: '390px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
    },
  },
  plugins: [],
};

export default config;
