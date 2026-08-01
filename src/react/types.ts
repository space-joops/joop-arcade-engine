// SPDX-License-Identifier: AGPL-3.0-only
// ArcadeGame 의 공개 타입·기본 라벨 — 컴포넌트 사용자가 보는 계약.

import type { CSSProperties } from "react";
import type { ArcadeConfig } from "../core/arcade";

/** 게임 종료 시 onGameOver 로 전달되는 결과. */
export type ArcadeSummary = {
  /** 수거한 조각 수(아이템 가치 합) */
  collected: number;
  /** 수거한 아이템 개수 */
  eaten: number;
  /** 플레이 시간(초) */
  elapsed: number;
  /** 저장된 최고 기록(이번 판 반영 후) */
  best: number;
  /** 이번 판이 신기록인지 */
  newBest: boolean;
};

/** UI 문자열 전체 — labels prop 으로 부분 교체(i18n)할 수 있다. */
export type ArcadeLabels = {
  title: string;
  subtitle: string;
  /** 시작 화면 조작 안내 목록 */
  howTo: string[];
  start: string;
  /** HUD 수거 카운터 라벨 */
  score: string;
  gameOver: string;
  resultCollected: string;
  pieces: string;
  eatenUnit: string;
  best: string;
  newBest: string;
  retry: string;
  home: string;
  quit: string;
  /** 연료 소진 시 캔버스에 그려지는 안내 */
  fuelOut: string;
  soundOnAria: string;
  soundOffAria: string;
};

export const DEFAULT_ARCADE_LABELS: ArcadeLabels = {
  title: "줍스 아케이드 🛰️",
  subtitle: "우주를 떠다니며 쓰레기를 수거하세요.\n관성이 있어요 — 분사를 멈춰도 계속 흘러갑니다.",
  howTo: [
    "🕹️ 화면 아무 곳이나 드래그 = 분사 (링 단계로 세기 조절)",
    "⌨️ WASD / 방향키도 가능",
    "⛽ 분사할 때만 연료 소모 — 소진되면 게임 오버",
    "🧲 가까운 파편은 자석 팔이 끌어당겨요",
  ],
  start: "출동! 🚀",
  score: "수거",
  gameOver: "게임 오버",
  resultCollected: "수거",
  pieces: "조각",
  eatenUnit: "개",
  best: "최고 기록",
  newBest: "🏆 신기록!",
  retry: "다시하기 🔄",
  home: "처음으로",
  quit: "종료",
  fuelOut: "연료 소진! ⛽를 잡으면 회생",
  soundOnAria: "소리 켜기",
  soundOffAria: "소리 끄기",
};

export interface ArcadeGameProps {
  /** 물리·밸런스 오버라이드 — 게임 시작 시점 값이 그 판에 적용된다 */
  config?: Partial<ArcadeConfig>;
  /** UI 문자열 부분 교체(i18n) */
  labels?: Partial<ArcadeLabels>;
  /** 캐릭터·UI 강조색 (기본 #2de2e6) */
  accentColor?: string;
  /** false 면 효과음 전체 비활성화(토글 버튼도 숨김) */
  sound?: boolean;
  /**
   * 최고 기록 localStorage 키 프리픽스(`{prefix}:best`).
   * null 이면 저장하지 않는다. 기본 "joop-arcade".
   */
  storagePrefix?: string | null;
  /** 게임 종료(연료 소진·조기 종료) 시 호출 — 서버 저장 등 호스트 연동 지점 */
  onGameOver?: (summary: ArcadeSummary) => void;
  /** 컨테이너 스타일 오버라이드 — 컴포넌트는 부모를 100% 채운다 */
  style?: CSSProperties;
  className?: string;
}
