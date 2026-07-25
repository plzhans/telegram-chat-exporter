import type { Config } from 'tailwindcss';

/*
  exporter(루트)와 같은 디자인 값을 쓰되 **독립된 사본**이다. 랜딩은 자기 소스만 스캔한다.
  색·글꼴·화면 폭 등을 바꿀 일이 있으면 두 곳(여기와 루트 `tailwind.config.ts`)을 함께 본다.
*/
const config: Config = {
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
       * **웹폰트를 쓰지 않는다.** 외부에서 폰트 하나라도 받아오면 "텔레그램 외에는 아무 데도
       * 연결하지 않는다"는 이 도구의 약속이 랜딩에서부터 깨진다. OS 기본 폰트를 그대로 쓴다.
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
