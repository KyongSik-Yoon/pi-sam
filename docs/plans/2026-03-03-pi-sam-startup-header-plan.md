# pi-sam Startup Header Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a built-in branded startup header for `pi-sam` using small ASCII art plus key shortcuts and version.

**Architecture:** Add a dedicated extension (`branding-header.ts`) that sets a custom header on `session_start` via `ctx.ui.setHeader()`. Register it in extension exports and in `main.ts` `extensionFactories` so it is enabled by default for every `pi-sam` interactive launch.

**Tech Stack:** TypeScript, `@mariozechner/pi-coding-agent` extension API (`ExtensionFactory`, `ctx.ui.setHeader()`), existing `VERSION` config.

---

### Task 1: Add branding header extension skeleton

**Files:**
- Create: `src/extensions/branding-header.ts`
- Test: `npm run build`

**Step 1: Write a failing compile expectation (TDD seed)**

임시로 새 파일에서 `ExtensionFactory` 타입과 default export만 선언하지 않은 상태로 build를 실행해, 새 파일/심볼이 필요함을 확인한다.

Run: `npm run build`
Expected: FAIL (new extension file/symbol not found once wired in next tasks)

**Step 2: Create minimal extension implementation**

```ts
import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { VERSION } from "../config.js";

export const brandingHeaderExtension: ExtensionFactory = (pi) => {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setHeader((_tui, theme) => ({
      render(): string[] {
        return [
          theme.fg("accent", "  ▗▄▄▖ ▗▄▄▄▖"),
          theme.fg("accent", "  ▐▌ ▐▌  █  "),
          theme.fg("accent", "  ▐▛▀▚▖  █  "),
          theme.fg("accent", "  ▐▌ ▐▌▗▄█▄▖"),
          theme.fg("accent", "   pi-sam"),
          theme.fg("muted", "   /help · /model · /resume") + theme.fg("dim", `  v${VERSION}`),
        ];
      },
      invalidate() {},
    }));
  });
};
```

**Step 3: Run build to verify compile passes for this file alone**

Run: `npm run build`
Expected: PASS (assuming not yet referenced elsewhere)

**Step 4: Commit**

```bash
git add src/extensions/branding-header.ts
git commit -m "feat: add branding header extension"
```

---

### Task 2: Register extension in extension barrel and app bootstrap

**Files:**
- Modify: `src/extensions/index.ts`
- Modify: `src/main.ts`
- Test: `npm run build`

**Step 1: Update extension barrel exports**

```ts
export { workflowExtension } from "./workflow-extension.js";
export { brandingHeaderExtension } from "./branding-header.js";
```

**Step 2: Wire extension into `main.ts`**

- import 추가:

```ts
import { workflowExtension, brandingHeaderExtension } from "./extensions/index.js";
```

- `DefaultResourceLoader`의 `extensionFactories`에 추가:

```ts
extensionFactories: [
  kotlinGuardHook,
  ktorHelperHook(cwd),
  workflowExtension(workflowCtx),
  brandingHeaderExtension,
],
```

**Step 3: Run build to validate integration**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/extensions/index.ts src/main.ts
git commit -m "feat: enable branding header extension by default"
```

---

### Task 3: Verify runtime behavior in interactive mode

**Files:**
- Verify runtime output only (no code change expected)

**Step 1: Start interactive mode and check header**

Run: `npm run dev`
Expected:
- startup header shows small ASCII art + `pi-sam`
- bottom line includes `/help · /model · /resume` and `v{VERSION}`

**Step 2: Quick regression checks**

Run in session:
- `/help`
- `/model`
- `/review all`

Expected:
- commands still available
- no extension errors in startup

**Step 3: Final verification build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit (if any small fixes happened)**

```bash
git add -A
git commit -m "chore: verify startup branding header behavior"
```
