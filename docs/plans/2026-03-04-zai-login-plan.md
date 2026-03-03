# ZAI API 키 로그인 기능 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/login zai` 명령어로 ZAI API 키를 인터랙티브하게 입력받아 auth.json에 저장하는 기능 구현

**Architecture:** pi SDK의 `pi.registerProvider()` OAuth 인터페이스를 활용하여 ZAI 프로바이더를 등록. `oauth.login()`에서 `callbacks.onPrompt()`로 API 키를 입력받고, credentials로 래핑하여 저장. 키는 만료되지 않으므로 `refreshToken()`은 그대로 반환.

**Tech Stack:** TypeScript, pi-coding-agent SDK (`ExtensionAPI`, `registerProvider`, `OAuthCredentials`)

---

### Task 1: ZAI 로그인 확장 파일 생성

**Files:**
- Create: `src/extensions/zai-login.ts`

**Step 1: 확장 파일 작성**

```typescript
import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

/**
 * ZAI(GLM) API 키 로그인 확장.
 * /login 메뉴에 "ZAI (GLM)" 옵션을 추가하여
 * API 키를 인터랙티브하게 입력받아 auth.json에 저장합니다.
 */
export const zaiLoginExtension: ExtensionFactory = (pi) => {
	pi.registerProvider("zai", {
		oauth: {
			name: "ZAI (GLM)",

			async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
				const apiKey = await callbacks.onPrompt({
					message: "ZAI API 키를 입력하세요 (https://open.bigmodel.cn 에서 발급):",
				});

				if (!apiKey || apiKey.trim().length === 0) {
					throw new Error("API 키가 입력되지 않았습니다.");
				}

				return {
					refresh: "",
					access: apiKey.trim(),
					expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000, // 10년 (만료 없음)
				};
			},

			async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
				return credentials;
			},

			getApiKey(credentials: OAuthCredentials): string {
				return credentials.access;
			},
		},
	});
};
```

**Step 2: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공

**Step 3: 커밋**

```bash
git add src/extensions/zai-login.ts
git commit -m "feat: ZAI(GLM) API 키 로그인 확장 추가"
```

---

### Task 2: 확장 등록

**Files:**
- Modify: `src/extensions/index.ts`
- Modify: `src/main.ts`

**Step 1: index.ts에 export 추가**

`src/extensions/index.ts`에 다음 줄 추가:

```typescript
export { zaiLoginExtension } from "./zai-login.js";
```

**Step 2: main.ts의 import에 zaiLoginExtension 추가**

import 행에 `zaiLoginExtension` 추가:

```typescript
import { workflowExtension, brandingHeaderExtension, minimalReadRendererExtension, customToolsExtension, zaiLoginExtension } from "./extensions/index.js";
```

**Step 3: main.ts의 extensionFactories 배열에 추가**

`extensionFactories` 배열의 `customToolsExtension(cwd, agentDir)` 뒤에 추가:

```typescript
extensionFactories: [
    kotlinGuardHook,
    ktorHelperHook(cwd),
    workflowExtension(workflowCtx),
    brandingHeaderExtension,
    minimalReadRendererExtension,
    customToolsExtension(cwd, agentDir),
    zaiLoginExtension,
],
```

**Step 4: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공

**Step 5: 커밋**

```bash
git add src/extensions/index.ts src/main.ts
git commit -m "feat: ZAI 로그인 확장을 메인 파이프라인에 등록"
```

---

### Task 3: 수동 검증

**Step 1: 실행 확인**

Run: `npm run dev`

인터랙티브 모드 진입 후 `/login` 입력 시 **"ZAI (GLM)"** 옵션이 목록에 나타나는지 확인.

**Step 2: README 업데이트 (선택)**

인증 섹션에 ZAI 로그인 방법 추가는 필요 시 별도로 진행.
