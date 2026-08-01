"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  CELESTIALS,
  DEFAULT_ARCADE_CONFIG,
  applyThrust,
  collides,
  joystickInput,
  pickArcadeItem,
  starHash,
  sunTintAlpha,
  type ArcadeConfig,
  type ArcadeItem,
  type Celestial,
  type Vec,
} from "../core/arcade";
import * as sfx from "../core/sound";

// ── 공개 타입 ────────────────────────────────────────────────

type Phase = "ready" | "playing" | "over";

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

// ── 내부 상수 ────────────────────────────────────────────────

// 조이스틱 바깥 링 반지름(화면 최소변 비율).
const JOYSTICK_R = 0.24;

const AMBER = "#ffb000";
const BG_DEEP = "#04070f";
const FG = "#e7fdff";
const FG_DIM = "#9fd8dc";

// 별 색온도 팔레트(웜화이트/백/청/주황) — 가중치 4:3:2:1.
const STAR_COLORS = [
  "#fff3e4", "#fff3e4", "#fff3e4", "#fff3e4",
  "#f4f7ff", "#f4f7ff", "#f4f7ff",
  "#cfe0ff", "#cfe0ff",
  "#ffd9a8",
] as const;

// 미세 금속 파편 색(장식 입자 레이어) — 수거 판정 없음.
const METAL_COLORS = ["#9aa4ab", "#6f7a82", "#c7ccd1"] as const;

