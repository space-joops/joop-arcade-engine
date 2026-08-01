// SPDX-License-Identifier: AGPL-3.0-only
// 캔버스 드로잉 — 게임 루프의 상태를 인자로 받아 그리기만 한다(상태 변경 없음).
// 그리는 순서(z-order)는 ArcadeGame 의 프레임 루프가 결정한다. docs/architecture.md 참고.

import {
  joystickInput,
  starHash,
  sunTintAlpha,
  type ArcadeItem,
  type Celestial,
  type Vec,
} from "../core/arcade";
import { AMBER, DANGER, FG_DIM, METAL_COLORS, STAR_COLORS, flameColor } from "./theme";

/** 한 프레임의 공통 렌더 문맥 — 루프가 프레임마다 만들어 각 draw* 에 넘긴다. */
export type Scene = {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** 월드 1.0 = 화면 최소변(px) */
  u: number;
  /** 카메라(줍스) 월드 좌표 */
  cam: Vec;
  elapsed: number;
  reduceMotion: boolean;
};

/** 월드 → 화면 좌표. */
export const toScreen = (s: Scene, p: Vec): Vec => ({
  x: s.W / 2 + (p.x - s.cam.x) * s.u,
  y: s.H / 2 + (p.y - s.cam.y) * s.u,
});

/** 딥스페이스 배경 그라데이션. */
export function drawBackground(s: Scene): void {
  const { ctx, W, H } = s;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#04070f");
  bg.addColorStop(1, "#0a1024");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
}

/** 시드 별밭 한 레이어 — 셀 정수 좌표를 starHash 시드로 써서 프레임 무관하게 고정. */
export function drawStars(
  s: Scene,
  layerK: number,
  parallax: number,
  cell: number,
  rMax: number,
): void {
  const { ctx, W, H, u, cam, elapsed, reduceMotion } = s;
  const ox = cam.x * u * parallax;
  const oy = cam.y * u * parallax;
  const gx0 = Math.floor(ox / cell) - 1;
  const gy0 = Math.floor(oy / cell) - 1;
  const gx1 = Math.floor((ox + W) / cell) + 1;
  const gy1 = Math.floor((oy + H) / cell) + 1;
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gy = gy0; gy <= gy1; gy++) {
      const x = gx * cell - ox + starHash(gx, gy, layerK * 4) * cell;
      const y = gy * cell - oy + starHash(gx, gy, layerK * 4 + 1) * cell;
      if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
      const r = 0.4 + starHash(gx, gy, layerK * 4 + 2) * rMax;
      const cRoll = starHash(gx, gy, layerK * 4 + 3);
      ctx.fillStyle = STAR_COLORS[Math.floor(cRoll * STAR_COLORS.length)];
      // 은은한 반짝임 — 시드 위상이라 별마다 다르게, reduced-motion 은 고정
      const tw = reduceMotion
        ? 0.8
        : 0.65 + 0.35 * Math.sin(elapsed * (0.6 + cRoll * 1.4) + cRoll * 12);
      ctx.globalAlpha = (0.35 + 0.55 * starHash(gx, gy, layerK * 4 + 5)) * tw;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** 미세 금속 파편(장식) — 전경 가까운 시차로 속도감을 준다. 수거 판정 없음. */
export function drawSpecks(s: Scene): void {
  const { ctx, W, H, u, cam } = s;
  const parallax = 0.85;
  const cell = 90;
  const ox = cam.x * u * parallax;
  const oy = cam.y * u * parallax;
  const gx0 = Math.floor(ox / cell) - 1;
  const gy0 = Math.floor(oy / cell) - 1;
  const gx1 = Math.floor((ox + W) / cell) + 1;
  const gy1 = Math.floor((oy + H) / cell) + 1;
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gy = gy0; gy <= gy1; gy++) {
      if (starHash(gx, gy, 90) > 0.55) continue; // 밀도 55%
      const x = gx * cell - ox + starHash(gx, gy, 91) * cell;
      const y = gy * cell - oy + starHash(gx, gy, 92) * cell;
      ctx.fillStyle = METAL_COLORS[Math.floor(starHash(gx, gy, 93) * METAL_COLORS.length)];
      ctx.globalAlpha = 0.25 + starHash(gx, gy, 94) * 0.3;
      const sz = 1 + starHash(gx, gy, 95) * 2;
      ctx.fillRect(x, y, sz, sz * 0.6);
    }
  }
  ctx.globalAlpha = 1;
}

