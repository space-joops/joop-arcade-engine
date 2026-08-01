# 커스터마이징 가이드

코드를 포크하지 않고 props 로 바꿀 수 있는 것과, 포크(기여)해서 바꾸는 것을
나눠 설명합니다.

## 1. 밸런스 튜닝 (`config`)

`Partial<ArcadeConfig>` 만 넘기면 됩니다. 값별 체감:

```tsx
<ArcadeGame config={{ ... }} />
```

| 이렇게 바꾸면 | 이런 게임이 됩니다 |
| --- | --- |
| `thrust: 2.0, maxSpeed: 1.3` | 스피드런 — 기민하지만 제어가 어려움 |
| `thrust: 0.7` | 육중한 화물선 — 미리 계획하는 관성 퍼즐 느낌 |
| `friction: 0.8` | 손을 떼면 스르르 멈추는 캐주얼 조작(관성 정체성은 사라짐) |
| `fuel: 40, fuelItemRatio: 0.2` | 항상 연료가 아슬아슬한 서바이벌 |
| `fuelBurn: 6` | 여유로운 탐험 모드 (풀분사 ~17초) |
| `spawnInterval: 0.35` | 쓰레기 폭풍 — 파밍 쾌감 위주 |
| `spawnInterval: 1.5, fuelItemRatio: 0.05` | 하드코어 — 목표를 골라 다니는 헌팅 |

팁: 튜닝은 데모(`npm run dev`)의 `demo/main.tsx` 에서 config 주석을 풀고
HMR 로 즉시 체감하며 하는 게 가장 빠릅니다.

## 2. 문자열 교체 / i18n (`labels`)

모든 UI 문자열은 `labels` 로 부분 교체합니다. 영어 예:

```tsx
<ArcadeGame
  labels={{
    title: "Space Sweeper 🛰️",
    subtitle: "Drift through space and collect debris.\nInertia is real — you keep moving.",
    howTo: [
      "🕹️ Drag anywhere = thrust (rings set power)",
      "⌨️ WASD / arrow keys work too",
      "⛽ Fuel burns only while thrusting",
      "🧲 A magnet arm pulls in nearby debris",
    ],
    start: "Launch! 🚀",
    score: "COLLECTED",
    gameOver: "Game Over",
    resultCollected: "Collected",
    pieces: "pcs",
    eatenUnit: " items",
    best: "Best",
    newBest: "🏆 New record!",
    retry: "Retry 🔄",
    home: "Home",
    quit: "End",
    fuelOut: "Out of fuel! Grab ⛽ to survive",
    soundOnAria: "Unmute",
    soundOffAria: "Mute",
  }}
/>
```

언어 전환이 있는 앱이라면 언어별 `ArcadeLabels` 객체를 만들어 두고 현재 로케일에
맞는 것을 넘기세요.

## 3. 색상 (`accentColor`)

hex 6자리 색 하나면 캐릭터 몸통(명·암 그라데이션 자동 파생), 시작/재시작 버튼,
저출력 분사염, 자석 팔, 수거 플로터가 함께 바뀝니다.

```tsx
<ArcadeGame accentColor="#ff2e97" /> {/* 마젠타 줍스 */}
```

원작 팔레트: green `#39ff14` · amber `#ffb000` · cyan `#2de2e6` · magenta `#ff2e97`
· lime `#a0ff70` · gold `#ffd25e`

## 4. 호스트 앱 연동 (`onGameOver` + `storagePrefix`)

컴포넌트는 로컬 최고기록만 저장합니다. 서버 랭킹은 `onGameOver` 에서:

```tsx
<ArcadeGame
  storagePrefix={null} // 서버가 기록의 원천이면 로컬 저장은 끈다
  onGameOver={async (summary) => {
    if (summary.collected > 0) {
      await fetch("/api/arcade/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collected: summary.collected, elapsed: summary.elapsed }),
      });
    }
  }}
/>
```

