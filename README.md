# joop-arcade-engine 🛰️

> 우주 쓰레기 수거 아케이드 게임 엔진 — React 컴포넌트 하나로 어디든 붙는 독립 NPM 모듈

**줍스(Joop)** 로봇이 되어 개방형 우주를 관성으로 떠다니며 쓰레기를 수거하는 캔버스 게임입니다.
[space-joops/joop-03](https://github.com/space-joops/joop-03) 프로젝트의 아케이드 모드(PR #64에서
`@joop/arcade-engine`으로 추출된 것)를 누구나 설치·확장할 수 있는 단독 패키지로 재구성했습니다.

- 🎮 **관성 물리** — 마찰 0, 분사를 멈춰도 계속 흘러가는 진짜 우주 비행
- 🕹️ **5원 조이스틱** — 화면 아무 곳이나 드래그, 링 단계(1~5)로 분사 세기 미세 조정 + WASD/방향키
- ⛽ **연료 루프** — 분사할 때만 소모, 소진 후에도 관성으로 ⛽를 주우면 회생
- 🧲 **자석 팔** — 가까운 파편을 끌어당기는 수거 연출
- 🌍 **패럴랙스 우주** — 시드 기반 별밭, 지구/달/태양 천체, 화면 밖 에지 힌트
- 🔊 **합성 효과음** — 오디오 에셋 0개, Web Audio 오실레이터·노이즈 합성
- 📦 **무의존** — 런타임 의존성 없음(react/react-dom 은 peer), 이미지·폰트·CSS 파일 0개
- 🧩 **props 주입형** — 물리 밸런스, UI 문자열(i18n), 색상, 저장, 종료 콜백 전부 커스텀

## 바로 플레이 🕹️

설치 없이 브라우저에서 바로 확인하세요 — 실제 Next.js(App Router) 호스트에 이식된 데모입니다:

**https://joop-arcade-engine-next-demo.vercel.app**

