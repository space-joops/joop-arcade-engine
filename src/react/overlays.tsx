// SPDX-License-Identifier: AGPL-3.0-only
// 시작/종료 화면과 텔레메트리 바 — 상태 없는 프레젠테이션 컴포넌트.
// 게임 상태는 전부 props 로 받는다. 문자열은 ArcadeLabels(i18n 교체 가능).

import type { ReactNode, RefObject } from "react";
import {
  AMBER,
  FG_DIM,
  barBtnStyle,
  ghostBtnStyle,
  overlayStyle,
  primaryBtnStyle,
} from "./theme";
import type { ArcadeLabels, ArcadeSummary } from "./types";

const renderMultiline = (text: string): ReactNode =>
  text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line}
    </span>
  ));

/** 시작 화면 — 타이틀·조작 안내·출동 버튼. */
export function ReadyOverlay({
  labels,
  accent,
  onStart,
}: {
  labels: ArcadeLabels;
  accent: string;
  onStart: () => void;
}) {
  return (
    <div style={overlayStyle}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          {labels.title}
        </h1>
        <p style={{ marginTop: 12, maxWidth: 384, fontSize: 14, lineHeight: 1.6, color: FG_DIM }}>
          {renderMultiline(labels.subtitle)}
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
        {labels.howTo.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button onClick={onStart} style={{ ...primaryBtnStyle(accent), fontSize: 18 }}>
        {labels.start}
      </button>
    </div>
  );
}

/** 게임 오버 화면 — 수거 결과·최고 기록·다시하기. */
export function GameOverOverlay({
  labels,
  accent,
  summary,
  onRetry,
  onHome,
}: {
  labels: ArcadeLabels;
  accent: string;
  summary: ArcadeSummary;
  onRetry: () => void;
  onHome: () => void;
}) {
  return (
    <div style={overlayStyle}>
      <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{labels.gameOver}</h2>
      <div>
        <p style={{ fontSize: 18, margin: 0 }}>
          {labels.resultCollected}{" "}
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
          {labels.pieces} · {summary.eaten}
          {labels.eatenUnit}
        </p>
        <p style={{ marginTop: 8, fontSize: 14, color: FG_DIM }}>
          {summary.newBest ? (
            <span style={{ fontWeight: 700, color: AMBER }}>{labels.newBest}</span>
          ) : (
            <>
              🏆 {labels.best} {summary.best.toLocaleString()} {labels.pieces}
            </>
          )}
        </p>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onRetry} style={primaryBtnStyle(accent)}>
          {labels.retry}
        </button>
        <button onClick={onHome} style={ghostBtnStyle}>
          {labels.home}
        </button>
      </div>
    </div>
  );
}

/** 하단 텔레메트리 바 — 연료 게이지(fuelFillRef 로 루프가 직접 갱신)·음소거·종료. */
export function TelemetryBar({
  labels,
  muted,
  showSound,
  showQuit,
  fuelFillRef,
  onToggleMute,
  onQuit,
}: {
  labels: ArcadeLabels;
  muted: boolean;
  showSound: boolean;
  showQuit: boolean;
  fuelFillRef: RefObject<HTMLDivElement | null>;
  onToggleMute: () => void;
  onQuit: () => void;
}) {
  return (
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
        style={{ height: 10, flex: 1, overflow: "hidden", borderRadius: 9999, background: "#1c2b45" }}
      >
        <div
          ref={fuelFillRef}
          style={{ height: "100%", width: "100%", borderRadius: 9999, background: AMBER }}
        />
      </div>
      {showSound && (
        <button
          onClick={onToggleMute}
          aria-label={muted ? labels.soundOnAria : labels.soundOffAria}
          style={barBtnStyle}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}
      {showQuit && (
        <button onClick={onQuit} style={barBtnStyle}>
          {labels.quit}
        </button>
      )}
    </div>
  );
}
