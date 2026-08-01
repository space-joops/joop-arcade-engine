# Changelog

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식과
[SemVer](https://semver.org/lang/ko/) 를 따릅니다.

## [Unreleased]

### Changed

- 라이선스를 MIT 에서 **AGPL-3.0** 으로 전환 — 수정본을 배포하거나 네트워크
  서비스로 제공할 때 소스 공개를 의무화해, 개선이 커뮤니티로 돌아오도록 보호

## [0.1.0] - 2026-08-01

### Added

- 순수 코어 모듈 (`joop-arcade-engine/core`)
  - 관성 물리 `applyThrust` (마찰 0, 최대 속도 제한, 시간 기반)
  - 5원 조이스틱 변환 `joystickInput` (데드존 8px, 세기 5단계)
  - 원-원 충돌 `collides`, 순수 스폰 선택 `pickArcadeItem`
  - 쓰레기 6종 + 연료 아이템 밸런스 데이터
  - 천체 배치 `CELESTIALS`, 태양 틴트 `sunTintAlpha`, 시드 별밭 해시 `starHash`
- Web Audio 합성 효과음 (`sound` 네임스페이스) — 오디오 에셋 0개
- React 컴포넌트 `<ArcadeGame />`
  - 캔버스 렌더(패럴랙스 별밭·천체·분사 파티클·자석 팔·이모지 아이템)
  - 포인터 조이스틱 + WASD/방향키 입력
  - props: `config` / `labels`(i18n) / `accentColor` / `sound` / `storagePrefix` / `onGameOver`
  - 연료 소진 4초 회생 유예, localStorage 최고 기록
- Vite 데모 (`npm run dev`), Vitest 코어 테스트 25종
- 문서: README, 아키텍처, API 레퍼런스, 커스터마이징 가이드, 기여 가이드,
  행동 강령, 이슈/PR 템플릿

[0.1.0]: https://github.com/space-joops/joop-arcade-engine/releases/tag/v0.1.0