| 페이지 | 보여주는 것 |
| --- | --- |
| [/play](https://joop-arcade-engine-next-demo.vercel.app/play) | `<ArcadeGame>` 최소 통합 + `onGameOver` 활용 |
| [/play/custom](https://joop-arcade-engine-next-demo.vercel.app/play/custom) | 공개 props 전체 — 밸런스·영어 i18n·강조색·무음·저장 키 프리셋 |
| [/headless](https://joop-arcade-engine-next-demo.vercel.app/headless) | `/core` 순수 함수만으로 만든 DOM 렌더러 (렌더러 독립성 실증) |

데모 [소스](https://github.com/space-joops/joop-arcade-engine-next-demo)와
[이식성·모듈화 평가 리포트](https://github.com/space-joops/joop-arcade-engine-next-demo/blob/main/EVALUATION.md)도
공개되어 있습니다. 로컬에서는 클론 후 `npm run dev` 로 Vite 데모를 실행할 수 있습니다.

## 설치

### 릴리스 tarball URL (기본 — 클론·빌드 없이 바로)

[Releases](https://github.com/space-joops/joop-arcade-engine/releases)에 빌드
완료된 패키지가 첨부되어 있어, URL 만으로 몇 초 만에 설치됩니다
(git 불필요, 설치 시 빌드 없음, lock 파일에 integrity 해시 고정):

```bash
npm install https://github.com/space-joops/joop-arcade-engine/releases/download/v0.1.1/joop-arcade-engine-0.1.1.tgz
# peer 의존성
npm install react react-dom
```

pnpm / yarn 도 같은 URL 을 그대로 지원합니다 (`pnpm add <url>`, `yarn add <url>`).

### git 저장소로 설치 (최신 main 추적·개발용)

릴리스 전 최신 코드를 쓰고 싶을 때. npm 이 저장소를 클론한 뒤 `prepare`
스크립트로 자동 빌드하므로 별도 작업은 없지만, 설치가 그만큼 느립니다:

```bash
npm install space-joops/joop-arcade-engine           # 최신 main
npm install space-joops/joop-arcade-engine#v0.1.1    # 태그·커밋 고정
```

### npm 레지스트리 (배포 후)

```bash
npm install joop-arcade-engine
```

## 빠른 시작 (React)

```tsx
import { ArcadeGame } from "joop-arcade-engine";

export default function GamePage() {
  return (
    // 컴포넌트는 부모를 100% 채웁니다 — 부모에 높이를 주세요.
    <div style={{ height: "100dvh" }}>
      <ArcadeGame
        onGameOver={(summary) => {
          console.log(`${summary.collected}조각 수거, ${summary.elapsed.toFixed(1)}초 생존`);
          // 여기서 서버 랭킹 저장 등 호스트 연동
        }}
      />
    </div>
  );
}
```

Next.js(App Router)에서는 그대로 import 하면 됩니다 — 번들에 `"use client"` 배너가 포함되어
클라이언트 컴포넌트로 동작합니다.

### 커스터마이징

```tsx
<ArcadeGame
  config={{ thrust: 1.6, fuel: 150, spawnInterval: 0.5 }} // 물리·밸런스
  accentColor="#ff2e97" // 캐릭터·UI 강조색
  labels={{ title: "My Space Sweeper 🚀", start: "Launch!" }} // i18n / 문구 교체
  storagePrefix="my-game" // localStorage 키 프리픽스 (null = 저장 안 함)
  sound={false} // 효과음 끄기
/>
```

전체 옵션은 [docs/api.md](docs/api.md), 튜닝 감각은 [docs/customization.md](docs/customization.md)를 보세요.

## React 없이 쓰기 (헤드리스 코어)

물리·게임 규칙은 전부 순수 함수라 React 없이도 동작합니다 — 봇 시뮬레이션, 서버 검증,
다른 렌더러(Pixi, Three.js…) 포팅에 그대로 재사용하세요.

```ts
import { applyThrust, joystickInput, DEFAULT_ARCADE_CONFIG } from "joop-arcade-engine/core";

let vel = { x: 0, y: 0 };
const { dir, strength } = joystickInput(40, -30, 100); // 드래그 오프셋 → 방향·세기
vel = applyThrust(vel, dir, strength, 1 / 60, DEFAULT_ARCADE_CONFIG, 100);
```

## Props 요약

| Prop            | 타입                              | 기본값         | 설명                                                    |
| --------------- | --------------------------------- | -------------- | ------------------------------------------------------- |
| `config`        | `Partial<ArcadeConfig>`           | 기본 밸런스    | 추력·최대속도·연료·스폰 간격 등 (재시작 시 반영)        |
| `labels`        | `Partial<ArcadeLabels>`           | 한국어         | 모든 UI 문자열 부분 교체(i18n)                          |
| `accentColor`   | `string`                          | `"#2de2e6"`    | 캐릭터·버튼·이펙트 강조색 (명·암 자동 파생)             |
| `sound`         | `boolean`                         | `true`         | `false`면 효과음·토글 버튼 모두 제거                    |
| `storagePrefix` | `string \| null`                  | `"joop-arcade"` | 최고기록 키 `{prefix}:best`. `null`이면 저장 안 함      |
| `onGameOver`    | `(summary: ArcadeSummary) => void` | —              | 종료 시 호출: `{collected, eaten, elapsed, best, newBest}` |
| `style` / `className` | `CSSProperties` / `string`  | —              | 컨테이너 오버라이드                                     |

## 개발하기

```bash
git clone <repo-url> && cd joop-arcade-engine
npm install
npm run dev        # http://localhost:5173 데모에서 바로 플레이 (HMR)
npm test           # 코어 단위 테스트 (Vitest)
npm run build      # dist/ 에 ESM+CJS+d.ts 산출 (tsup)
npm run typecheck  # 타입 검사
npm run lint       # ESLint
```

### 프로젝트 구조

```
src/
├── core/arcade.ts       # 물리·게임 규칙 — 순수 함수만, DOM/React 없음
├── core/arcade.test.ts  # 코어 단위 테스트
├── core/sound.ts        # Web Audio 합성 효과음 (브라우저 전용, SSR no-op)
├── react/ArcadeGame.tsx # 게임 루프·입력·상태 배선 (컴포넌트 본체)
├── react/render.ts      # 캔버스 드로잉 함수 (별밭·천체·줍스·조이스틱…)
├── react/overlays.tsx   # 시작/종료 화면·텔레메트리 바 (프레젠테이션)
├── react/types.ts       # 공개 타입·기본 라벨 (ArcadeGameProps, ArcadeLabels…)
├── react/theme.ts       # 색 팔레트·스타일·hex 유틸
├── core.ts              # 헤드리스 엔트리 → "joop-arcade-engine/core"
└── index.ts             # 전체 엔트리 → "joop-arcade-engine"
demo/                    # Vite 데모 (npm run dev)
docs/                    # 아키텍처·API·커스터마이징 문서
```

## 커밋 히스토리로 배우기 📜

이 저장소는 **처음부터 순서대로 따라 만들 수 있게** 커밋을 남겼습니다:

```bash
git log --oneline --reverse
```

저장소 초기화 → 도구 설정 → 순수 코어 → 테스트 → 사운드 → React 컴포넌트 → 데모 → 문서
순서로, 각 커밋 메시지에 그 단계의 설계 의도를 적어 두었습니다. 라이브러리를 처음
만들어 보는 분이라면 커밋을 하나씩 체크아웃하며 따라와 보세요.

## 문서

- [docs/architecture.md](docs/architecture.md) — 좌표계·게임 루프·물리 공식·렌더 파이프라인
- [docs/api.md](docs/api.md) — 전체 export 레퍼런스
- [docs/customization.md](docs/customization.md) — 밸런스 튜닝·i18n·새 아이템 추가 튜토리얼
- [CONTRIBUTING.md](CONTRIBUTING.md) — 기여 가이드 (개발 셋업·컨벤션·PR 절차)
- [CHANGELOG.md](CHANGELOG.md) — 버전 이력

## 크레딧 & 라이선스

- 원작 게임 디자인: [space-joops/joop-03](https://github.com/space-joops/joop-03) 의 아케이드 모드 (M5 / EPIC 7)
- [AGPL-3.0](LICENSE) — 이 엔진을 수정해 배포하거나 **웹서비스로 제공**하는 경우,
  해당 서비스 사용자에게 수정된 소스 전체를 공개해야 합니다. 개선이 커뮤니티로
  돌아오게 하기 위한 선택입니다.
- AGPL 조건을 따르기 어려운 상업적 사용은 별도 라이선스 협의가 가능합니다 —
  이슈로 문의해 주세요.
