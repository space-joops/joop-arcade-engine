// SPDX-License-Identifier: AGPL-3.0-only
// 경량 Web Audio 효과음 — 에셋 없이 오실레이터/노이즈로 합성한다.
// 모든 함수는 브라우저에서만 동작(SSR no-op). 모듈 싱글턴이라 한 페이지에
// 게임 인스턴스가 여러 개여도 오디오 컨텍스트는 하나만 쓴다.

const MUTE_KEY = "joop-arcade:muted";

let ctx: AudioContext | null = null;
let muted = false;
let thrustNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

if (typeof window !== "undefined") {
  muted = localStorage.getItem(MUTE_KEY) === "1";
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {
    // 저장 실패는 무시(프라이빗 모드 등)
  }
  if (v) thrustStop();
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 짧은 감쇠 톤 — 수거/충전/경고류의 공통 빌딩 블록. */
function blip(freq: number, dur: number, type: OscillatorType, gain: number, sweepTo?: number) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, ac.currentTime + dur);
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur);
}

/** 수거 블립 — 연속 수거(n)마다 피치가 조금씩 올라 콤보감을 준다. */
export function collect(n: number): void {
  const step = n % 8;
  blip(520 + step * 60, 0.12, "triangle", 0.14, 780 + step * 60);
}

/** 연료 충전 — 위로 쓸어올리는 스윕. */
export function fuelPickup(): void {
  blip(220, 0.25, "sine", 0.16, 660);
}

/** 연료 경고 — 낮은 이중 펄스. 호출측이 간격(1.2s)을 관리한다. */
export function fuelWarn(): void {
  blip(300, 0.09, "square", 0.08);
  setTimeout(() => blip(240, 0.12, "square", 0.08), 110);
}

/** 게임 오버 — 하강 스윕. */
export function gameOver(): void {
  thrustStop();
  blip(420, 0.7, "sawtooth", 0.12, 90);
}

/** 분사 루프 — 노이즈 버퍼 1회 생성, 이후엔 세기만 게인으로 조절. */
export function thrust(strength: number): void {
  const ac = audio();
  if (!ac) return;
  if (!thrustNodes) {
    const len = ac.sampleRate * 0.5;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
    thrustNodes = { src, gain };
  }
  thrustNodes.gain.gain.setTargetAtTime(0.05 + strength * 0.09, ac.currentTime, 0.05);
}

export function thrustStop(): void {
  if (!thrustNodes || !ctx) return;
  thrustNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
}