같은 페이지에 게임 인스턴스를 여러 개 두거나(예: 이벤트 모드) 앱별 기록을
분리하려면 `storagePrefix` 를 다르게 주세요 — 키는 `{prefix}:best` 입니다.

## 5. 새 쓰레기 종류 추가하기 (포크/기여)

가장 쉬운 첫 기여입니다. 딱 한 곳만 고치면 됩니다 — `src/core/arcade.ts` 의
`ARCADE_DEBRIS` 배열에 한 줄:

```ts
export const ARCADE_DEBRIS: readonly ArcadeItem[] = [
  // ...기존 6종...
  { id: "battery", emoji: "🔋", kind: "debris", value: 4, size: 0.085 },
];
```

규칙:

1. `id` 는 고유하게, 소문자 영단어로
2. **`value` 와 `size` 는 비례**시키세요 — 큰 목표가 더 값진 게 이 게임의 리듬입니다
   (참고: value 1 → size 0.055, value 5 → size 0.1)
3. 스폰 확률은 자동으로 균등 분배되므로 따로 건드릴 게 없습니다
4. `npm test` 로 기존 테스트가 깨지지 않는지 확인 (`pickArcadeItem` 클램프 테스트가
   배열 길이에 독립적으로 작성돼 있어 그대로 통과해야 정상)

## 6. 천체 추가하기 (포크/기여)

`src/core/arcade.ts` 의 `CELESTIALS` 에 항목을 추가하고,
`src/react/ArcadeGame.tsx` 의 `drawCelestial` 에 새 `kind` 분기를 그립니다.

```ts
// core/arcade.ts — 타입에 kind 추가 후:
{ kind: "mars", x: -4.0, y: 1.2, size: 0.5, parallax: 0.28,
  hint: { color: "#e0704a", glyph: "R" } },
```

배치 팁: 시작점(0,0)에서 2~5 유닛 거리에 사방으로 분산하세요 — 어느 방향으로
날아도 뭔가를 만나는 "탐험 보상"이 이 배경의 목적입니다. `parallax` 는 멀수록
작게(0.15~0.35 권장). 배열 순서가 z-order 라는 점도 기억하세요.

## 7. 효과음 바꾸기 (포크/기여)

`src/core/sound.ts` 는 `blip(freq, dur, type, gain, sweepTo?)` 하나로 대부분의
소리를 만듭니다. 예: 수거음을 더 무겁게 —

```ts
export function collect(n: number): void {
  const step = n % 8;
  blip(260 + step * 30, 0.18, "square", 0.16, 390 + step * 30); // 낮고 두툼하게
}
```

오디오 파일을 쓰고 싶다면? 그건 의도적으로 안 합니다 — **에셋 0개**가 이
패키지의 설치 경험(번들 사이즈, 로딩, CORS 무관)을 지키는 원칙입니다. 파일 기반
사운드가 필요하면 `sound: false` 로 끄고 호스트에서 직접 재생하세요.

## 8. 다른 렌더러로 포팅 (고급)

`joop-arcade-engine/core` 만 import 하면 물리·규칙·밸런스를 그대로 가진
Pixi/Three.js/네이티브 캔버스 버전을 만들 수 있습니다. 게임 루프에서 할 일:

```ts
import {
  DEFAULT_ARCADE_CONFIG, applyThrust, joystickInput,
  collides, pickArcadeItem, starHash,
} from "joop-arcade-engine/core";

// 매 프레임:
// 1) 입력 → joystickInput
// 2) vel = applyThrust(...); pos += vel*dt
// 3) 스폰 타이머 → pickArcadeItem(cfg, Math.random(), Math.random())
// 4) collides(joop, r, item, item.size/2) → 수거
// 렌더는 마음대로 — 규칙은 core 가 보장한다
```

루프의 정확한 단계 순서는 [architecture.md](architecture.md) 를 참고하세요.
