# pi-sam Startup Header Design

**Date:** 2026-03-03
**Status:** Approved

## 목표

`pi-sam` 실행 시 기본 헤더를 `pi-sam` 브랜딩 ASCII 로고(캐릭터/심볼 + 텍스트)로 교체하고, 핵심 단축키와 버전을 함께 노출한다.

## 결정 사항

- 적용 범위: **pi-sam 기본 내장** (프로젝트/사용자 수동 설정 불필요)
- 표시 스타일: **캐릭터/심볼 + `pi-sam` 텍스트**
- 레이아웃: **혼합형** (브랜딩 + 핵심 정보)
- 로고 크기: **소형 (5~7줄)**
- 하단 정보: **`/help · /model · /resume` + `v{VERSION}`**

## 아키텍처

브랜딩 헤더를 기존 워크플로우 확장(`workflow-extension`)과 분리해 전용 확장으로 구성한다.

- 신규 파일 `src/extensions/branding-header.ts`
  - `session_start` 이벤트에서 `ctx.ui.setHeader()`로 헤더를 교체
  - `ctx.hasUI`가 `true`일 때만 동작하도록 가드
- `src/extensions/index.ts`에서 신규 확장 export
- `src/main.ts` `DefaultResourceLoader`의 `extensionFactories`에 신규 확장 등록

이 구조는 기능 책임을 분리하고, 추후 브랜딩/헤더만 독립적으로 수정할 수 있다.

## 표시/렌더링 설계

- 헤더 렌더링은 `theme.fg(...)` 기반으로 구성해 다크/라이트/커스텀 테마 자동 대응
- 고정 ANSI 컬러 코드는 사용하지 않음
- 소형 ASCII 캐릭터 + `pi-sam` 로고 텍스트 + 메타 라인(단축키/버전) 순서로 출력

## 에러/호환성 처리

- print/json/rpc 모드에서는 `setHeader`가 무의미하거나 no-op일 수 있으므로 `ctx.hasUI` 가드로 안전 처리
- 기존 워크플로우 명령(`/autopilot`, `/plan`, `/review`)에는 영향 없음

## 검증 기준

1. `npm run build` 성공
2. `pi-sam` 실행 시 시작 헤더에 다음이 표시됨
   - 소형 ASCII 캐릭터
   - `pi-sam` 텍스트
   - `/help · /model · /resume` 및 버전
3. 기존 워크플로우 동작 회귀 없음
