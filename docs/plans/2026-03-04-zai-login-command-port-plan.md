# Z.AI 로그인 UX 포팅 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** oh-my-pi 방식의 Z.AI 로그인 UX(브라우저 안내 + API 키 입력 + 유효성 검증 + 저장)를 pi-sam에 안전하게 포팅한다.

**Architecture:** `/zai-login` 커맨드를 extension으로 추가해 UI에서 API 키를 입력받고, `chat/completions` 검증 호출 후 `auth.json`에 `api_key` 타입으로 저장한다. 기존 `/login` 흐름은 건드리지 않아 리스크를 낮춘다.

**Tech Stack:** TypeScript, pi-coding-agent Extension API, node:test

---

### Task 1: 검증/정규화 유틸 TDD

**Files:**
- Create: `src/extensions/zai-login-command.ts`
- Create: `src/extensions/zai-login-command.test.ts`

1. failing test 작성: 입력값 정규화(공백/"Bearer "/"Authorization: Bearer" 제거)
2. failing test 작성: 검증 요청 body/header가 oh-my-pi와 동일한지 확인
3. 테스트 실행해 실패 확인
4. 최소 구현으로 테스트 통과
5. 테스트 재실행

### Task 2: slash command 등록

**Files:**
- Modify: `src/extensions/index.ts`
- Modify: `src/main.ts`

1. `/zai-login` 커맨드 구현
   - 브라우저 안내 URL 표시
   - API 키 입력
   - 검증
   - `ctx.modelRegistry.authStorage.set("zai", { type: "api_key", key })` 저장
2. 빌드/테스트 실행

### Task 3: 사용자 안내

**Files:**
- Modify: `README.md`

1. 인증 섹션에 `/zai-login` 사용법 추가
2. 검증 명령/실패 시 가이드 추가
