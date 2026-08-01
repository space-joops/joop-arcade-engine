// SPDX-License-Identifier: AGPL-3.0-only
// 색 팔레트·hex 유틸·DOM 스타일 — 게임의 룩을 한 곳에서 관리한다.

import type { CSSProperties } from "react";

export const AMBER = "#ffb000";
export const BG_DEEP = "#04070f";
export const FG = "#e7fdff";
export const FG_DIM = "#9fd8dc";
export const DANGER = "#ff5c77";

// 별 색온도 팔레트(웜화이트/백/청/주황) — 가중치 4:3:2:1.
export const STAR_COLORS = [
  "#fff3e4", "#fff3e4", "#fff3e4", "#fff3e4",
  "#f4f7ff", "#f4f7ff", "#f4f7ff",
  "#cfe0ff", "#cfe0ff",
  "#ffd9a8",
] as const;

// 미세 금속 파편 색(장식 입자 레이어) — 수거 판정 없음.
export const METAL_COLORS = ["#9aa4ab", "#6f7a82", "#c7ccd1"] as const;

/** hex 두 색을 t(0~1)로 채널 보간 — accentColor 에서 명·암 변형을 파생한다. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  const ch = (i: number) => {
    const va = parseInt(pa.slice(i, i + 2), 16);
    const vb = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(va + (vb - va) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

/** 분사 세기 → 분사염 색: 저출력 = 강조색, 중간 = 앰버, 풀출력 = 백열. */
export function flameColor(accent: string, strength: number): string {
  return strength <= 0.4 ? accent : strength <= 0.8 ? AMBER : "#ffe9c4";
}

// ── DOM 스타일 (라이브러리 무의존 — 인라인) ─────────────────────

export const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
  background: "rgba(4, 7, 15, 0.85)",
  padding: 24,
  textAlign: "center",
  zIndex: 2,
};

export const primaryBtnStyle = (accent: string): CSSProperties => ({
  borderRadius: 9999,
  border: "none",
  background: accent,
  color: BG_DEEP,
  fontWeight: 700,
  fontSize: 16,
  padding: "12px 32px",
  cursor: "pointer",
});

export const ghostBtnStyle: CSSProperties = {
  borderRadius: 9999,
  border: `1px solid ${FG_DIM}66`,
  background: "transparent",
  color: FG_DIM,
  fontWeight: 700,
  fontSize: 16,
  padding: "12px 32px",
  cursor: "pointer",
};

export const barBtnStyle: CSSProperties = {
  borderRadius: 8,
  border: "1px solid #1c2b45",
  background: "transparent",
  color: FG_DIM,
  fontSize: 14,
  padding: "6px 10px",
  cursor: "pointer",
};
