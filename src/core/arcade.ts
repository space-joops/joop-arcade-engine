// SPDX-License-Identifier: AGPL-3.0-only
// 아케이드(우주 수거) 물리·로직 — 순수 함수(부수효과 없음).
// space-joops/joop-03 PR #64 의 @joop/arcade-engine core/arcade.ts 에서 포팅.
//
// 관성 있음 · 마찰 0. 분사 물리는 시간 기반(초 단위) — 주사율과 무관하게 같은 체감.
//
// 좌표 규약: 월드 단위 1.0 = 화면 최소변(min(w,h)). 속도는 units/s, 가속은 units/s².
// 월드는 개방형(경계 없음) — 카메라가 줍스를 따라가고 배경이 흐른다.

export type ArcadeConfig = {
  thrust: number; // 최대 가속(units/s²)
  maxSpeed: number; // 속도 상한(units/s)
  fuel: number; // 초기 분사가스
  fuelBurn: number; // 풀분사(세기 1.0) 시 초당 소모량
  friction: number; // 마찰(0 = 관성 유지)
  spawnInterval: number; // 쓰레기 생성 간격(초)
  fuelItemRatio: number; // 생성 물체 중 연료 아이템 비율(0~1)
};

export const DEFAULT_ARCADE_CONFIG: ArcadeConfig = {
  thrust: 1.2,
  maxSpeed: 0.9,
  fuel: 100,
  fuelBurn: 12,
  friction: 0,
  spawnInterval: 0.7,
  fuelItemRatio: 0.12,
};

export type Vec = { x: number; y: number };

/**
 * 분사 적용 — dir(단위 벡터) 방향으로 strength(0~1) 세기만큼 dt초 가속.
 * 연료가 없으면 가속 없음(관성만). 마찰이 0이면 속도가 유지된다.
 */
export function applyThrust(
  vel: Vec,
  dir: Vec | null,
  strength: number,
  dt: number,
  cfg: ArcadeConfig,
  fuel: number,
): Vec {
  let vx = vel.x;
  let vy = vel.y;

  if (dir && fuel > 0 && strength > 0) {
    vx += dir.x * cfg.thrust * strength * dt;
    vy += dir.y * cfg.thrust * strength * dt;
  }

  if (cfg.friction > 0) {
    const k = Math.max(0, 1 - cfg.friction * dt);
    vx *= k;
    vy *= k;
  }

  const speed = Math.hypot(vx, vy);
  if (speed > cfg.maxSpeed) {
    vx = (vx / speed) * cfg.maxSpeed;
    vy = (vy / speed) * cfg.maxSpeed;
  }
  return { x: vx, y: vy };
}

/** 원-원 충돌(월드 단위). */
export function collides(a: Vec, ar: number, b: Vec, br: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < ar + br;
}

/**
 * 5원 조이스틱 — 드래그 오프셋(px)을 방향 + 분사 세기로 변환.
 * 링 5개가 세기 0.2/0.4/0.6/0.8/1.0 단계다. 데드존(중심 8px)은 세기 0.
 */
export function joystickInput(
  dx: number,
  dy: number,
  ringRadius: number, // 바깥 링(5단계)의 반지름 px
): { dir: Vec | null; strength: number; ring: number } {
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return { dir: null, strength: 0, ring: 0 };
  const ring = Math.min(5, Math.max(1, Math.ceil((dist / ringRadius) * 5)));
  return { dir: { x: dx / dist, y: dy / dist }, strength: ring / 5, ring };
}

// ── 떠다니는 물체 ─────────────────────────────────────────────
// 쓰레기 6종 + 연료 아이템. 스프라이트 시트 대신 이모지로 그린다.

export type ArcadeItem = {
  id: string;
  emoji: string;
  kind: "debris" | "fuel";
  /** 수거 시 더해지는 조각 수(debris) / 충전량(fuel) */
  value: number;
  /** 월드 단위 지름 */
  size: number;
};

