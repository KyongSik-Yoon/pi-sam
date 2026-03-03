# Read Tool Minimal Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep `read` tool behavior intact for the model while showing only relative file path in default collapsed UI.

**Architecture:** Add a dedicated extension that overrides only the `read` tool rendering. Execution delegates to built-in `createReadTool()` so semantics and tool output for the LLM remain unchanged. In collapsed mode, render nothing for result; in expanded mode, render the original text content.

**Tech Stack:** TypeScript, `@mariozechner/pi-coding-agent` extension API, `@mariozechner/pi-tui` Text component, Node path utils.

---

### Task 1: Write failing tests for path/renderer behavior

**Files:**
- Test: `src/extensions/minimal-read-renderer.test.ts`
- Create: `src/extensions/minimal-read-renderer.ts`

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMinimalReadRenderHelpers } from "./minimal-read-renderer.js";

describe("minimal read renderer", () => {
  it("formats absolute path as relative path", () => {
    const helpers = createMinimalReadRenderHelpers("/repo");
    assert.equal(helpers.toDisplayPath("/repo/src/main.ts"), "src/main.ts");
  });

  it("returns empty collapsed output and text in expanded output", () => {
    const helpers = createMinimalReadRenderHelpers("/repo");
    assert.equal(helpers.renderCollapsedText(), "");
    assert.equal(helpers.renderExpandedText("abc"), "abc");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/extensions/minimal-read-renderer.test.ts`
Expected: FAIL (module/function not found)

**Step 3: Commit**

```bash
git add src/extensions/minimal-read-renderer.test.ts
git commit -m "test: add failing tests for minimal read renderer"
```

---

### Task 2: Implement minimal read renderer extension

**Files:**
- Create: `src/extensions/minimal-read-renderer.ts`

**Step 1: Write minimal implementation**

```ts
import { createReadTool, type ExtensionAPI, type ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { isAbsolute, relative } from "node:path";

export function createMinimalReadRenderHelpers(cwd: string) {
  function stripAtPrefix(path: string): string {
    return path.startsWith("@") ? path.slice(1) : path;
  }

  function toDisplayPath(inputPath: string): string {
    const normalized = stripAtPrefix(inputPath);
    if (!isAbsolute(normalized)) return normalized;
    const rel = relative(cwd, normalized);
    return rel.length === 0 ? "." : rel;
  }

  function renderCollapsedText(): string {
    return "";
  }

  function renderExpandedText(text: string): string {
    return text;
  }

  return { toDisplayPath, renderCollapsedText, renderExpandedText };
}

export const minimalReadRendererExtension: ExtensionFactory = (pi) => {
  const cwd = process.cwd();
  const builtInRead = createReadTool(cwd);
  const helpers = createMinimalReadRenderHelpers(cwd);

  pi.registerTool({
    name: "read",
    label: "read",
    description: builtInRead.description,
    parameters: builtInRead.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      return builtInRead.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = helpers.toDisplayPath(args.path ?? "");
      return new Text(`${theme.fg("toolTitle", "read")} ${theme.fg("accent", path)}`, 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      if (!expanded) return new Text(helpers.renderCollapsedText(), 0, 0);
      const textBlock = result.content.find((c) => c.type === "text");
      if (!textBlock || textBlock.type !== "text") return new Text("", 0, 0);
      return new Text(helpers.renderExpandedText(theme.fg("toolOutput", textBlock.text)), 0, 0);
    },
  });
};
```

**Step 2: Run test to verify it passes**

Run: `node --import tsx --test src/extensions/minimal-read-renderer.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/extensions/minimal-read-renderer.ts
git commit -m "feat: add minimal read renderer extension"
```

---

### Task 3: Wire extension into runtime defaults

**Files:**
- Modify: `src/extensions/index.ts`
- Modify: `src/main.ts`

**Step 1: Export extension**

```ts
export { minimalReadRendererExtension } from "./minimal-read-renderer.js";
```

**Step 2: Register extension in `extensionFactories`**

```ts
extensionFactories: [
  kotlinGuardHook,
  ktorHelperHook(cwd),
  workflowExtension(workflowCtx),
  brandingHeaderExtension,
  minimalReadRendererExtension,
]
```

**Step 3: Run full build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/extensions/index.ts src/main.ts
git commit -m "feat: enable minimal read display by default"
```

---

### Task 4: Final verification

**Step 1: Run focused tests and build**

Run: `node --import tsx --test src/extensions/minimal-read-renderer.test.ts && npm run build`
Expected: all pass

**Step 2: Manual smoke check (interactive)**

Run: `npm run dev`
Expected:
- `read` tool call shows relative path
- collapsed tool result hides file body
- expanded tool result shows file body

**Step 3: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: verify minimal read display behavior"
```
