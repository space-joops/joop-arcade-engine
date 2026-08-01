// SPDX-License-Identifier: AGPL-3.0-only
// 전체 엔트리 — React 컴포넌트 + 코어.
export * from "./core/arcade";
export * as sound from "./core/sound";
export {
  ArcadeGame,
  DEFAULT_ARCADE_LABELS,
  type ArcadeGameProps,
  type ArcadeLabels,
  type ArcadeSummary,
} from "./react/ArcadeGame";
