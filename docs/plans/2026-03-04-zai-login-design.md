# ZAI API 키 로그인 기능 설계

## 개요

`/login zai` 명령어로 ZAI(GLM) API 키를 인터랙티브하게 입력받아 `~/.pi-sam/agent/auth.json`에 저장하는 기능.

## 동작 흐름

1. 사용자가 `/login` 입력 → 프로바이더 목록에 **"ZAI (GLM)"** 표시
2. ZAI 선택 → "ZAI API 키를 입력하세요:" 프롬프트 표시
3. 사용자가 API 키 입력 → `auth.json`에 `{ "zai": { "type": "api_key", "key": "..." } }` 형식으로 저장
4. 저장 성공 메시지 + ZAI 모델 사용 가능 상태 확인

## 구현 방식

pi SDK의 `pi.registerProvider()` OAuth 인터페이스를 활용:

- `oauth.login()` 에서 `callbacks.onPrompt()`로 API 키 입력 받기
- `oauth.getApiKey()`에서 저장된 키 반환
- `oauth.refreshToken()`은 키가 만료되지 않으므로 그대로 반환

## 영향 범위

- **새 파일**: `src/extensions/zai-login.ts`
- **수정 파일**: `src/extensions/index.ts`, `src/main.ts`

## 저장 위치

- `~/.pi-sam/agent/auth.json` (기존 AuthStorage 활용)