export const ARCADE_DEBRIS: readonly ArcadeItem[] = [
  { id: "can", emoji: "🥫", kind: "debris", value: 3, size: 0.075 },
  { id: "bolt", emoji: "🔩", kind: "debris", value: 1, size: 0.055 },
  { id: "nut", emoji: "⚙️", kind: "debris", value: 1, size: 0.055 },
  { id: "panel", emoji: "📡", kind: "debris", value: 5, size: 0.1 },
  { id: "strut", emoji: "📏", kind: "debris", value: 3, size: 0.075 },
  { id: "chip", emoji: "💾", kind: "debris", value: 2, size: 0.06 },
];

export const ARCADE_FUEL_ITEM: ArcadeItem = {
  id: "fuel",
  emoji: "⛽",
  kind: "fuel",
  value: 18,
  size: 0.07,
};

/** 다음 생성 물체 선택 — 난수를 인자로 받아 순수 함수 유지. */
export function pickArcadeItem(cfg: ArcadeConfig, kindRoll: number, pickRoll: number): ArcadeItem {
  if (kindRoll < cfg.fuelItemRatio) return ARCADE_FUEL_ITEM;
  const i = Math.min(ARCADE_DEBRIS.length - 1, Math.floor(pickRoll * ARCADE_DEBRIS.length));
  return ARCADE_DEBRIS[i];
}

// ── 배경 천체 — 월드 고정 좌표. 카메라가 흐르면 지구 → 달 → 태양이 전환된다.
// parallax < 1 이라 멀리 있는 느낌으로 천천히 흐른다. 이미지 대신 캔버스 도형으로 그린다.
export type Celestial = {
  kind: "earth" | "moon" | "sun";
  /** 월드 좌표(units) */
  x: number;
  y: number;
  /** 월드 단위 크기(지름) */
  size: number;
  /** 카메라 대비 이동 비율(0=완전 고정, 1=전경) */
  parallax: number;
  /** 화면 밖일 때 에지 방향 힌트 — 색 + 글리프 */
  hint: { color: string; glyph: string };
};

export const SUN_POS = { x: 5.6, y: 0.3 } as const;

// z-order = 배열 순서(앞 항목이 뒤에 깔린다). 달은 지구보다 parallax 를 낮춰 "더 멀리" 흐른다.
// 지구는 원본(3.2)이 투명 여백 있는 이미지 기준이라, 꽉 찬 원으로 그리는 여기서는
// 1.5 로 줄여 시작 화면에서 "아래쪽 지평선"으로 보이게 한다.
export const CELESTIALS: readonly Celestial[] = [
  { kind: "moon", x: 3.2, y: -1.3, size: 0.42, parallax: 0.26, hint: { color: "#b0a793", glyph: "M" } },
  { kind: "earth", x: 0, y: 2.2, size: 1.5, parallax: 0.35, hint: { color: "#38e0f0", glyph: "E" } },
  { kind: "sun", x: SUN_POS.x, y: SUN_POS.y, size: 0.85, parallax: 0.3, hint: { color: "#ffb23e", glyph: "S" } },
];

/** 태양 인접 앰버 틴트(≤8%) — 태양과의 월드 거리로 0~0.08 보간. */
export function sunTintAlpha(camX: number, camY: number): number {
  const d = Math.hypot(camX - SUN_POS.x, camY - SUN_POS.y);
  return Math.max(0, Math.min(0.08, (1 - d / 3.5) * 0.08));
}

/**
 * 별 패럴랙스용 결정적 의사난수 — 섹터(정수 좌표)에서 항상 같은 별 배치가 나온다.
 * Math.random 을 프레임마다 쓰면 별이 반짝이며 움직여 버리므로 시드 기반으로 고정한다.
 */
export function starHash(ix: number, iy: number, k: number): number {
  let h = (ix * 374761393 + iy * 668265263 + k * 1440662683) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