/** hex 두 색을 t(0~1)로 채널 보간 — accentColor 에서 명·암 변형을 파생한다. */
function mixHex(a: string, b: string, t: number): string {
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

// ── 컴포넌트 ────────────────────────────────────────────────

export function ArcadeGame({
  config,
  labels,
  accentColor = "#2de2e6",
  sound = true,
  storagePrefix = "joop-arcade",
  onGameOver,
  style,
  className,
}: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const fuelFillRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [summary, setSummary] = useState<ArcadeSummary | null>(null);
  const [muted, setMutedState] = useState(false);
  const endGameRef = useRef<() => void>(() => {});

  const L: ArcadeLabels = { ...DEFAULT_ARCADE_LABELS, ...labels };

  // 루프(effect)가 항상 최신 prop 을 읽도록 ref 로 다리 놓기 —
  // deps 에 넣으면 prop 변경마다 게임이 리셋되므로 넣지 않는다.
  const configRef = useRef(config);
  configRef.current = config;
  const labelsRef = useRef(L);
  labelsRef.current = L;
  const accentRef = useRef(accentColor);
  accentRef.current = accentColor;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const storageRef = useRef(storagePrefix);
  storageRef.current = storagePrefix;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  useEffect(() => {
    setMutedState(sfx.isMuted());
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 진입 시점 설정 고정 — 재시작하면 최신 prop 이 반영된다.
    const cfg: ArcadeConfig = { ...DEFAULT_ARCADE_CONFIG, ...configRef.current };
    const accent = accentRef.current;
    const accentLight = mixHex(accent, "#ffffff", 0.6);
    const accentDark = mixHex(accent, "#031416", 0.55);
    const snd = soundRef.current ? sfx : null;

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = box.clientWidth;
      H = box.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);

    const unit = () => Math.min(W, H); // 월드 1.0 = 화면 최소변

    // ── 상태
    const joop = { pos: { x: 0, y: 0 } as Vec, vel: { x: 0, y: 0 } as Vec, collectFx: 0 };
    const JOOP_RADIUS = 0.065; // 월드 단위(수거 판정)
    // 자석 팔 — 흡인 반경 안 파편을 끌어당기고 팔을 그린다. 밸런스는 이 상수 2개로만 튜닝.
    const MAGNET_RADIUS = 0.22;
    const MAGNET_PULL = 2.5;
    let fuel = cfg.fuel;
    let emptySince: number | null = null; // 연료 0 이 된 경과시각(회생 허용)
    let collected = 0; // 조각(디브리 value 합)
    let eaten = 0; // 개수
    let thrustOffFor = 0;
    let lastFuelWarn = 0;
    let elapsed = 0;
    let spawnTimer = 0.8;
    let counterFlash = 0;

    // 조이스틱
    type Stick = { baseX: number; baseY: number; dx: number; dy: number; pointerId: number };
    let stick: Stick | null = null;
    const keys = new Set<string>();

    type Floating = { item: ArcadeItem; pos: Vec; vel: Vec; rot: number; rotV: number };
    const items: Floating[] = [];
    type Floater = { pos: Vec; text: string; color: string; life: number; big?: boolean };
    const floaters: Floater[] = [];
    const pushFloater = (fl: Floater) => {
      floaters.push(fl);
      if (floaters.length > 12) floaters.shift();
    };

    // 분사가스 파티클: r5→11px · 불투명 .35→.08 · 수명 600ms · 초당 12×세기 · 상한 60.
    type Exhaust = { pos: Vec; vel: Vec; age: number; color: string };
    const exhaust: Exhaust[] = [];
    let exhaustAcc = 0;
    const flameColor = (s: number) => (s <= 0.4 ? accent : s <= 0.8 ? AMBER : "#ffe9c4");

    const toScreen = (p: Vec) => ({
      x: W / 2 + (p.x - joop.pos.x) * unit(),
      y: H / 2 + (p.y - joop.pos.y) * unit(),
    });

    // 뷰포트 가장자리 밖에서 진입, 표류하며 가로지른다(상하좌우 등장)
    const spawn = () => {
      const u = unit();
      const halfW = W / 2 / u + 0.1;
      const halfH = H / 2 / u + 0.1;
      const item = pickArcadeItem(cfg, Math.random(), Math.random());
      const edge = Math.floor(Math.random() * 4); // 0상 1하 2좌 3우
      const along = Math.random() * 2 - 1;
      const pos: Vec =
        edge === 0
          ? { x: joop.pos.x + along * halfW, y: joop.pos.y - halfH }
          : edge === 1
            ? { x: joop.pos.x + along * halfW, y: joop.pos.y + halfH }
            : edge === 2
              ? { x: joop.pos.x - halfW, y: joop.pos.y + along * halfH }
              : { x: joop.pos.x + halfW, y: joop.pos.y + along * halfH };
      // 뷰 안쪽의 임의 지점을 향해 표류 — 반드시 화면을 가로지른다
      const target: Vec = {
        x: joop.pos.x + (Math.random() * 2 - 1) * halfW * 0.6,
        y: joop.pos.y + (Math.random() * 2 - 1) * halfH * 0.6,
      };
      const d = Math.hypot(target.x - pos.x, target.y - pos.y) || 1;
      const speed = 0.05 + Math.random() * 0.13;
      items.push({
        item,
        pos,
        vel: { x: ((target.x - pos.x) / d) * speed, y: ((target.y - pos.y) / d) * speed },
        rot: Math.random() * Math.PI * 2,
        rotV: reduceMotion ? 0 : (Math.random() - 0.5) * 1.05,
      });
    };

    // 시작 프리시드 — 첫 프레임부터 쓰레기밭이 보이도록 뷰 안쪽에 미리 흩뿌린다.
    const spawnInView = () => {
      if (W < 2 || H < 2) return;
      const u = unit();
      const halfW = W / 2 / u;
      const halfH = H / 2 / u;
      const item = pickArcadeItem(cfg, 1, Math.random()); // kindRoll 1 → 연료 제외, 디브리만
      const pos: Vec = {
        x: joop.pos.x + (Math.random() * 2 - 1) * halfW * 0.85,
        y: joop.pos.y + (Math.random() * 2 - 1) * halfH * 0.85,
      };
      if (Math.hypot(pos.x - joop.pos.x, pos.y - joop.pos.y) < JOOP_RADIUS * 3) return;
      const ang = Math.random() * Math.PI * 2;
      const speed = 0.03 + Math.random() * 0.08;
      items.push({
        item,
        pos,
        vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
        rot: Math.random() * Math.PI * 2,
        rotV: reduceMotion ? 0 : (Math.random() - 0.5) * 1.05,
      });
    };
    for (let i = 0; i < 9; i++) spawnInView();

    // ── 입력
    const localXY = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      const p = localXY(e);
      stick = { baseX: p.x, baseY: p.y, dx: 0, dy: 0, pointerId: e.pointerId };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // 캡처 불가(합성 이벤트 등)여도 조이스틱은 동작한다
      }
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!stick || e.pointerId !== stick.pointerId) return;
      const p = localXY(e);
      stick.dx = p.x - stick.baseX;
      stick.dy = p.y - stick.baseY;
    };
    const releaseStick = (e: PointerEvent) => {
      if (stick && e.pointerId === stick.pointerId) {
        stick = null;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // 이미 해제됐으면 무시
        }
      }
    };
    const KEYS: Record<string, Vec> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!(k in KEYS)) return;
      keys.add(k);
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", releaseStick);
    canvas.addEventListener("pointercancel", releaseStick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let running = true;
    let raf = 0;

    const endGame = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      snd?.gameOver();
      const prefix = storageRef.current;
      let best = collected;
      let newBest = false;
      if (prefix != null) {
        try {
          const prev = Number(localStorage.getItem(`${prefix}:best`) ?? 0);
          if (collected > prev) {
            best = collected;
            newBest = collected > 0;
            localStorage.setItem(`${prefix}:best`, String(collected));
          } else {
            best = prev;
          }
        } catch {
          // localStorage 불가 환경이면 기록 없이 진행
        }
      }
      const result: ArcadeSummary = { collected, eaten, elapsed, best, newBest };
      setSummary(result);
      setPhase("over");
      onGameOverRef.current?.(result);
    };
    endGameRef.current = endGame;

    // ── 렌더 헬퍼
    const drawStars = (layerK: number, parallax: number, cell: number, rMax: number) => {
      const u = unit();
      const ox = joop.pos.x * u * parallax;
      const oy = joop.pos.y * u * parallax;
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
    };

    // 미세 금속 파편(장식) — 전경 가까운 시차로 속도감을 준다. 수거 판정 없음.
    const drawSpecks = () => {
      const u = unit();
      const parallax = 0.85;
      const cell = 90;
      const ox = joop.pos.x * u * parallax;
      const oy = joop.pos.y * u * parallax;
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
          const s = 1 + starHash(gx, gy, 95) * 2;
          ctx.fillRect(x, y, s, s * 0.6);
        }
      }
      ctx.globalAlpha = 1;
    };

    const drawCelestial = (c: Celestial) => {
      const u = unit();
      const x = W / 2 + (c.x - joop.pos.x) * c.parallax * u;
      const y = H / 2 + (c.y - joop.pos.y) * c.parallax * u;
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
    };

    const drawJoop = (dir: Vec | null, strength: number) => {
      const u = unit();
      const r = JOOP_RADIUS * u * (1 + joop.collectFx * 0.3);
      const x = W / 2;
      const y = H / 2;

      // 분사염 — 분사 반대 방향 티어드롭, 세기 따라 시안→앰버→백열
      if (dir && strength > 0 && fuel > 0) {
        const len = r * (1.1 + strength * 1.3) * (reduceMotion ? 1 : 0.85 + Math.random() * 0.3);
        const fx = -dir.x;
        const fy = -dir.y;
        const px = -fy;
        const py = fx;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = flameColor(strength);
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
      g.addColorStop(0, accentLight);
      g.addColorStop(0.45, accent);
      g.addColorStop(1, accentDark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // 수거 순간 링 펄스
      if (joop.collectFx > 0) {
        ctx.globalAlpha = joop.collectFx * 1.6;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r * (1.15 + (0.35 - joop.collectFx)), 0, Math.PI * 2);
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
      ctx.strokeStyle = accentDark;
      ctx.lineWidth = Math.max(1.5, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y - r * 1.35);
      ctx.stroke();
      ctx.fillStyle = AMBER;
      ctx.beginPath();
      ctx.arc(x, y - r * 1.42, Math.max(2, r * 0.12), 0, Math.PI * 2);
      ctx.fill();
    };

    // ── 메인 루프
    let last = performance.now();
    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      elapsed += dt;
      const u = unit();

      // ── 입력 → 분사
      let dir: Vec | null = null;
      let strength = 0;
      if (stick) {
        const js = joystickInput(stick.dx, stick.dy, JOYSTICK_R * u);
        dir = js.dir;
        strength = js.strength;
      } else if (keys.size > 0) {
        let kx = 0;
        let ky = 0;
        for (const k of keys) {
          kx += KEYS[k].x;
          ky += KEYS[k].y;
        }
        const m = Math.hypot(kx, ky);
        if (m > 0) {
          dir = { x: kx / m, y: ky / m };
          strength = 1;
        }
      }

      joop.vel = applyThrust(joop.vel, dir, strength, dt, cfg, fuel);
      joop.pos.x += joop.vel.x * dt;
      joop.pos.y += joop.vel.y * dt;
      joop.collectFx = Math.max(0, joop.collectFx - dt);
      counterFlash = Math.max(0, counterFlash - dt);

      // 연료 소모(분사 세기 비례)
      if (dir && strength > 0 && fuel > 0) {
        fuel = Math.max(0, fuel - cfg.fuelBurn * strength * dt);
        thrustOffFor = 0;
        snd?.thrust(strength);
      } else {
        thrustOffFor += dt;
        if (thrustOffFor > 0.12) snd?.thrustStop();
      }
      // 연료 경고 — 25% 미만에서 1.2초 간격
      if (fuel > 0 && fuel / cfg.fuel < 0.25 && elapsed - lastFuelWarn > 1.2) {
        lastFuelWarn = elapsed;
        snd?.fuelWarn();
      }

      // 분사가스 파티클(reduced-motion 은 파티클 없이 분사염만)
      if (!reduceMotion && dir && strength > 0 && fuel > 0) {
        exhaustAcc = Math.min(2, exhaustAcc + dt * 12 * strength);
        while (exhaustAcc >= 1 && exhaust.length < 60) {
          exhaustAcc -= 1;
          const jx = (Math.random() - 0.5) * 0.03;
          const jy = (Math.random() - 0.5) * 0.03;
          exhaust.push({
            pos: { x: joop.pos.x - dir.x * 0.075 + jx, y: joop.pos.y - dir.y * 0.075 + jy },
            vel: {
              x: joop.vel.x * 0.3 - dir.x * (0.18 + 0.25 * strength) + jx * 2,
              y: joop.vel.y * 0.3 - dir.y * (0.18 + 0.25 * strength) + jy * 2,
            },
            age: 0,
            color: flameColor(strength),
          });
        }
      }
      for (let i = exhaust.length - 1; i >= 0; i--) {
        const e = exhaust[i];
        e.age += dt;
        if (e.age > 0.6) {
          exhaust.splice(i, 1);
          continue;
        }
        e.pos.x += e.vel.x * dt;
        e.pos.y += e.vel.y * dt;
      }

      // 연료 소진 — 관성으로 연료 아이템을 주우면 회생, 아니면 잠시 후 종료
      if (fuel <= 0) {
        if (emptySince === null) emptySince = elapsed;
        const coasting = Math.hypot(joop.vel.x, joop.vel.y);
        if (elapsed - emptySince > 4 || coasting < 0.02) {
          endGame();
          return;
        }
      } else {
        emptySince = null;
      }

      // ── 생성·이동·수거
      spawnTimer -= dt;
      if (spawnTimer <= 0 && items.length < 60) {
        spawn();
        spawnTimer = cfg.spawnInterval;
      }
      const despawnR = Math.max(W, H) / u;
      const magnetTargets: { f: Floating; d: number }[] = [];
      for (let i = items.length - 1; i >= 0; i--) {
        const f = items[i];
        // 자석 흡인 — 반경 안 파편을 줍스 쪽으로 끌어당긴다
        const ddx = joop.pos.x - f.pos.x;
        const ddy = joop.pos.y - f.pos.y;
        const dd = Math.hypot(ddx, ddy);
        if (dd < MAGNET_RADIUS && dd > 1e-6) {
          const pull = MAGNET_PULL * (1 - dd / MAGNET_RADIUS) * dt;
          f.vel.x += (ddx / dd) * pull;
          f.vel.y += (ddy / dd) * pull;
          const vmag = Math.hypot(f.vel.x, f.vel.y);
          if (vmag > 0.5) {
            f.vel.x = (f.vel.x / vmag) * 0.5;
            f.vel.y = (f.vel.y / vmag) * 0.5;
          }
          magnetTargets.push({ f, d: dd });
        }
        f.pos.x += f.vel.x * dt;
        f.pos.y += f.vel.y * dt;
        f.rot += f.rotV * dt;

        if (collides(joop.pos, JOOP_RADIUS, f.pos, f.item.size / 2)) {
          if (f.item.kind === "fuel") {
            fuel = Math.min(cfg.fuel, fuel + f.item.value);
            snd?.fuelPickup();
            pushFloater({ pos: { ...f.pos }, text: `⛽+${f.item.value}`, color: AMBER, life: 0.9 });
          } else {
            collected += f.item.value;
            eaten += 1;
            snd?.collect(eaten);
            joop.collectFx = 0.35;
            counterFlash = 0.25;
            pushFloater({
              pos: { ...f.pos },
              text: `+${f.item.value}`,
              color: accent,
              life: 0.9,
              big: true,
            });
          }
          items.splice(i, 1);
          continue;
        }
        if (Math.hypot(f.pos.x - joop.pos.x, f.pos.y - joop.pos.y) > despawnR) {
          items.splice(i, 1);
        }
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        floaters[i].life -= dt;
        if (floaters[i].life <= 0) floaters.splice(i, 1);
      }

      // ── HUD(DOM) 갱신 — 리렌더 없이 ref 직접 조작
      if (scoreRef.current) {
        scoreRef.current.textContent = String(collected).padStart(4, "0");
        scoreRef.current.style.color = counterFlash > 0 ? AMBER : FG;
      }
      if (fuelFillRef.current) {
        const ratio = fuel / cfg.fuel;
        fuelFillRef.current.style.width = `${Math.max(0, ratio * 100)}%`;
        const low = ratio < 0.25;
        fuelFillRef.current.style.background = low ? "#ff5c77" : AMBER;
        fuelFillRef.current.style.opacity = low && Math.sin(elapsed * 8) > 0 ? "0.45" : "1";
      }

      // ── 렌더
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#04070f");
      bg.addColorStop(1, "#0a1024");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      drawStars(0, 0.15, 170, 1.0);
      drawStars(1, 0.3, 140, 1.4);
      drawStars(2, 0.55, 120, 1.8);
      for (const c of CELESTIALS) drawCelestial(c);
      drawSpecks();

      // 태양 인접 앰버 틴트(≤8%)
      const tint = sunTintAlpha(joop.pos.x, joop.pos.y);
      if (tint > 0.003) {
        ctx.globalAlpha = tint;
        ctx.fillStyle = AMBER;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      // 분사가스 파티클
      for (const e of exhaust) {
        const p = toScreen(e.pos);
        const t = e.age / 0.6;
        ctx.globalAlpha = 0.35 - t * 0.27;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 + t * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 자석 팔(흡인 중 가까운 순 최대 2개)
      magnetTargets.sort((m, n) => m.d - n.d);
      for (const { f } of magnetTargets.slice(0, 2)) {
        const p = toScreen(f.pos);
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

      // 아이템(이모지)
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const f of items) {
        const p = toScreen(f.pos);
        if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) continue;
        const px = f.item.size * u;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(f.rot);
        ctx.font = `${px}px sans-serif`;
        ctx.fillText(f.item.emoji, 0, 0);
        ctx.restore();
      }

      // 줍스(항상 화면 중앙)
      drawJoop(dir, strength);

      // 플로터
      for (const fl of floaters) {
        const p = toScreen(fl.pos);
        const t = 1 - fl.life / 0.9;
        ctx.globalAlpha = Math.min(1, fl.life * 2.5);
        ctx.fillStyle = fl.color;
        ctx.font = `bold ${fl.big ? 18 : 14}px sans-serif`;
        ctx.fillText(fl.text, p.x, p.y - t * 34);
        ctx.globalAlpha = 1;
      }

      // 연료 소진 상태 안내
      if (fuel <= 0) {
        ctx.fillStyle = "#ff5c77";
        ctx.font = "bold 15px sans-serif";
        ctx.fillText(labelsRef.current.fuelOut, W / 2, H / 2 - JOOP_RADIUS * u - 28);
      }

      // 조이스틱(5원 링)
      if (stick) {
        const R = JOYSTICK_R * u;
        const js = joystickInput(stick.dx, stick.dy, R);
        for (let ring = 1; ring <= 5; ring++) {
          ctx.globalAlpha = js.ring === ring ? 0.5 : 0.16;
          ctx.strokeStyle = js.ring === ring ? accent : FG_DIM;
          ctx.lineWidth = js.ring === ring ? 2 : 1;
          ctx.beginPath();
          ctx.arc(stick.baseX, stick.baseY, (R * ring) / 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 노브 — 바깥 링까지로 클램프
        const dist = Math.hypot(stick.dx, stick.dy);
        const kx = dist > R ? (stick.dx / dist) * R : stick.dx;
        const ky = dist > R ? (stick.dy / dist) * R : stick.dy;
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

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", releaseStick);
      canvas.removeEventListener("pointercancel", releaseStick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      sfx.thrustStop();
    };
  }, [phase]);

  const toggleMute = () => {
    const next = !muted;
    sfx.setMuted(next);
    setMutedState(next);
  };

  // ── 스타일 (라이브러리 무의존 — 인라인)
  const accent = accentColor;
  const overlay: CSSProperties = {
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
  const primaryBtn: CSSProperties = {
    borderRadius: 9999,
    border: "none",
    background: accent,
    color: BG_DEEP,
    fontWeight: 700,
    fontSize: 16,
    padding: "12px 32px",
    cursor: "pointer",
  };
  const ghostBtn: CSSProperties = {
    borderRadius: 9999,
    border: `1px solid ${FG_DIM}66`,
    background: "transparent",
    color: FG_DIM,
    fontWeight: 700,
    fontSize: 16,
    padding: "12px 32px",
    cursor: "pointer",
  };
  const barBtn: CSSProperties = {
    borderRadius: 8,
    border: "1px solid #1c2b45",
    background: "transparent",
    color: FG_DIM,
    fontSize: 14,
    padding: "6px 10px",
    cursor: "pointer",
  };

  const renderMultiline = (text: string): ReactNode =>
    text.split("\n").map((line, i) => (
      <span key={i}>
        {i > 0 && <br />}
        {line}
      </span>
    ));

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: BG_DEEP,
        color: FG,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
        ...style,
      }}
    >
      <div ref={boxRef} style={{ position: "relative", minHeight: 0, flex: 1, overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, touchAction: "none", display: "block" }}
        />

        {/* 상단 수거 카운터 */}
        {phase === "playing" && (
          <div
            style={{
              pointerEvents: "none",
              position: "absolute",
              insetInline: 0,
              top: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 10, letterSpacing: "0.3em", color: FG_DIM }}>{L.score}</span>
            <span
              ref={scoreRef}
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 24,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              0000
            </span>
          </div>
        )}

        {/* 시작 화면 */}
        {phase === "ready" && (
          <div style={overlay}>
            <div>
              <h1 style={{ fontSize: 34, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                {L.title}
              </h1>
              <p
                style={{
                  marginTop: 12,
                  maxWidth: 384,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: FG_DIM,
                }}
              >
                {renderMultiline(L.subtitle)}
              </p>
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 14,
                color: FG_DIM,
              }}
            >
              {L.howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button onClick={() => setPhase("playing")} style={{ ...primaryBtn, fontSize: 18 }}>
              {L.start}
            </button>
          </div>
        )}

        {/* 게임 오버 */}
        {phase === "over" && summary && (
          <div style={overlay}>
            <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{L.gameOver}</h2>
            <div>
              <p style={{ fontSize: 18, margin: 0 }}>
                {L.resultCollected}{" "}
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 30,
                    fontWeight: 700,
                    color: accent,
                  }}
                >
                  {summary.collected.toLocaleString()}
                </span>{" "}
                {L.pieces} · {summary.eaten}
                {L.eatenUnit}
              </p>
              <p style={{ marginTop: 8, fontSize: 14, color: FG_DIM }}>
                {summary.newBest ? (
                  <span style={{ fontWeight: 700, color: AMBER }}>{L.newBest}</span>
                ) : (
                  <>
                    🏆 {L.best} {summary.best.toLocaleString()} {L.pieces}
                  </>
                )}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setPhase("playing")} style={primaryBtn}>
                {L.retry}
              </button>
              <button onClick={() => setPhase("ready")} style={ghostBtn}>
                {L.home}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 텔레메트리 바 */}
      <div
        style={{
          display: "flex",
          height: 56,
          flexShrink: 0,
          alignItems: "center",
          gap: 12,
          borderTop: "1px solid #1c2b45",
          background: "#070c1a",
          padding: "0 16px",
        }}
      >
        <span style={{ fontSize: 14 }} aria-hidden>
          ⛽
        </span>
        <div
          style={{
            height: 10,
            flex: 1,
            overflow: "hidden",
            borderRadius: 9999,
            background: "#1c2b45",
          }}
        >
          <div
            ref={fuelFillRef}
            style={{ height: "100%", width: "100%", borderRadius: 9999, background: AMBER }}
          />
        </div>
        {sound && (
          <button
            onClick={toggleMute}
            aria-label={muted ? L.soundOnAria : L.soundOffAria}
            style={barBtn}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
        {phase === "playing" && (
          <button onClick={() => endGameRef.current()} style={barBtn}>
            {L.quit}
          </button>
        )}
      </div>
    </div>
  );
}
