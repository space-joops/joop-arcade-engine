# API 레퍼런스

두 엔트리를 제공합니다:

```ts
import { ArcadeGame, applyThrust, ... } from "joop-arcade-engine";        // 전체
import { applyThrust, sound, ... } from "joop-arcade-engine/core";       // React 불필요
```

---

## React

### `<ArcadeGame />`

게임 전체(캔버스·입력·HUD·시작/종료 화면)를 담는 클라이언트 컴포넌트.
**부모 요소를 100% 채우므로 부모에 높이가 있어야 합니다.**

```tsx
<div style={{ height: "100dvh" }}>
  <ArcadeGame onGameOver={(s) => saveScore(s.collected)} />
</div>
```

#### Props (`ArcadeGameProps`)

| Prop | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `config` | `Partial<ArcadeConfig>` | `DEFAULT_ARCADE_CONFIG` | 물리·밸런스 오버라이드. **게임 시작 시점에 캡처**되어 그 판에 고정 — 도중에 바꾸면 다음 판부터 반영 |
| `labels` | `Partial<ArcadeLabels>` | `DEFAULT_ARCADE_LABELS`(한국어) | UI 문자열 부분 교체. 렌더 즉시 반영 |
| `accentColor` | `string`(hex) | `"#2de2e6"` | 캐릭터 몸통·버튼·자석 팔·플로터 색. 명·암 변형은 자동 파생 |
| `sound` | `boolean` | `true` | `false`면 모든 효과음 비활성 + 토글 버튼 숨김 |
| `storagePrefix` | `string \| null` | `"joop-arcade"` | 최고기록을 `{prefix}:best` 키로 localStorage 저장. `null`이면 저장하지 않음 |
| `onGameOver` | `(summary: ArcadeSummary) => void` | — | 연료 소진·조기 종료 시 1회 호출 |
| `style` | `CSSProperties` | — | 루트 컨테이너 스타일 병합 |
| `className` | `string` | — | 루트 컨테이너 클래스 |

#### `ArcadeSummary`

```ts
type ArcadeSummary = {
  collected: number; // 수거한 조각 수(아이템 가치 합)
  eaten: number;     // 수거한 아이템 개수
  elapsed: number;   // 플레이 시간(초)
  best: number;      // 저장된 최고 기록(이번 판 반영 후)
  newBest: boolean;  // 이번 판이 신기록인지
};
```

#### `ArcadeLabels` / `DEFAULT_ARCADE_LABELS`

시작 화면(`title`, `subtitle`, `howTo[]`, `start`), HUD(`score`, `quit`),
결과 화면(`gameOver`, `resultCollected`, `pieces`, `eatenUnit`, `best`, `newBest`,
`retry`, `home`), 캔버스 안내(`fuelOut`), 접근성(`soundOnAria`, `soundOffAria`)의
전 문자열. `labels={{ ... }}` 로 일부만 덮어쓰면 됩니다.

---

## Core — 설정과 데이터

### `ArcadeConfig` / `DEFAULT_ARCADE_CONFIG`

| 필드 | 기본값 | 단위 | 게임플레이 의미 |
| --- | --- | --- | --- |
| `thrust` | `1.2` | units/s² | 최대 가속. 높이면 기민해지고 낮추면 무거운 우주선 느낌 |
| `maxSpeed` | `0.9` | units/s | 속도 상한. 1.0이면 1초에 화면 최소변만큼 이동 |
| `fuel` | `100` | — | 초기·최대 연료 |
| `fuelBurn` | `12` | /s | 풀분사(세기 1.0) 시 초당 소모. 기본값이면 풀분사 약 8.3초 |
| `friction` | `0` | /s | 0 = 관성 유지(정체성!). 올리면 아케이드식 감속 |
| `spawnInterval` | `0.7` | s | 아이템 생성 간격. 낮출수록 쓰레기밭 밀도 상승 |
| `fuelItemRatio` | `0.12` | 0~1 | 생성 아이템 중 연료 비율. 생존 난이도 조절기 |

### `ArcadeItem` / `ARCADE_DEBRIS` / `ARCADE_FUEL_ITEM`

```ts
type ArcadeItem = {
  id: string;              // "can" | "bolt" | ...
  emoji: string;           // 렌더에 쓰는 이모지
  kind: "debris" | "fuel";
  value: number;           // 수거 조각 수(debris) / 충전량(fuel)
  size: number;            // 월드 단위 지름 (충돌 판정에도 사용)
};
```

기본 쓰레기 6종: 🥫 can(3) · 🔩 bolt(1) · ⚙️ nut(1) · 📡 panel(5) · 📏 strut(3) · 💾 chip(2)
— 가치가 높을수록 size 도 큽니다(크고 느긋한 목표 vs 작고 흔한 목표).

### `Celestial` / `CELESTIALS` / `SUN_POS`

배경 천체(지구·달·태양)의 월드 좌표·크기·parallax·에지 힌트 정의.
배열 순서 = z-order.

---

## Core — 함수

### `applyThrust(vel, dir, strength, dt, cfg, fuel): Vec`

한 프레임의 분사를 적용한 새 속도를 반환(원본 불변).
`dir`이 `null`이거나 `fuel ≤ 0`이면 가속 없이 마찰·상한만 적용됩니다.

```ts
vel = applyThrust(vel, { x: 1, y: 0 }, 0.6, dt, cfg, fuel);
```

### `joystickInput(dx, dy, ringRadius): { dir, strength, ring }`

드래그 오프셋(px)을 조작 입력으로 변환. 데드존(8px) 안이면
`{ dir: null, strength: 0, ring: 0 }`. `ring`은 1~5(시각화용),
`strength = ring / 5`.

### `collides(a, ar, b, br): boolean`

원-원 충돌. 중심 거리 < 반지름 합이면 `true`(경계는 미충돌).

### `pickArcadeItem(cfg, kindRoll, pickRoll): ArcadeItem`

스폰할 아이템 선택. **난수를 인자로 받는 순수 함수**라 테스트·리플레이가
가능합니다. `kindRoll < cfg.fuelItemRatio` → 연료, 아니면 `pickRoll`로
쓰레기 6종 균등 선택(인덱스 클램프).

### `starHash(ix, iy, k): number`

정수 좌표 `(ix, iy)` + 채널 `k` → `[0, 1]` 결정적 의사난수.
패럴랙스 별밭·장식 입자의 위치/크기/색을 프레임 무관하게 고정하는 데 씁니다.

### `sunTintAlpha(camX, camY): number`

카메라와 태양의 거리로 화면 앰버 틴트 알파(0~0.08)를 보간.

---

## Core — `sound` 네임스페이스

```ts
import { sound } from "joop-arcade-engine/core";
```

| 함수 | 설명 |
| --- | --- |
| `sound.collect(n)` | 수거 블립. `n`(누적 수거 수)에 따라 피치 상승(콤보감) |
| `sound.fuelPickup()` | 연료 충전 스윕 |
| `sound.fuelWarn()` | 저연료 이중 펄스(호출 간격은 호출자가 관리) |
| `sound.thrust(strength)` | 분사 노이즈 루프 시작/세기 조절(프레임마다 호출해도 안전) |
| `sound.thrustStop()` | 분사음 페이드 아웃 |
| `sound.gameOver()` | 하강 스윕 |
| `sound.isMuted()` / `sound.setMuted(v)` | 음소거 상태(localStorage `"joop-arcade:muted"` 지속) |

모두 브라우저 전용이며 SSR 에서는 조용히 no-op 합니다.