/** 천체(지구/달/태양) — 화면 밖이면 가장자리에 색+글리프 힌트만 그린다. */
export function drawCelestial(s: Scene, c: Celestial): void {
  const { ctx, W, H, u, cam } = s;
  const x = W / 2 + (c.x - cam.x) * c.parallax * u;
  const y = H / 2 + (c.y - cam.y) * c.parallax * u;
  const r = (c.size / 2) * u;

  // 화면 밖이면 에지 방향 힌트만
  if (x < -r || x > W + r || y < -r || y > H + r) {
    const cx = Math.max(28, Math.min(W - 28, x));
    const cy = Math.max(28, Math.min(H - 28, y));
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = c.hint.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = c.hint.color;
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.hint.glyph, cx, cy + 0.5);
    ctx.globalAlpha = 1;
    return;
  }

  if (c.kind === "earth") {
    // 대기 글로우
    const glow = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.12);
    glow.addColorStop(0, "rgba(56, 224, 240, 0.25)");
    glow.addColorStop(1, "rgba(56, 224, 240, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.12, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, "#2e6cb8");
    g.addColorStop(0.55, "#1a4585");
    g.addColorStop(1, "#081c40");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 대륙 느낌의 블롭 몇 개
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(38, 110, 74, 0.55)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.35, y - r * 0.15, r * 0.3, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.25, y + r * 0.35, r * 0.24, r * 0.14, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.1, y - r * 0.45, r * 0.4, r * 0.1, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // 심우주 쪽(아래) 터미네이터 음영
    const shade = ctx.createRadialGradient(x, y - r * 0.5, r * 0.4, x, y, r);
    shade.addColorStop(0, "rgba(2, 6, 18, 0)");
    shade.addColorStop(1, "rgba(2, 6, 18, 0.55)");
    ctx.fillStyle = shade;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  } else if (c.kind === "moon") {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, "#d8d2c4");
    g.addColorStop(1, "#8a8478");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(90, 85, 75, 0.5)";
    for (const [cx, cy, cr] of [
      [-0.3, -0.2, 0.16],
      [0.25, 0.1, 0.12],
      [-0.05, 0.4, 0.1],
      [0.4, -0.35, 0.08],
    ]) {
      ctx.beginPath();
      ctx.arc(x + cx * r, y + cy * r, cr * r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 태양 — 코로나 + 본체
    const corona = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
    corona.addColorStop(0, "rgba(255, 178, 62, 0.35)");
    corona.addColorStop(1, "rgba(255, 178, 62, 0)");
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "#fff7d6");
    g.addColorStop(0.7, "#ffd25e");
    g.addColorStop(1, "#ffb23e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 태양 인접 앰버 틴트(≤8%) — 카메라와 태양의 거리로 보간. */
export function drawSunTint(s: Scene): void {
  const tint = sunTintAlpha(s.cam.x, s.cam.y);
  if (tint <= 0.003) return;
  s.ctx.globalAlpha = tint;
  s.ctx.fillStyle = AMBER;
  s.ctx.fillRect(0, 0, s.W, s.H);
  s.ctx.globalAlpha = 1;
}

export type ExhaustParticle = { pos: Vec; vel: Vec; age: number; color: string };

/** 분사가스 파티클: r 5→11px, 불투명 .35→.08, 수명 0.6s. */
export function drawExhaust(s: Scene, particles: readonly ExhaustParticle[]): void {
  const { ctx } = s;
  for (const e of particles) {
    const p = toScreen(s, e.pos);
    const t = e.age / 0.6;
    ctx.globalAlpha = 0.35 - t * 0.27;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 + t * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 자석 팔 — 흡인 중인 대상(월드 좌표, 최대 2개 권장)에 점선 팔을 그린다. */
export function drawMagnetArms(s: Scene, targets: readonly Vec[], accent: string): void {
  const { ctx, W, H } = s;
  for (const t of targets) {
    const p = toScreen(s, t);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** 떠다니는 아이템(이모지) — 뷰 밖 ±60px 는 컬링. */
export function drawItems(
  s: Scene,
  items: readonly { item: ArcadeItem; pos: Vec; rot: number }[],
): void {
  const { ctx, W, H, u } = s;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of items) {
    const p = toScreen(s, f.pos);
    if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) continue;
    const px = f.item.size * u;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(f.rot);
    ctx.font = `${px}px sans-serif`;
    ctx.fillText(f.item.emoji, 0, 0);
    ctx.restore();
  }
}

export type JoopState = {
  /** 월드 단위 반지름(수거 판정과 동일) */
  radius: number;
  dir: Vec | null;
  strength: number;
  fuel: number;
  /** 수거 직후 펄스(0~0.35, 감쇠) */
  collectFx: number;
  accent: string;
  accentLight: string;
  accentDark: string;
};

/** 줍스 — 항상 화면 중앙. 분사염 → 몸통 → 수거 펄스 → 바이저 → 안테나 순. */
export function drawJoop(s: Scene, j: JoopState): void {
  const { ctx, W, H, u, reduceMotion } = s;
  const r = j.radius * u * (1 + j.collectFx * 0.3);
  const x = W / 2;
  const y = H / 2;

  // 분사염 — 분사 반대 방향 티어드롭, 세기 따라 시안→앰버→백열
  if (j.dir && j.strength > 0 && j.fuel > 0) {
    const len = r * (1.1 + j.strength * 1.3) * (reduceMotion ? 1 : 0.85 + Math.random() * 0.3);
    const fx = -j.dir.x;
    const fy = -j.dir.y;
    const px = -fy;
    const py = fx;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = flameColor(j.accent, j.strength);
    ctx.beginPath();
    ctx.moveTo(x + fx * r * 0.9 + px * r * 0.35, y + fy * r * 0.9 + py * r * 0.35);
    ctx.lineTo(x + fx * (r + len), y + fy * (r + len));
    ctx.lineTo(x + fx * r * 0.9 - px * r * 0.35, y + fy * r * 0.9 - py * r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 몸통 — accentColor 에서 파생한 명·암 그라데이션
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r);
  g.addColorStop(0, j.accentLight);
  g.addColorStop(0.45, j.accent);
  g.addColorStop(1, j.accentDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // 수거 순간 링 펄스
  if (j.collectFx > 0) {
    ctx.globalAlpha = j.collectFx * 1.6;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.15 + (0.35 - j.collectFx)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 바이저 + 눈
  ctx.fillStyle = "#08262e";
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.15, r * 0.62, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7fdff";
  ctx.beginPath();
  ctx.arc(x - r * 0.24, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
  ctx.arc(x + r * 0.24, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  // 안테나
  ctx.strokeStyle = j.accentDark;
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y - r * 1.35);
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(x, y - r * 1.42, Math.max(2, r * 0.12), 0, Math.PI * 2);
  ctx.fill();
}

export type FloaterText = { pos: Vec; text: string; color: string; life: number; big?: boolean };

/** 수거/충전 플로터 — 위로 떠오르며 사라지는 텍스트. */
export function drawFloaters(s: Scene, floaters: readonly FloaterText[]): void {
  const { ctx } = s;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const fl of floaters) {
    const p = toScreen(s, fl.pos);
    const t = 1 - fl.life / 0.9;
    ctx.globalAlpha = Math.min(1, fl.life * 2.5);
    ctx.fillStyle = fl.color;
    ctx.font = `bold ${fl.big ? 18 : 14}px sans-serif`;
    ctx.fillText(fl.text, p.x, p.y - t * 34);
    ctx.globalAlpha = 1;
  }
}

/** 연료 소진 안내 — 줍스 머리 위. */
export function drawFuelOutHint(s: Scene, text: string, joopRadius: number): void {
  const { ctx, W, H, u } = s;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = DANGER;
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(text, W / 2, H / 2 - joopRadius * u - 28);
}

export type StickState = { baseX: number; baseY: number; dx: number; dy: number };

/** 5원 조이스틱 — 활성 링 하이라이트 + 노브(바깥 링 클램프). */
export function drawJoystick(s: Scene, stick: StickState, ringR: number, accent: string): void {
  const { ctx } = s;
  const js = joystickInput(stick.dx, stick.dy, ringR);
  for (let ring = 1; ring <= 5; ring++) {
    ctx.globalAlpha = js.ring === ring ? 0.5 : 0.16;
    ctx.strokeStyle = js.ring === ring ? accent : FG_DIM;
    ctx.lineWidth = js.ring === ring ? 2 : 1;
    ctx.beginPath();
    ctx.arc(stick.baseX, stick.baseY, (ringR * ring) / 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 노브 — 바깥 링까지로 클램프
  const dist = Math.hypot(stick.dx, stick.dy);
  const kx = dist > ringR ? (stick.dx / dist) * ringR : stick.dx;
  const ky = dist > ringR ? (stick.dy / dist) * ringR : stick.dy;
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(stick.baseX, stick.baseY);
  ctx.lineTo(stick.baseX + kx, stick.baseY + ky);
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(stick.baseX + kx, stick.baseY + ky, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
