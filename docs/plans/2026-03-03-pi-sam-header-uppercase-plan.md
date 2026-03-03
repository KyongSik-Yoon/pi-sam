# pi-sam Header Uppercase Logo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change the compact startup logo text style from lowercase-oriented form to uppercase `PI-SAM` for better readability.

**Architecture:** Replace only the top 3 static logo lines in `getPiSamHeaderLines()` while preserving line count, width constraints, and metadata/footer lines.

**Tech Stack:** TypeScript, Node test runner (`node:test`), existing branding extension.

---

### Task 1: Add failing uppercase-shape test

**Files:**
- Modify: `src/extensions/branding-header.test.ts`

**Step 1: Write the failing test**

```ts
it("대문자 스타일 로고 형태를 만족해야 한다", () => {
  const lines = getPiSamHeaderLines("0.1.0");
  const logoLines = lines.slice(0, 3);

  assert.ok(logoLines.some((line) => line.includes("▀▀")), "대문자 상단 획 패턴 필요");
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/extensions/branding-header.test.ts`
Expected: FAIL

**Step 3: Commit**

```bash
git add src/extensions/branding-header.test.ts
git commit -m "test: add uppercase logo shape expectation"
```

---

### Task 2: Replace logo lines with uppercase compact block art

**Files:**
- Modify: `src/extensions/branding-header.ts`

**Step 1: Implement minimal logo-line replacement**

```ts
return [
  "  █▀▀█ █▀▀   ▀█▀ ▄▀█ █▀▄▀█",
  "  █▄▄█ █▄▄    █  █▀█ █ ▀ █",
  "  ▀    ▀▀▀    ▀  ▀ ▀ ▀   ▀",
  "   pi-sam",
  `   /help · /model · /resume  v${version}`,
];
```

(폭 20~28 유지되도록 실제 문자열 미세 조정)

**Step 2: Run test to verify it passes**

Run: `node --import tsx --test src/extensions/branding-header.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/extensions/branding-header.ts src/extensions/branding-header.test.ts
git commit -m "feat: switch header logo to uppercase compact block style"
```

---

### Task 3: Verify build and focused tests

**Step 1: Run verification**

Run: `npm run build && node --import tsx --test src/extensions/branding-header.test.ts`
Expected: PASS

**Step 2: Commit final polish if needed**

```bash
git add -A
git commit -m "chore: verify uppercase header logo refresh"
```
