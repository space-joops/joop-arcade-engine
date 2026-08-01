// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CELESTIALS,
  DEFAULT_ARCADE_CONFIG,
  applyThrust,
  collides,
  joystickInput,
  pickArcadeItem,
  type ArcadeConfig,
  type ArcadeItem,
  type Vec,
} from "../core/arcade";
import * as sfx from "../core/sound";
import {
  drawBackground,
  drawCelestial,
  drawExhaust,
  drawFloaters,
  drawFuelOutHint,
  drawItems,
  drawJoop,
  drawJoystick,
  drawMagnetArms,
  drawSpecks,
  drawStars,
  drawSunTint,
  type ExhaustParticle,
  type FloaterText,
  type Scene,
} from "./render";
import {
  DEFAULT_ARCADE_LABELS,
  type ArcadeGameProps,
  type ArcadeLabels,
  type ArcadeSummary,
} from "./types";
import {
  AMBER,
  BG_DEEP,
  DANGER,
  FG,
  FG_DIM,
  barBtnStyle,
  flameColor,
  ghostBtnStyle,
  mixHex,
  overlayStyle,
  primaryBtnStyle,
} from "./theme";

export { DEFAULT_ARCADE_LABELS } from "./types";
export type { ArcadeGameProps, ArcadeLabels, ArcadeSummary } from "./types";

type Phase = "ready" | "playing" | "over";

// 조이스틱 바깥 링 반지름(화면 최소변 비율).
const JOYSTICK_R = 0.24;

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
    const floaters: FloaterText[] = [];
    const pushFloater = (fl: FloaterText) => {
      floaters.push(fl);
      if (floaters.length > 12) floaters.shift();
    };

    // 분사가스 파티클: r5→11px · 불투명 .35→.08 · 수명 600ms · 초당 12×세기 · 상한 60.
    const exhaust: ExhaustParticle[] = [];
    let exhaustAcc = 0;
    const flame = (s: number) => flameColor(accent, s);

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
            color: flame(strength),
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
        fuelFillRef.current.style.background = low ? DANGER : AMBER;
        fuelFillRef.current.style.opacity = low && Math.sin(elapsed * 8) > 0 ? "0.45" : "1";
      }

      // ── 렌더 — 순서가 z-order 다(뒤 → 앞). 함수들은 render.ts, 상태 변경 없음.
      const scene: Scene = { ctx, W, H, u, cam: joop.pos, elapsed, reduceMotion };
      drawBackground(scene);
      drawStars(scene, 0, 0.15, 170, 1.0);
      drawStars(scene, 1, 0.3, 140, 1.4);
      drawStars(scene, 2, 0.55, 120, 1.8);
      for (const c of CELESTIALS) drawCelestial(scene, c);
      drawSpecks(scene);
      drawSunTint(scene);
      drawExhaust(scene, exhaust);
      magnetTargets.sort((m, n) => m.d - n.d);
      drawMagnetArms(
        scene,
        magnetTargets.slice(0, 2).map((m) => m.f.pos),
        accent,
      );
      drawItems(scene, items);
      drawJoop(scene, {
        radius: JOOP_RADIUS,
        dir,
        strength,
        fuel,
        collectFx: joop.collectFx,
        accent,
        accentLight,
        accentDark,
      });
      drawFloaters(scene, floaters);
      if (fuel <= 0) drawFuelOutHint(scene, labelsRef.current.fuelOut, JOOP_RADIUS);
      if (stick) drawJoystick(scene, stick, JOYSTICK_R * u, accent);

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

  const accent = accentColor;

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
          <div style={overlayStyle}>
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
            <button onClick={() => setPhase("playing")} style={{ ...primaryBtnStyle(accent), fontSize: 18 }}>
              {L.start}
            </button>
          </div>
        )}

        {/* 게임 오버 */}
        {phase === "over" && summary && (
          <div style={overlayStyle}>
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
              <button onClick={() => setPhase("playing")} style={primaryBtnStyle(accent)}>
                {L.retry}
              </button>
              <button onClick={() => setPhase("ready")} style={ghostBtnStyle}>
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
            style={barBtnStyle}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
        {phase === "playing" && (
          <button onClick={() => endGameRef.current()} style={barBtnStyle}>
            {L.quit}
          </button>
        )}
      </div>
    </div>
  );
}
