# 기여 가이드

joop-arcade-engine 에 관심 가져주셔서 감사합니다! 🛰️
이 문서는 처음 기여하는 분도 막힘 없이 PR 을 올릴 수 있도록 전 과정을 안내합니다.

## 목차

1. [어떤 기여를 할 수 있나요](#어떤-기여를-할-수-있나요)
2. [개발 환경 셋업](#개발-환경-셋업)
3. [저장소 구조와 손댈 곳 찾기](#저장소-구조와-손댈-곳-찾기)
4. [코드 컨벤션](#코드-컨벤션)
5. [테스트](#테스트)
6. [커밋 컨벤션](#커밋-컨벤션)
7. [브랜치와 PR 절차](#브랜치와-pr-절차)
8. [리뷰에서 보는 것](#리뷰에서-보는-것)
9. [릴리스 절차](#릴리스-절차)

---

## 어떤 기여를 할 수 있나요

- 🐛 **버그 리포트** — [이슈 템플릿](.github/ISSUE_TEMPLATE/bug_report.md)으로.
  재현 절차가 있으면 반이 해결된 겁니다.
- 💡 **기능 제안** — 구현 전에 이슈로 먼저 논의해 주세요. 이 게임은 "관성 물리 +
  수거 루프"라는 단순한 정체성을 지키는 걸 중요하게 생각합니다.
- 📝 **문서** — 오타 수정부터 번역, 예제 추가까지 모두 환영. 문서만 고치는 PR 은
  이슈 없이 바로 올려도 됩니다.
- 🎮 **코드** — 좋은 첫 기여 예: 새 쓰레기 종류 추가
  ([튜토리얼](docs/customization.md#5-새-쓰레기-종류-추가하기-포크기여)), 새 천체,
  밸런스 프리셋, 효과음 개선, 접근성 향상.

## 개발 환경 셋업

요구사항: **Node.js 20 이상**, npm.

```bash
git clone https://github.com/<your-fork>/joop-arcade-engine
cd joop-arcade-engine
npm install
npm run dev   # http://localhost:5173 — 데모에서 바로 플레이하며 개발
```

`demo/main.tsx` 가 곧 놀이터입니다. vite alias 덕분에 `src/` 수정이 빌드 없이
HMR 로 즉시 반영됩니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 데모 개발 서버 (HMR) |
| `npm test` | 코어 단위 테스트 1회 실행 |
| `npm run test:watch` | 테스트 워치 모드 |
| `npm run typecheck` | `tsc --noEmit` 타입 검사 |
| `npm run lint` | ESLint (src + demo) |
| `npm run format` | Prettier 전체 포맷 |
| `npm run build` | dist/ 에 ESM+CJS+d.ts 산출 — PR 전 1회 확인 권장 |

## 저장소 구조와 손댈 곳 찾기

```
src/core/arcade.ts        # 물리·규칙·밸런스 데이터 (순수 함수만!)
src/core/arcade.test.ts   # 코어 테스트 — 코어를 고치면 여기도
src/core/sound.ts         # 효과음 합성 (브라우저 전용)
src/react/ArcadeGame.tsx  # 게임 루프·입력·상태 배선 (컴포넌트 본체)
src/react/render.ts       # 캔버스 드로잉 함수 (그리기만, 상태 변경 없음)
src/react/overlays.tsx    # 시작/종료 화면·텔레메트리 바
src/react/types.ts        # 공개 타입·기본 라벨
src/react/theme.ts        # 색 팔레트·스타일
demo/                     # 개발용 놀이터
docs/                     # 상세 문서 — 동작을 바꾸면 여기도 갱신
```

**무엇을 고치려면 어디를?**

| 하고 싶은 것 | 파일 |
| --- | --- |
| 밸런스 기본값 변경 | `src/core/arcade.ts` 의 `DEFAULT_ARCADE_CONFIG` |
| 새 아이템/천체 | `src/core/arcade.ts` (+ 천체는 `render.ts` 의 `drawCelestial` 분기) |
| 물리 규칙 | `src/core/arcade.ts` 의 `applyThrust` 등 + **테스트 필수** |
| 그래픽·연출 | `src/react/render.ts` 의 draw* 함수들 |
| 색·스타일 | `src/react/theme.ts` |
| 시작/종료 화면·하단 바 | `src/react/overlays.tsx` |
| 조작감·게임 루프 | `joystickInput`(코어) 또는 `src/react/ArcadeGame.tsx` |
| 효과음 | `src/core/sound.ts` |
| UI 문자열 | `src/react/types.ts` 의 `DEFAULT_ARCADE_LABELS` |

시작 전에 [docs/architecture.md](docs/architecture.md)를 한 번 읽어보세요 —
게임 루프의 단계 순서와 설계 불변식이 정리되어 있습니다.

## 코드 컨벤션

기계적인 것은 도구가 강제합니다(`npm run lint`, `npm run format`). 아래는
도구가 못 잡는 **설계 원칙**입니다:

1. **core 는 순수하게.** `src/core/arcade.ts` 에는 부수효과·DOM·React 가 들어갈 수
   없습니다. 난수가 필요하면 `pickArcadeItem(cfg, kindRoll, pickRoll)` 처럼
   **난수를 인자로** 받으세요. 이 원칙이 테스트 가능성과 헤드리스 사용을 지킵니다.
2. **의존 방향은 `react → core` 단방향.** core 가 react 를 import 하면 안 됩니다.
3. **물리는 시간(dt) 기반.** `x += 3` 같은 프레임 기반 수치는 주사율에 따라 체감이
   달라집니다. 반드시 `x += v * dt` 형태로.
4. **프레임당 setState 금지.** 매 프레임 갱신되는 값(점수, 연료 바)은 ref 로 DOM 을
   직접 조작합니다. React 상태는 phase 전환에만.
5. **에셋 0개 원칙.** 이미지·오디오·폰트 파일을 추가하지 않습니다. 그리기는 캔버스
   도형·이모지로, 소리는 Web Audio 합성으로.
6. **주석은 "왜"를 씁니다.** 상수 하나에도 의도를 남기는 것이 이 코드베이스의
   스타일입니다 (예: "dt 0.05s 클램프 — 탭 복귀 시 시간 도약을 버린다").
7. **밸런스 변경은 근거와 함께.** `DEFAULT_ARCADE_CONFIG`·아이템 value/size·자석
   상수를 바꾸는 PR 은 "어떻게 플레이해 보니 어땠는지"를 PR 설명에 적어주세요.

## 테스트

- 코어(순수 함수)를 고치면 `src/core/arcade.test.ts` 에 테스트를 추가/수정하세요.
  DOM 없는 node 환경이라 빠릅니다(전체 <1초).
- 테스트 이름은 한국어 서술형으로, 동작을 문장으로 설명합니다:

```ts
it("연료가 없으면 가속하지 않는다(관성만 유지)", () => {
  const v = applyThrust({ x: 0.3, y: -0.1 }, { x: 1, y: 0 }, 1, 0.5, cfg, 0);
  expect(v).toEqual({ x: 0.3, y: -0.1 });
});
```

- 컴포넌트(렌더·입력)는 현재 자동 테스트가 없습니다 — 데모에서 수동 확인 후
  PR 설명에 확인한 시나리오를 적어주세요. (컴포넌트 테스트 인프라 기여도 환영!)
- 최소 확인 시나리오: 시작 → 드래그/키보드 이동 → 수거 → 연료 소진 게임 오버 →
  다시하기, 콘솔 에러 없음.

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/ko/) 를 따릅니다:

```
<타입>(<범위>): <제목 — 한국어, 명령형>

<본문(선택) — 무엇을/왜. 어떻게는 코드가 말합니다>
```

- 타입: `feat` `fix` `docs` `test` `refactor` `perf` `chore`
- 범위(선택): `core` `react` `sound` `demo`
- 예:
  - `feat(core): 배터리 쓰레기 종류 추가`
  - `fix(react): 조이스틱 해제 후 잔여 분사음이 남는 문제 수정`
  - `docs: customization 가이드에 프리셋 예시 추가`

이 저장소의 `git log --oneline --reverse` 를 보면 실제 예시가 그대로 있습니다.

## 브랜치와 PR 절차

1. 저장소를 **포크**하고 `main` 에서 브랜치를 만듭니다:
   `feat/battery-debris`, `fix/joystick-release` 처럼 타입/요약 형식 권장
2. 작업 후 셀프 체크:
   ```bash
   npm test && npm run typecheck && npm run lint && npm run build
   ```
3. 동작이 바뀌었으면 **문서도 같은 PR 에서** 갱신합니다
   (README 의 표, docs/, 필요하면 CHANGELOG 의 Unreleased 섹션)
4. PR 을 올리면 [템플릿](.github/PULL_REQUEST_TEMPLATE.md)의 체크리스트를 채웁니다
5. PR 은 **작게** — 한 PR 은 한 가지 변경. 밸런스 변경과 리팩터링을 섞지 마세요

## 리뷰에서 보는 것

리뷰어(그리고 미래의 당신)는 이 순서로 봅니다:

1. **정체성** — 관성 물리·수거 루프·에셋 0개 원칙을 해치지 않는가
2. **설계 불변식** — core 순수성, 단방향 의존, dt 기반 물리, 루프 단계 순서
3. **테스트** — 코어 변경에 테스트가 따라왔는가
4. **문서** — 동작 변경이 docs 에 반영됐는가
5. 스타일은 도구가 봅니다 — 사람이 스타일로 왕복하지 않습니다

## 릴리스 절차

(메인테이너용) [SemVer](https://semver.org/lang/ko/) 를 따릅니다:

- **patch**: 버그 수정, 문서
- **minor**: 하위 호환 기능 추가(새 아이템, 새 prop)
- **major**: props/exports 파괴적 변경, 게임 규칙의 근본 변경

```bash
# 1. CHANGELOG.md 의 Unreleased 를 버전으로 확정
# 2. package.json version 올리기 (git 태그도 함께 생성됨)
npm version minor
# 3. 빌드·테스트 최종 확인
npm test && npm run build
# 4. 푸시 + GitHub Release 생성
git push --follow-tags
gh release create vX.Y.Z --title "vX.Y.Z" --notes "..."
# 5. 빌드된 패키지 tarball 을 릴리스에 첨부 — 설치 기본 경로!
#    (README 의 tarball URL 설치가 이걸 참조한다. 반드시 업로드할 것)
npm pack
gh release upload vX.Y.Z joop-arcade-engine-X.Y.Z.tgz
# 6. (npm 레지스트리 배포 시) npm publish
```

## 기여물의 라이선스

이 프로젝트는 [AGPL-3.0](LICENSE) 입니다. PR 을 올리면 여러분의 기여물도 같은
라이선스로 제공하는 것에 동의하는 것으로 간주합니다(inbound = outbound).
별도의 CLA 는 없습니다.

---

질문이 있으면 부담 없이 이슈로 물어보세요. 첫 기여를 환영합니다! 🚀
