import { create } from 'zustand';

interface LightboxState {
  /** 지금 넘겨볼 수 있는 사진들. 앨범이면 그 묶음 전체, 낱장이면 한 개뿐이다. */
  keys: string[];
  index: number;
  open: (keys: string[], index: number) => void;
  close: () => void;
  next: () => void;
  previous: () => void;
}

/**
 * 사진 확대 보기 상태.
 *
 * 말풍선 깊숙한 곳(`MessagePhoto`)에서 열고, 화면 맨 위(`DialogDetail`)에서 그린다. 그 사이를
 * prop 으로 잇자면 메시지 목록 전체를 거쳐야 해서 전역 상태로 둔다 — 인증 스토어와 같은 방식이다.
 */
export const useLightbox = create<LightboxState>((set) => ({
  keys: [],
  index: 0,
  open: (keys, index) => set({ keys, index }),
  close: () => set({ keys: [], index: 0 }),
  // 끝에서 멈춘다. 순환시키면 마지막 장에서 첫 장으로 튀어 어디쯤인지 감을 잃는다.
  next: () => set((state) => ({ index: Math.min(state.index + 1, state.keys.length - 1) })),
  previous: () => set((state) => ({ index: Math.max(state.index - 1, 0) })),
}));
