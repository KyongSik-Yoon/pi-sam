# Read Tool Minimal Display Design

**Date:** 2026-03-03
**Status:** Approved

## Goal

`read` 도구는 기존처럼 파일 내용을 LLM에 전달하되, 기본 TUI 표시에서는 파일 내용 대신 상대 경로만 보이도록 만든다.

## Decisions

- 적용 방식: `read` 도구 오버라이드 + 실행 위임(`createReadTool`)
- 경로 표시: `cwd` 기준 상대 경로
- 기본(접힘) 상태: 결과 본문 미표시
- 확장 상태: 결과 본문 표시

## Architecture

- `src/extensions/minimal-read-renderer.ts` 추가
  - `read` 툴을 동일 이름으로 등록
  - `execute`는 built-in read로 그대로 위임
  - `renderCall`에서 상대 경로 표시
  - `renderResult`에서 `expanded` 상태에 따라 출력 분기
- `src/extensions/index.ts` export 추가
- `src/main.ts` `extensionFactories`에 기본 등록

## UX Rules

- 툴 호출 줄: `read <relative-path>`
- `offset/limit` 있으면 `:<start-end>` 요약 표시
- 접힘 상태에서는 파일 내용을 숨김
- 확장 상태에서는 파일 내용 확인 가능

## Validation Criteria

1. 단위 테스트: 상대 경로 포맷 함수 검증
2. 단위 테스트: 기본/확장 렌더 분기 검증
3. `npm run build` 성공
4. 수동 확인: 기본 표시에서 read 본문이 노출되지 않음
