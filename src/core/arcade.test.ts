// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  ARCADE_DEBRIS,
  ARCADE_FUEL_ITEM,
  DEFAULT_ARCADE_CONFIG,
  SUN_POS,
  applyThrust,
  collides,
  joystickInput,
  pickArcadeItem,
  starHash,
  sunTintAlpha,
} from "./arcade";

const cfg = DEFAULT_ARCADE_CONFIG;

describe("applyThrust — 관성 물리", () => {
  it("분사 방향으로 dt 에 비례해 가속한다", () => {
    const v = applyThrust({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, 0.5, cfg, 100);
    expect(v.x).toBeCloseTo(cfg.thrust * 0.5); // 1.2 × 0.5s = 0.6
    expect(v.y).toBe(0);
  });

  it("세기(strength)에 비례한다", () => {
    const full = applyThrust({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, 0.1, cfg, 100);
    const half = applyThrust({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.5, 0.1, cfg, 100);
    expect(half.x).toBeCloseTo(full.x / 2);
  });

  it("연료가 없으면 가속하지 않는다(관성만 유지)", () => {
    const v = applyThrust({ x: 0.3, y: -0.1 }, { x: 1, y: 0 }, 1, 0.5, cfg, 0);
    expect(v).toEqual({ x: 0.3, y: -0.1 });
  });

  it("방향이 없으면(dir=null) 속도가 유지된다 — 마찰 0", () => {
    const v = applyThrust({ x: 0.4, y: 0.2 }, null, 0, 1.0, cfg, 100);
    expect(v).toEqual({ x: 0.4, y: 0.2 });
  });

  it("최대 속도를 넘지 않는다", () => {
    let v = { x: 0, y: 0 };
    for (let i = 0; i < 100; i++) v = applyThrust(v, { x: 1, y: 0 }, 1, 0.1, cfg, 100);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(cfg.maxSpeed);
  });

  it("마찰이 있으면 속도가 감쇠한다", () => {
    const fricCfg = { ...cfg, friction: 1 };
    const v = applyThrust({ x: 1, y: 0 }, null, 0, 0.1, fricCfg, 100);
    expect(v.x).toBeCloseTo(0.9); // 1 × (1 − 1×0.1)
  });
});

describe("collides — 원-원 충돌", () => {
  it("반지름 합보다 가까우면 충돌", () => {
    expect(collides({ x: 0, y: 0 }, 0.1, { x: 0.15, y: 0 }, 0.1)).toBe(true);
  });
  it("반지름 합보다 멀면 비충돌", () => {
    expect(collides({ x: 0, y: 0 }, 0.1, { x: 0.25, y: 0 }, 0.1)).toBe(false);
  });
  it("경계(정확히 반지름 합)는 비충돌 — 열린 구간", () => {
    expect(collides({ x: 0, y: 0 }, 0.1, { x: 0.2, y: 0 }, 0.1)).toBe(false);
  });
});

describe("joystickInput — 5원 조이스틱", () => {
  const R = 100; // 바깥 링 반지름 px

  it("데드존(8px 미만)은 무입력", () => {
    expect(joystickInput(5, 5, R)).toEqual({ dir: null, strength: 0, ring: 0 });
  });

  it("링 1(가장 안쪽) = 세기 0.2", () => {
    const js = joystickInput(15, 0, R);
    expect(js.ring).toBe(1);
    expect(js.strength).toBeCloseTo(0.2);
  });

  it("바깥 링 반지름 = 링 5 = 세기 1.0", () => {
    const js = joystickInput(R, 0, R);
    expect(js.ring).toBe(5);
    expect(js.strength).toBe(1);
  });

  it("바깥 링을 넘어도 링 5 로 클램프", () => {
    expect(joystickInput(R * 3, 0, R).ring).toBe(5);
  });

  it("방향은 단위 벡터다", () => {
    const js = joystickInput(30, 40, R);
    expect(Math.hypot(js.dir!.x, js.dir!.y)).toBeCloseTo(1);
    expect(js.dir!.x).toBeCloseTo(0.6);
    expect(js.dir!.y).toBeCloseTo(0.8);
  });

  it("거리 비례로 중간 링이 나온다 (60% 지점 → 링 3)", () => {
    expect(joystickInput(R * 0.6, 0, R).ring).toBe(3);
  });
});

describe("pickArcadeItem — 스폰 선택", () => {
  it("kindRoll < fuelItemRatio 이면 연료 아이템", () => {
    expect(pickArcadeItem(cfg, cfg.fuelItemRatio - 0.001, 0.5)).toBe(ARCADE_FUEL_ITEM);
  });

  it("kindRoll ≥ fuelItemRatio 이면 쓰레기", () => {
    expect(pickArcadeItem(cfg, cfg.fuelItemRatio, 0.5).kind).toBe("debris");
  });

  it("pickRoll 로 쓰레기 종류를 균등 선택하고 인덱스를 클램프한다", () => {
    expect(pickArcadeItem(cfg, 1, 0)).toBe(ARCADE_DEBRIS[0]);
    expect(pickArcadeItem(cfg, 1, 0.999)).toBe(ARCADE_DEBRIS[ARCADE_DEBRIS.length - 1]);
    expect(pickArcadeItem(cfg, 1, 1)).toBe(ARCADE_DEBRIS[ARCADE_DEBRIS.length - 1]); // 클램프
  });

  it("순수 함수 — 같은 인자는 같은 결과", () => {
    expect(pickArcadeItem(cfg, 0.5, 0.5)).toBe(pickArcadeItem(cfg, 0.5, 0.5));
  });
});

describe("starHash — 결정적 별밭 해시", () => {
  it("같은 입력은 항상 같은 값(결정성)", () => {
    expect(starHash(3, -7, 2)).toBe(starHash(3, -7, 2));
  });

  it("[0, 1] 범위를 벗어나지 않는다", () => {
    for (let i = -50; i < 50; i++) {
      const h = starHash(i, i * 31, i % 5);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it("입력이 다르면 대체로 다른 값(분산)", () => {
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) values.add(starHash(i, 0, 0));
    expect(values.size).toBeGreaterThan(95);
  });
});

describe("sunTintAlpha — 태양 인접 틴트", () => {
  it("태양 위치에서 최대 0.08", () => {
    expect(sunTintAlpha(SUN_POS.x, SUN_POS.y)).toBeCloseTo(0.08);
  });
  it("멀리서는 0", () => {
    expect(sunTintAlpha(SUN_POS.x - 10, SUN_POS.y)).toBe(0);
  });
  it("거리에 따라 단조 감소한다", () => {
    const near = sunTintAlpha(SUN_POS.x + 0.5, SUN_POS.y);
    const far = sunTintAlpha(SUN_POS.x + 2.0, SUN_POS.y);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});
